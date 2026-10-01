import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId } from "./cloudTenant";
import { HopDongService } from "./HopDongService";
import { rpcRows } from "./DatCocService";
import { VoucherDetail, toVoucherDetail } from "../lib/reportDetail";
import {
  ProgressRow,
  agingOf,
  buildInstallments,
  isDroppedStatus,
  isPbtLoaiName,
  sumReceiptLines,
  toProgressRow,
} from "../lib/paymentMath";

/**
 * Báo cáo tính trên Cloud – như web (không gọi API cũ `api/bao-cao/*`):
 *  - Thu tiền:   fn_cash_voucher_list (CashVoucherService.listVouchers, loại THU)
 *  - Hợp đồng:   fn_contract_list (ContractListService) theo ngày ký
 *  - Tiến độ:    như DebtProgressReport mặc định (contractType GOC): luôn dựng từ vòng đời phiếu,
 *                chỉ hợp đồng gốc (listDebtSummaryFromLifecycle + listInstallmentsFromLifecycle, không đọc cloud_debts)
 *  - Sắp đến hạn / quá hạn theo agingOf của DebtProgressReport.
 * Kỳ lọc: from/to dạng YYYY-MM-DD (giờ VN). projectId: uuid hoặc mã dự án.
 */

export type ReportFilter = { from?: string | null; to?: string | null; projectId?: string | null };

export type ReceiptRow = {
  id: string;
  soPhieu: string;
  ngay: string | null;
  tenKH: string;
  tenDA: string;
  soTien: number;
  dienGiai: string;
  hinhThuc: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: any) => Number(v || 0) || 0;
const str = (v: any) => (v == null ? "" : String(v));

async function projectUuid(key: string | null | undefined): Promise<string | null> {
  const k = str(key).trim();
  if (!k) return null;
  if (UUID_RE.test(k)) return k;
  try {
    const r = await axiosApiSupabase.get("rest/v1/da_projects", {
      params: { select: "id", ma_da_code: `eq.${k}`, limit: "1" },
    });
    return (Array.isArray(r.data) ? r.data[0]?.id : null) || null;
  } catch {
    return null;
  }
}

/** Tra bảng theo danh sách id, chia nhóm 100 id/lần (URL không quá dài). Lỗi → ném ra để báo lỗi, không im lặng. */
async function byIds(table: string, select: string, ids: string[]): Promise<Record<string, any>> {
  const list = [...new Set(ids.filter(Boolean))];
  const out: Record<string, any> = {};
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const r = await axiosApiSupabase.get(`rest/v1/${table}`, { params: { select, id: `in.(${chunk.join(",")})` } });
    (Array.isArray(r.data) ? r.data : []).forEach((x: any) => (out[String(x.id)] = x));
  }
  return out;
}

/** Công nợ tổng hợp từng phiếu dựng từ bảng vòng đời (web listDebtSummaryFromLifecycle, không embed FK). */
async function lifecycleParents(projectKey: string | null): Promise<any[]> {
  const companyId = await getCompanyId();
  if (!UUID_RE.test(str(companyId))) return [];
  const res = await axiosApiSupabase.get("rest/v1/cloud_pgc_phieu_giucho", {
    params: {
      select:
        "id,giai_doan,so_phieu_gc,san_pham_id,project_id,khach_hang_id,trang_thai_id,san_id,gia_tri_hd,gia_tri_hd_sau_ck,da_thu,phi_bao_tri,lich_thanh_toan,tt_hop_dong,payload,updated_at",
      ma_ctdk_uid: `eq.${companyId}`,
      deleted_at: "is.null",
      giai_doan: "in.(DATCOC,HDGV,HDMB)",
      // Web DebtProgressReport mặc định contractType "GOC": chỉ hợp đồng gốc (không gồm chuyển nhượng)
      ma_hd_goc: "is.null",
      order: "updated_at.desc",
      limit: "5000",
    },
  });
  const docs: any[] = Array.isArray(res.data) ? res.data : [];
  const ids = docs.map((d) => String(d.id));

  const [statuses, products, customers, depositsRes, contractsRes, paid] = await Promise.all([
    byIds("cloud_catalogs", "id,item_code,item_name", docs.map((d) => str(d.trang_thai_id))),
    byIds("bds_products", "id,ma_sp,ky_hieu,ma_da", docs.map((d) => str(d.san_pham_id))),
    byIds("cloud_customers", "id,ten_kh,ten_cong_ty,dien_thoai", docs.map((d) => str(d.khach_hang_id))),
    byPgc("cloud_deposits", "phieu_giu_cho_id,so_phieu", ids),
    byPgc("cloud_contracts", "phieu_giu_cho_id,so_hdmb", ids),
    receiptsByDoc(companyId),
  ]);
  // Dự án lấy theo phiếu, thiếu thì theo sản phẩm (web enrichProjectFromProducts)
  const projects = await byIds(
    "da_projects",
    "id,ten_da,ma_da_code",
    docs.map((d) => str(d.project_id || products[str(d.san_pham_id)]?.ma_da))
  );

  // Số chứng từ: số phiếu cọc, số hợp đồng ghi đè sau (như web)
  const docNo = new Map<string, string>();
  depositsRes.forEach((x: any) => {
    if (x.phieu_giu_cho_id && x.so_phieu) docNo.set(String(x.phieu_giu_cho_id), x.so_phieu);
  });
  contractsRes.forEach((x: any) => {
    if (x.phieu_giu_cho_id && x.so_hdmb) docNo.set(String(x.phieu_giu_cho_id), x.so_hdmb);
  });

  const projectUid = projectKey ? await projectUuid(projectKey) : null;

  return docs
    .map((r) => {
      const tt = statuses[str(r.trang_thai_id)] || {};
      const sp = products[str(r.san_pham_id)] || {};
      const pid = str(r.project_id || sp.ma_da);
      const da = projects[pid] || {};
      const kh = customers[str(r.khach_hang_id)] || {};
      const payload = r.payload || {};
      const hd = r.tt_hop_dong || payload.TTHopDong || {};
      const giaTri = n(r.gia_tri_hd_sau_ck) || n(r.gia_tri_hd);
      const soHD = docNo.get(String(r.id)) || r.so_phieu_gc || String(r.id);
      const p = paid.get(String(r.id)) || paid.get(String(soHD)) || { daThu: 0, daThuPBT: 0 };
      const daThu = p.daThu || n(r.da_thu);
      const tenTT =
        tt.item_name || (r.giai_doan === "HDMB" ? "Hợp đồng mua bán" : r.giai_doan === "HDGV" ? "HĐ Góp vốn" : "Đặt cọc");
      return {
        _dropped: isDroppedStatus(tt.item_name || ""),
        MaPGC: r.id,
        GiaiDoan: r.giai_doan,
        SoHD: soHD,
        MaDA: da.ma_da_code ?? pid ?? null,
        ProjectId: pid || null,
        TenDA: da.ten_da ?? null,
        KyHieu: sp.ky_hieu ?? null,
        HoTenKH: kh.ten_kh ?? kh.ten_cong_ty ?? null,
        DiDong: kh.dien_thoai ?? null,
        TenTT: tenTT,
        TongGiaTriHD: Math.round(giaTri),
        DaThu: Math.round(daThu),
        // buildInstallments ghi đè DaThu bằng phần của từng đợt → giữ riêng đã thu cả phiếu
        DaThuHD: Math.round(daThu),
        ConLai: Math.round(giaTri - daThu),
        PhiBaoTri: Math.round(n(r.phi_bao_tri)),
        DaThuPBT: Math.round(p.daThuPBT || 0),
        LichThanhToan:
          (Array.isArray(r.lich_thanh_toan) && r.lich_thanh_toan.length ? r.lich_thanh_toan : null) ||
          (Array.isArray(hd.LichThanhToan) ? hd.LichThanhToan : null) ||
          (Array.isArray(payload.LichThanhToan) ? payload.LichThanhToan : []),
      };
    })
    .filter((r) => !r._dropped)
    .filter((r) => !projectKey || r.ProjectId === projectUid || String(r.MaDA ?? "") === projectKey);
}

/** Dòng bảng con theo uuid phiếu giữ chỗ (chia nhóm 100). */
async function byPgc(table: string, select: string, pgcIds: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < pgcIds.length; i += 100) {
    const r = await axiosApiSupabase.get(`rest/v1/${table}`, {
      params: { select, phieu_giu_cho_id: `in.(${pgcIds.slice(i, i + 100).join(",")})` },
    });
    out.push(...(Array.isArray(r.data) ? r.data : []));
  }
  return out;
}

/** Đã thu theo phiếu từ dòng chi tiết phiếu thu (web sumReceiptsByPgc). */
async function receiptsByDoc(companyId: string) {
  try {
    const r = await axiosApiSupabase.get("rest/v1/cloud_cash_voucher_details", {
      params: { select: "pgc_id,ma_loai,so_tien", ma_ctdk: `eq.${companyId}`, loai_phieu: "eq.THU", limit: "50000" },
    });
    const lines: any[] = Array.isArray(r.data) ? r.data : [];
    const pgcIds = [...new Set(lines.map((d) => str(d.pgc_id)).filter(Boolean))];
    const loaiIds = [...new Set(lines.map((d) => str(d.ma_loai)).filter(Boolean))];
    if (!pgcIds.length) return sumReceiptLines([], { alias: {}, code: {}, pbtLoai: new Set() });
    const [pgcs, contracts, deposits, loai] = await Promise.all([
      byIds("cloud_pgc_phieu_giucho", "id,so_phieu_gc", pgcIds),
      byIds("cloud_contracts", "id,phieu_giu_cho_id,so_hdmb", pgcIds),
      byIds("cloud_deposits", "id,phieu_giu_cho_id", pgcIds),
      byIds("cloud_catalogs", "id,item_name", loaiIds),
    ]);
    const alias: Record<string, string> = {};
    const code: Record<string, string> = {};
    Object.values(pgcs).forEach((p: any) => (code[String(p.id)] = str(p.so_phieu_gc)));
    Object.values(contracts).forEach((c: any) => {
      if (c.phieu_giu_cho_id) alias[String(c.id)] = String(c.phieu_giu_cho_id);
      if (c.so_hdmb) code[String(c.id)] = String(c.so_hdmb);
    });
    Object.values(deposits).forEach((c: any) => {
      if (c.phieu_giu_cho_id) alias[String(c.id)] = String(c.phieu_giu_cho_id);
    });
    const pbtLoai = new Set(Object.values(loai).filter((c: any) => isPbtLoaiName(c.item_name)).map((c: any) => String(c.id)));
    return sumReceiptLines(lines, { alias, code, pbtLoai });
  } catch (e) {
    console.log("ERROR receiptsByDoc:", e);
    throw e;
  }
}

const inRange = (date: any, f: ReportFilter) => {
  // Đợt chưa có ngày: web giữ lại (không lọc được theo ngày)
  if (!date) return true;
  const t = new Date(date).getTime();
  if (f.from && t < new Date(`${f.from}T00:00:00.000+07:00`).getTime()) return false;
  if (f.to && t > new Date(`${f.to}T23:59:59.999+07:00`).getTime()) return false;
  return true;
};

export const ReportService = {
  /** Phiếu thu trong kỳ (loại THU). */
  getReceipts: async (f: ReportFilter): Promise<{ rows: ReceiptRow[]; total: number; error?: boolean }> => {
    try {
      const pid = await projectUuid(f.projectId);
      if (f.projectId && !pid) return { rows: [], total: 0 };
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_cash_voucher_list", {
        p_loai: "THU",
        p_project_ids: pid ? [pid] : null,
        p_tu_ngay: f.from || null,
        p_den_ngay: f.to || null,
        p_keyword: null,
        // Như màn Phiếu thu web: mặc định hợp đồng gốc
        p_contract_type: "GOC",
        p_company_ids: null,
        p_page_index: 1,
        p_page_size: 5000,
      });
      const { rows } = rpcRows(res.data);
      const list: ReceiptRow[] = rows.map((r: any) => ({
        id: str(r.id),
        soPhieu: str(r.so_phieu),
        ngay: r.ngay_phieu ?? null,
        tenKH: str(r.khach?.ten_kh ?? r.khach?.ten_cong_ty ?? r.nguoi_nop),
        tenDA: str(r.du_an?.ten_da),
        soTien: n(r.so_tien),
        dienGiai: str(r.dien_giai),
        hinhThuc: str(r.hinh_thuc),
      }));
      return { rows: list, total: list.reduce((s, r) => s + r.soTien, 0) };
    } catch (e) {
      console.log("ERROR report receipts:", e);
      return { rows: [], total: 0, error: true };
    }
  },

  /** Hợp đồng mua bán ký trong kỳ. */
  getContracts: async (f: ReportFilter): Promise<{ rows: any[]; count: number; total: number; error?: boolean }> => {
    const res: any = await HopDongService.get({
      TuNgay: f.from || undefined,
      DenNgay: f.to || undefined,
      DuAn: f.projectId || undefined,
      Offset: 1,
      Limit: 5000,
    });
    const rows = Array.isArray(res?.data) ? res.data : [];
    return {
      rows,
      count: Number(res?.totalRows) || rows.length,
      total: rows.reduce((s: number, r: any) => s + n(r.TongGiaTriHDMB), 0),
      error: !!res?.error,
    };
  },

  /**
   * Tiến độ thanh toán theo đợt: rows = mọi đợt; overdue = đợt quá hạn (agingOf d*, không lọc kỳ);
   * upcoming = đợt còn nợ, chưa quá hạn, ngày thanh toán trong kỳ.
   */
  getProgress: async (
    f: ReportFilter
  ): Promise<{ rows: ProgressRow[]; overdue: ProgressRow[]; upcoming: ProgressRow[]; error?: boolean }> => {
    try {
      // Như web DebtProgressReport (contractType GOC mặc định): luôn dựng từ vòng đời phiếu, không đọc bảng mirror cloud_debts
      const parents = await lifecycleParents(f.projectId || null);
      const source = buildInstallments(parents, { now: Date.now() }).map((x: any, i: number) => ({
        row: toProgressRow(x, i),
        ngayTT: x.NgayTT,
      }));
      const rows = source.map((s) => s.row);
      const overdue = rows.filter((r) => agingOf(r).startsWith("d"));
      const upcoming = source
        .filter((s) => agingOf(s.row) === "current" && inRange(s.ngayTT, f))
        .map((s) => s.row);
      return { rows, overdue, upcoming };
    } catch (e) {
      console.log("ERROR report progress:", e);
      return { rows: [], overdue: [], upcoming: [], error: true };
    }
  },

  /**
   * Chi tiết một phiếu thu – như web VoucherDetailDrawer (ReceiptsPay.Receipts.getByID →
   * CashVoucherService.getVoucher): fn_cash_voucher_get_by_id trả phiếu + khách + dự án + dòng chi tiết.
   */
  getVoucher: async (id: string): Promise<{ data: VoucherDetail | null; error?: boolean }> => {
    try {
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_cash_voucher_get_by_id", { p_id: String(id) });
      // PostgREST: jsonb trả thẳng object; phòng trường hợp bọc mảng / bọc theo tên hàm
      const raw = Array.isArray(res.data) ? res.data[0] : res.data;
      const json = raw?.fn_cash_voucher_get_by_id ?? raw;
      return { data: toVoucherDetail(json) };
    } catch (e) {
      console.log("ERROR fn_cash_voucher_get_by_id:", e);
      return { data: null, error: true };
    }
  },

  /** 4 số của màn Tổng quan – cùng nguồn với 4 báo cáo chi tiết. */
  getOverview: async (f: ReportFilter) => {
    const [receipts, contracts, progress] = await Promise.all([
      ReportService.getReceipts(f),
      ReportService.getContracts(f),
      ReportService.getProgress(f),
    ]);
    return {
      thuTien: receipts.total,
      hopDong: contracts.total,
      soHopDong: contracts.count,
      sapDenHan: progress.upcoming.length,
      quaHan: progress.overdue.length,
      error: !!(receipts.error || contracts.error || progress.error),
    };
  },
};
