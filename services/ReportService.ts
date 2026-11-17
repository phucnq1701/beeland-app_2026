import { HopDongService } from "./HopDongService";
import { rpcRows } from "./DatCocService";
import { VoucherDetail, toVoucherDetail } from "../lib/reportDetail";
import {
  ProgressRow,
  agingOf,
  buildInstallments,
  isDroppedStatus,
  toProgressRow,
} from "../lib/paymentMath";
import { customerMapByIds } from "./customerLookup";
import { callNv } from "@/services/nvApi";
import { DuAnApi } from "@/services/SanPhamApi";

/**
 * Báo cáo — bộ API riêng app (fn_nv_app_*, lõi chung web), như web (không gọi API cũ `api/bao-cao/*`):
 *  - Thu tiền:   fn_nv_app_phieu_thu_list (= fn_cash_voucher_list loại THU, hợp đồng gốc) + chi tiết fn_nv_app_phieu_thu_chi_tiet
 *  - Hợp đồng:   HopDongService (fn_nv_app_hop_dong_list = fn_sale_contract_list) theo ngày ký
 *  - Tiến độ:    như DebtProgressReport mặc định (hợp đồng gốc): phiếu gốc fn_nv_app_bao_cao_tien_do (máy chủ lọc phạm vi, nối trạng
 *                thái / căn / dự án / số chứng từ) + đã thu fn_nv_app_da_thu_phieu (= fn_pgc_collected); đợt / quá hạn dựng phía máy
 *                như web (lib/paymentMath). Khách: fn_nv_app_khach_hang_theo_id (che trường ở máy chủ).
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
    return await DuAnApi.resolveId(k);
  } catch {
    return null;
  }
}

/** Công nợ tổng hợp từng phiếu gốc (web listDebtSummaryFromLifecycle) — 1 lời gọi máy chủ + đã thu + khách. */
async function lifecycleParents(projectKey: string | null): Promise<any[]> {
  const projectUid = projectKey ? await projectUuid(projectKey) : null;
  if (projectKey && !projectUid) return [];
  const docs = await callNv<any[]>("fn_nv_app_bao_cao_tien_do", { p_du_an_id: projectUid });
  const list: any[] = Array.isArray(docs) ? docs : [];
  const [customers, paid] = await Promise.all([
    // Lỗi tra khách ⇒ map rỗng: báo cáo vẫn hiện, chỉ thiếu tên khách (như trước)
    customerMapByIds(list.map((d) => d.khach_hang_id)),
    collectedByPgc(list.map((d) => String(d.id))),
  ]);

  return list
    .map((r) => {
      const kh = customers.get(str(r.khach_hang_id).toLowerCase()) || {};
      const hd = r.tt_hop_dong || r.payload_tt_hop_dong || {};
      const giaTri = n(r.gia_tri_hd_sau_ck) || n(r.gia_tri_hd);
      // Số chứng từ: số hợp đồng > số phiếu cọc > số phiếu giữ chỗ (như web)
      const soHD = r.so_hdmb || r.so_phieu_coc || r.so_phieu_gc || String(r.id);
      // Máy chủ có khoá ⇒ đúng số máy chủ (kể cả 0); không có khoá mới dùng `da_thu` lưu trên phiếu (web)
      const p = paid.get(String(r.id));
      const daThu = p ? p.daThu : n(r.da_thu);
      const tenTT =
        r.tt_name || (r.giai_doan === "HDMB" ? "Hợp đồng mua bán" : r.giai_doan === "HDGV" ? "HĐ Góp vốn" : "Đặt cọc");
      return {
        // Bỏ phiếu huỷ / thanh lý và HĐ gốc đã chuyển nhượng (D4-10, cờ máy chủ — web isTransferred)
        _dropped: isDroppedStatus(r.tt_name || "") || p?.daChuyenNhuong === true,
        MaPGC: r.id,
        GiaiDoan: r.giai_doan,
        SoHD: soHD,
        MaDA: r.ma_da_code ?? r.project_id ?? null,
        ProjectId: r.project_id || null,
        TenDA: r.ten_da ?? null,
        KyHieu: r.ky_hieu ?? null,
        HoTenKH: kh.ten_kh ?? kh.ten_cong_ty ?? null,
        DiDong: kh.dien_thoai ?? null,
        TenTT: tenTT,
        TongGiaTriHD: Math.round(giaTri),
        DaThu: Math.round(daThu),
        // buildInstallments ghi đè DaThu bằng phần của từng đợt → giữ riêng đã thu cả phiếu
        DaThuHD: Math.round(daThu),
        ConLai: Math.round(giaTri - daThu),
        PhiBaoTri: Math.round(n(r.phi_bao_tri)),
        DaThuPBT: Math.round(p?.daThuPBT || 0),
        LichThanhToan:
          (Array.isArray(hd.LichThanhToan) ? hd.LichThanhToan : null) ||
          (Array.isArray(r.payload_lich_thanh_toan) ? r.payload_lich_thanh_toan : []),
      };
    })
    .filter((r) => !r._dropped);
}

/**
 * Đã thu theo phiếu giữ chỗ — fn_nv_app_da_thu_phieu (= fn_pgc_collected, web AccountingCloudService.sumReceiptsByPgc). Bảng
 * cloud_cash_voucher_details đã khoá đọc thẳng nên không cộng dòng phiếu thu ở app nữa. Máy chủ tính cả bí danh HĐ / cọc,
 * phần kế thừa HĐ gốc, bỏ tiền lãi; HĐ gốc đã chuyển nhượng ⇒ `daChuyenNhuong` (tiền = 0). ≤ 20 000 phiếu / lần.
 * Lỗi ném ra (báo lỗi, không im lặng).
 */
async function collectedByPgc(
  pgcIds: string[]
): Promise<Map<string, { daThu: number; daThuPBT: number; daChuyenNhuong: boolean }>> {
  const map = new Map<string, { daThu: number; daThuPBT: number; daChuyenNhuong: boolean }>();
  const ids = [...new Set(pgcIds.map((v) => str(v).trim()).filter((v) => UUID_RE.test(v)))];
  for (let i = 0; i < ids.length; i += 20000) {
    try {
      const data = await callNv<Record<string, any>>("fn_nv_app_da_thu_phieu", { p_pgc_ids: ids.slice(i, i + 20000) });
      Object.entries(data || {}).forEach(([id, v]) => {
        map.set(String(id), {
          daThu: Math.round(n(v?.da_thu)),
          daThuPBT: Math.round(n(v?.da_thu_pbt)),
          daChuyenNhuong: v?.da_chuyen_nhuong === true,
        });
      });
    } catch (e) {
      console.log("ERROR fn_nv_app_da_thu_phieu:", e);
      throw e;
    }
  }
  return map;
}

const OVERDUE = new Set(["d30", "d60", "d90", "d90p"]);

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
      // Như màn Phiếu thu web: loại THU, mặc định hợp đồng gốc (máy chủ app cố định)
      const res = await callNv<any>("fn_nv_app_phieu_thu_list", {
        p_du_an_id: pid,
        p_tu_ngay: f.from || null,
        p_den_ngay: f.to || null,
        p_trang: 1,
        p_so_dong: 5000,
      });
      const { rows } = rpcRows(res);
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
      // Quá hạn = d30 / d60 / d90 / d90p ("done" = đã tất toán cũng bắt đầu bằng "d" — trước đây lọt vào danh sách quá hạn)
      const overdue = rows.filter((r) => OVERDUE.has(agingOf(r)));
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
      const data = await callNv<any>("fn_nv_app_phieu_thu_chi_tiet", { p_id: String(id) });
      const raw = Array.isArray(data) ? data[0] : data;
      const json = raw?.fn_cash_voucher_get_by_id ?? raw;
      return { data: toVoucherDetail(json) };
    } catch (e) {
      console.log("ERROR fn_nv_app_phieu_thu_chi_tiet:", e);
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
