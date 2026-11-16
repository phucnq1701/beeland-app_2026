import { callNv, errorMessage } from "@/services/nvApi";
import { listPgcStatuses, selectedProjectUuids, vnDayBound } from "./DatCocService";
import { listResult, mergeProjectPages, pageArgs } from "../lib/listRpc";
import { PaymentProgressService } from "./PaymentProgressService";

const num = (v: any) => (v == null ? null : Number(v));

/** 1 dòng fn_sale_contract_list → dữ liệu màn hình – y hệt web ContractListService.mapRow (HĐMB). */
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

/** Khoá phiếu của hợp đồng: uuid phiếu giữ chỗ nếu dòng đã có, không thì uuid hợp đồng (máy chủ tự quy về phiếu giữ chỗ). */
function pgcOf(payload: any): string {
  return String(payload?.PhieuGiuChoId ?? payload?.pgcId ?? payload?.MaPGC ?? payload?.maPGC ?? payload?.id ?? "").trim();
}

/**
 * HỢP ĐỒNG qua bộ API riêng app (lõi chung web):
 * - Danh sách: fn_nv_app_hop_dong_list = fn_sale_contract_list màn DS Hợp đồng (HĐMB gốc, bỏ chuyển nhượng) — lọc/tìm/phân trang/
 *   "Đã thu" + phạm vi ở máy chủ.
 * - Trạng thái: fn_nv_app_trang_thai_list (pgc_trang_thai).
 * - Lịch thanh toán + phiếu thu: PaymentProgressService.
 */
export const HopDongService = {
  /** Danh sách hợp đồng mua bán gốc. filter: { TuNgay, DenNgay, DuAn, MaTT, inputSearch, Offset (trang, từ 1), Limit } */
  get: async (filter: any = {}) => {
    try {
      const limit = Math.min(5000, Math.max(1, Number(filter?.Limit ?? filter?.limit ?? 50)));
      const page = Math.max(1, Number(filter?.Offset ?? filter?.offset ?? 1));
      const projects = await selectedProjectUuids(filter);
      // Có chọn dự án nhưng không đổi ra uuid → không có dữ liệu hợp lệ (như web)
      if (projects && projects.length === 0) return { data: [], totalRows: 0 };
      const maTT = Number(filter?.MaTT ?? 0) || 0;
      const base = {
        p_tu_khoa: String(filter?.inputSearch ?? filter?.keyword ?? "").trim() || null,
        p_tu_ngay: vnDayBound(filter?.TuNgay ?? filter?.tuNgay, false),
        p_den_ngay: vnDayBound(filter?.DenNgay ?? filter?.denNgay, true),
        p_ma_tt: maTT > 0 ? maTT : null,
      };
      const call = async (projectId: string | null, p: number, size: number) => {
        const pa = pageArgs(p, size);
        const res = await callNv<any>("fn_nv_app_hop_dong_list", { ...base, p_du_an_id: projectId, p_trang: pa.p_page, p_so_dong: pa.p_size });
        return listResult(res);
      };
      let result: { rows: any[]; total: number };
      if (projects && projects.length > 1) {
        // Chọn nhiều dự án: hàm chỉ nhận 1 dự án ⇒ gọi từng dự án rồi gộp đúng trang (thứ tự như máy chủ: ngày ký mới trước)
        const pages = await Promise.all(projects.map((id) => call(id, 1, page * limit)));
        result = mergeProjectPages(pages, page, limit, (r: any) => r?.ngay_ky ?? r?.ngay_nhap ?? r?.created_at);
      } else {
        result = await call(projects?.[0] ?? null, page, limit);
      }
      return { data: result.rows.map(mapContractRow), totalRows: result.total };
    } catch (error) {
      console.log("ERROR fn_nv_app_hop_dong_list:", errorMessage(error));
      return { data: [], totalRows: 0, error: true };
    }
  },

  getTT: async (_payload: any = {}) => listPgcStatuses(),

  /** Lịch thanh toán của hợp đồng (theo phiếu giữ chỗ) – PaymentProgressService.getSchedule. */
  getDetailLTT: async (payload: any = {}) => {
    const res = await PaymentProgressService.getSchedule(pgcOf(payload));
    return { data: res.rows, source: res.source, error: !!res.error };
  },

  /** Phiếu thu của hợp đồng (phần thuộc hợp đồng) – PaymentProgressService.getReceipts. */
  getDetailLST: async (payload: any = {}) => {
    const res = await PaymentProgressService.getReceipts(pgcOf(payload));
    return { data: res.rows, total: res.total, error: res.error };
  },
};
