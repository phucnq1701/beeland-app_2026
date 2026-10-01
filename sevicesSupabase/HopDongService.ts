import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";
import { rpcRows, vnDayBound } from "./DatCocService";
import { PaymentProgressService } from "./PaymentProgressService";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DuAn có thể là mảng hoặc chuỗi ",a,b," → mảng id sạch. */
function parseProjectIds(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ma_da_code → da_projects.id (uuid). Bỏ qua nếu đã là uuid. */
async function resolveProjectUuids(ids: string[]): Promise<string[]> {
  const uuids: string[] = [];
  for (const id of ids) {
    if (UUID_RE.test(id)) {
      uuids.push(id);
      continue;
    }
    try {
      const r = await axiosApiSupabase.get("rest/v1/da_projects", {
        params: { select: "id", ma_da_code: `eq.${id}`, limit: "1" },
      });
      const rows = Array.isArray(r.data) ? r.data : [];
      if (rows[0]?.id) uuids.push(rows[0].id);
    } catch {
      // bỏ qua lỗi resolve từng dự án
    }
  }
  return uuids;
}

const num = (v: any) => (v == null ? null : Number(v));

/** 1 dòng fn_contract_list → dữ liệu màn hình – y hệt web ContractListService.mapRow (HĐMB). */
function mapContractRow(r: any) {
  const hd = r?.tt_hop_dong || {};
  return {
    ID: r.id,
    MaHD: r.id,
    MaHDMB: r.id,
    /** uuid hợp đồng (giữ tên cũ) */
    MaPGC: r.id,
    /** uuid PHIẾU GIỮ CHỖ – lịch thanh toán, phiếu thu… */
    PhieuGiuChoId: r.pgc_id ? String(r.pgc_id) : null,
    LoaiCT: r.loai_ct === "HDGV" ? "HDGV" : "HDMB",
    SoHDMB: r.so_hd,
    SoPhieu: r.so_hd,
    SoPhieuGC: r.so_phieu_gc ?? null,
    SoPhieuDatCoc: r.so_phieu_dat_coc ?? null,
    NgayKy: r.ngay_ky ?? null,
    NgayNhap: r.ngay_nhap ?? r.created_at,
    MaDA: r.ma_da_code ?? r.project_id ?? null,
    ProjectId: r.project_id ?? null,
    TenDA: r.ten_da ?? null,
    SanPhamId: r.san_pham_id ?? null,
    MaSP: r.ma_sp ?? null,
    KyHieu: r.ky_hieu ?? null,
    MaSanPham: r.ky_hieu ?? null,
    MaKH: r.khach_hang_id ?? null,
    MaSoKH: r.ma_so_kh ?? null,
    TenKH: r.ten_kh ?? null,
    SoCMND: r.cccd ?? null,
    DiDong: r.dien_thoai ?? null,
    Email: r.email ?? null,
    DiaChi: r.dia_chi ?? null,
    SanGD: r.ten_san ?? null,
    DienTich: num(r.dien_tich),
    DonGiaTT: num(r.don_gia_gom_vat),
    TongGiaGomVAT: num(r.gia_tri_hd),
    TongGiaTriHDMB: num(r.gia_tri_hd_sau_ck ?? r.gia_tri_hd),
    TienCoc: num(r.tien_coc),
    PhiBaoTri: num(r.phi_bao_tri),
    SoTien: num(r.so_tien),
    DaThu: num(r.da_thu) ?? 0,
    GhiChu: r.ghi_chu ?? null,
    MaTT: r.ma_tt != null ? Number(r.ma_tt) : null,
    TenTT: r.ten_tt ?? null,
    MauNen: r.color_code ?? null,
    TenNVKD: r.ten_nvkd ?? hd?.TenNVKD ?? null,
    TenChinhSach: r.ten_chinh_sach ?? null,
    TenLichThanhToan: r.ten_lich_thanh_toan ?? null,
    TotalRows: Number(r?.total_count) || 0,
  };
}

/** Lấy phieu_giu_cho_id (pgc id) từ cloud_contracts.id (MaPGC). */
async function resolvePgcId(maPGC: string): Promise<string> {
  if (!maPGC) return "";
  if (UUID_RE.test(maPGC)) {
    try {
      const r = await axiosApiSupabase.get("rest/v1/cloud_contracts", {
        params: {
          select: "phieu_giu_cho_id",
          id: `eq.${maPGC}`,
          limit: "1",
        },
      });
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (row?.phieu_giu_cho_id) return row.phieu_giu_cho_id;
    } catch (e) {
      console.log("ERROR resolvePgcId:", e);
    }
  }
  return "";
}

/** uuid phiếu giữ chỗ của hợp đồng: dòng danh sách đã có PhieuGiuChoId, không thì tra cloud_contracts. */
async function pgcOf(payload: any): Promise<string> {
  const direct = payload?.PhieuGiuChoId ?? payload?.pgcId;
  if (direct) return String(direct);
  return resolvePgcId(String(payload?.MaPGC ?? payload?.maPGC ?? payload?.id ?? ""));
}

/**
 * HỢP ĐỒNG — cloud, y hệt web:
 * - Danh sách: fn_contract_list (ContractListService) – lọc/tìm/phân trang/"Đã thu" dưới máy chủ.
 * - Trạng thái: cloud_catalogs catalog_type='pgc_trang_thai' (ma_ctdk='global').
 * - Lịch thanh toán + phiếu thu: PaymentProgressService (fn_contract_payment_schedule, fn_cash_vouchers_by_pgc).
 */
export const HopDongService = {
  /**
   * Danh sách hợp đồng mua bán gốc (không gồm chuyển nhượng – như web Contract.filter).
   * filter: { TuNgay, DenNgay, DuAn, MaTT, inputSearch, Offset (trang, từ 1), Limit, TransferOnly }
   */
  get: async (filter: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) return { data: [], totalRows: 0 };
    try {
      const tenantId = await getCompanyId();
      const limit = Math.min(5000, Math.max(1, Number(filter?.Limit ?? filter?.limit ?? 50)));
      const page = Math.max(1, Number(filter?.Offset ?? filter?.offset ?? 1));
      const offset = (page - 1) * limit;
      const projectIds = parseProjectIds(filter?.DuAn ?? filter?.duAn ?? filter?.projectId);
      const projectUuids = projectIds.length ? await resolveProjectUuids(projectIds) : [];
      // Có chọn dự án nhưng không đổi ra uuid → không có dữ liệu hợp lệ (như web)
      if (projectIds.length && !projectUuids.length) return { data: [], totalRows: 0 };
      const maTT = Number(filter?.MaTT ?? 0) || 0;
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_contract_list", {
        p_ma_ctdk_uid: tenantId,
        p_project_id: projectUuids.length ? projectUuids.join(",") : null,
        p_tu_ngay: vnDayBound(filter?.TuNgay ?? filter?.tuNgay, false),
        p_den_ngay: vnDayBound(filter?.DenNgay ?? filter?.denNgay, true),
        p_input_search: String(filter?.inputSearch ?? filter?.keyword ?? "").trim() || null,
        p_ma_tt: maTT > 0 ? maTT : null,
        p_company_ids: null,
        p_offset: offset,
        p_limit: limit,
        p_loai_ct: "HDMB",
        p_transfer_only: filter?.TransferOnly === true,
      });
      const { rows, total } = rpcRows(res.data);
      const data = rows.map(mapContractRow);
      return { data, totalRows: total ?? data.length };
    } catch (error) {
      console.log("ERROR HopDongService.get (fn_contract_list):", error);
      return { data: [], totalRows: 0, error: true };
    }
  },

  getTT: async (_payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Contract] chưa có cloud_jwt, bỏ qua getTT");
      return { data: [] };
    }

    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params: {
          select: "id,item_code,item_name,color_code",
          catalog_type: "eq.pgc_trang_thai",
          ma_ctdk: "eq.global",
          order: "item_code.asc",
          limit: "100",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.map((r: any) => {
        const code = r?.item_code;
        const num = Number(code);
        return {
          MaTT: Number.isFinite(num) ? num : code,
          TenTT: r?.item_name || "",
          ColorWeb: r?.color_code || "#9CA3AF",
          _raw: r,
        };
      });
      return { data };
    } catch (error) {
      console.log(
        "ERROR HopDongService.getTT (cloud_catalogs pgc_trang_thai):",
        error
      );
      return { data: [] };
    }
  },

  /** Lịch thanh toán của hợp đồng (theo phiếu giữ chỗ) – PaymentProgressService.getSchedule. */
  getDetailLTT: async (payload: any = {}) => {
    const pgcId = await pgcOf(payload);
    const res = await PaymentProgressService.getSchedule(pgcId);
    return { data: res.rows, source: res.source, error: !!res.error };
  },

  /** Phiếu thu của hợp đồng (phần thuộc hợp đồng) – PaymentProgressService.getReceipts. */
  getDetailLST: async (payload: any = {}) => {
    const pgcId = await pgcOf(payload);
    const res = await PaymentProgressService.getReceipts(pgcId);
    return { data: res.rows, total: res.total, error: res.error };
  },
};
