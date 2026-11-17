import { callNv, errorMessage } from "@/services/nvApi";
import { DuAnApi } from "@/services/SanPhamApi";
import { listResult, mergeProjectPages, pageArgs } from "../lib/listRpc";
import { PaymentProgressService } from "./PaymentProgressService";
import { statusCodeNum } from "../lib/depositQr";
import { formatDirections } from "../lib/format";

/**
 * ĐẶT CỌC qua bộ API riêng app (lõi chung web) — công ty / phạm vi / che trường ở máy chủ theo JWT:
 *  - Danh sách: fn_nv_app_dat_coc_list = fn_deposit_list màn Đặt cọc (bỏ phiếu chuyển nhượng).
 *  - Trạng thái: fn_nv_app_trang_thai_list = fn_status_catalog_list (màu theo công ty, như ô lọc web).
 *  - Chi tiết: fn_nv_app_dat_coc_chi_tiet (đúng dòng danh sách mới nhất + chứng từ fn_sales_doc_get + loại căn / hướng + cờ QR),
 *    lịch thanh toán + phiếu thu: PaymentProgressService.
 */

/** DuAn có thể là mảng hoặc chuỗi ",a,b," → mảng id sạch. */
function parseProjectIds(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Dự án đã chọn (ma_da_code hoặc uuid) → uuid; `null` = không chọn; `[]` = có chọn nhưng không đổi được (⇒ không có dữ liệu, như web). */
export async function selectedProjectUuids(filter: any): Promise<string[] | null> {
  const ids = parseProjectIds(filter?.DuAn ?? filter?.duAn ?? filter?.projectId);
  if (!ids.length) return null;
  const out: string[] = [];
  for (const id of ids) {
    try {
      const u = await DuAnApi.resolveId(id);
      if (u && !out.includes(u)) out.push(u);
    } catch {
      // bỏ qua lỗi tra từng dự án
    }
  }
  return out;
}

const num = (v: any) => (v == null ? null : Number(v));

/** Ngày lọc theo giờ VN như web vnDayStart / vnDayEnd ("YYYY-MM-DD" hoặc Date); rỗng → null. */
export function vnDayBound(v: any, end: boolean): string | null {
  if (v == null || v === "") return null;
  let ymd = "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) ymd = v.slice(0, 10);
  else {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    const vn = new Date(d.getTime() + 7 * 3600 * 1000);
    ymd = vn.toISOString().slice(0, 10);
  }
  return end ? `${ymd}T23:59:59.999+07:00` : `${ymd}T00:00:00.000+07:00`;
}

/** Kết quả hàm máy chủ: { rows, total_count } (bản mới) hoặc mảng dòng kèm total_count (bản cũ). */
export function rpcRows(data: any): { rows: any[]; total: number | null } {
  if (Array.isArray(data)) {
    const t = Number(data[0]?.total_count);
    return { rows: data, total: Number.isFinite(t) && t > 0 ? t : null };
  }
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  // Hàm danh sách bản mới (2026-10-14) trả { rows, total }; bản trước { rows, total_count }
  const t = Number(data?.total_count ?? data?.total);
  return { rows, total: Number.isFinite(t) ? t : null };
}

/**
 * Danh mục trạng thái phiếu giữ chỗ (ô lọc Đặt cọc / Hợp đồng) — fn_nv_app_trang_thai_list (= fn_status_catalog_list web:
 * màu của công ty đăng ký, chưa cài thì màu gốc). Shape UI cũ: { data: [{ MaTT, TenTT, ColorWeb }] } — MaTT = item_code (số).
 */
export async function listPgcStatuses(): Promise<{ data: any[] }> {
  try {
    const rows = await callNv<any[]>("fn_nv_app_trang_thai_list", { p_loai: "pgc_trang_thai" });
    const data = (Array.isArray(rows) ? rows : [])
      .filter((r: any) => r?.item_code != null && r.item_code !== "")
      .map((r: any) => {
        const code = r.item_code;
        const n = Number(code);
        return { MaTT: Number.isFinite(n) ? n : code, TenTT: r?.item_name || "", ColorWeb: r?.color_code || "#9CA3AF", _raw: r };
      });
    return { data };
  } catch (error) {
    console.log("ERROR fn_nv_app_trang_thai_list:", errorMessage(error));
    return { data: [] };
  }
}

/**
 * 1 dòng fn_deposit_list → dữ liệu màn hình – y hệt web DepositListService.mapRow.
 * MaPGC / PhieuGiuChoId = uuid phiếu giữ chỗ (lịch thanh toán, phiếu thu đều theo phiếu giữ chỗ).
 */
function mapDepositRow(r: any) {
  const hd = r?.tt_hop_dong || {};
  return {
    ID: r.id,
    MaDC: r.id,
    MaPDC: r.id,
    MaPGC: r.pgc_id ?? r.id,
    PhieuGiuChoId: r.pgc_id ? String(r.pgc_id) : null,
    GiaiDoan: r.giai_doan,
    SoPhieu: r.so_phieu,
    SoPhieuGC: r.so_phieu_gc ?? null,
    NgayDatCoc: r.ngay_coc ?? r.ngay_nhap ?? r.created_at,
    NgayCoc: r.ngay_coc ?? null,
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
    KhachHang: r.ten_kh ?? null,
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
    DaThu: num(r.da_thu) ?? 0,
    // item_code có thể lẫn chữ → lấy phần số như fn_deposit_list (Number() sẽ ra NaN)
    MaTT: statusCodeNum(r.ma_tt),
    TenTT: r.ten_tt ?? null,
    MauNen: r.color_code ?? null,
    NguoiTao: r.nguoi_tao ?? null,
    NguoiSua: r.nguoi_sua ?? null,
    TenNVKD: r.ten_nvkd ?? hd?.TenNVKD ?? null,
    TenChinhSach: r.ten_chinh_sach ?? (r.chinh_sach ?? [])[0]?.TenCS ?? (r.chinh_sach ?? [])[0]?.TenChinhSach ?? null,
    /** Phiếu đã lên HĐMB / HĐGV / thanh lý — chỉ xem (web chi_xem) */
    ChiXem: r.chi_xem === true,
    /** Phiếu hoàn cọc gần nhất: null | CHO_DUYET | DA_HOAN (web TrangThaiHoan) */
    TrangThaiHoan: r.TrangThaiHoan ?? null,
    TotalRows: Number(r?.total_count) || 0,
  };
}

export const DatCocService = {
  /**
   * Danh sách phiếu đặt cọc.
   * filter (legacy UI): { TuNgay, DenNgay, DuAn, MaTT, inputSearch, Offset, Limit }
   *  - Offset: trang (từ 1); Limit: số dòng (mặc định 20).
   *  - DuAn  : mảng hoặc chuỗi id dự án (ma_da_code hoặc uuid). Phạm vi dự án do máy chủ áp theo JWT.
   */
  get: async (filter: any = {}) => {
    try {
      const limit = Math.max(1, Number(filter?.Limit ?? filter?.limit ?? 20));
      const page = Math.max(1, Number(filter?.Offset ?? filter?.offset ?? 1));
      const projects = await selectedProjectUuids(filter);
      // Có chọn dự án nhưng không đổi ra uuid nào → không có dữ liệu hợp lệ (web DepositListService)
      if (projects && projects.length === 0) return { data: [], totalRows: 0 };

      const maTTNum = Number(filter?.MaTT ?? filter?.maTT ?? 0);
      const base = {
        p_tu_khoa: String(filter?.inputSearch ?? filter?.keyword ?? "").trim() || null,
        p_tu_ngay: vnDayBound(filter?.TuNgay ?? filter?.tuNgay, false),
        p_den_ngay: vnDayBound(filter?.DenNgay ?? filter?.denNgay, true),
        p_ma_tt: Number.isFinite(maTTNum) && maTTNum > 0 ? maTTNum : null,
      };
      const call = async (projectId: string | null, p: number, size: number) => {
        const pa = pageArgs(p, size);
        const res = await callNv<any>("fn_nv_app_dat_coc_list", { ...base, p_du_an_id: projectId, p_trang: pa.p_page, p_so_dong: pa.p_size });
        return listResult(res);
      };

      let result: { rows: any[]; total: number };
      if (projects && projects.length > 1) {
        // Chọn nhiều dự án: hàm chỉ nhận 1 dự án ⇒ gọi từng dự án rồi gộp đúng trang
        const pages = await Promise.all(projects.map((id) => call(id, 1, page * limit)));
        result = mergeProjectPages(pages, page, limit, (r: any) => r?.ngay_coc ?? r?.ngay_nhap);
      } else {
        result = await call(projects?.[0] ?? null, page, limit);
      }
      return { data: result.rows.map(mapDepositRow), totalRows: result.total };
    } catch (error) {
      console.log("ERROR fn_nv_app_dat_coc_list:", errorMessage(error));
      return { data: [], totalRows: 0, error: true };
    }
  },

  /** Danh mục trạng thái đặt cọc (ô lọc) — listPgcStatuses. */
  getTT: async (_payload: any = {}) => listPgcStatuses(),

  /**
   * Chi tiết phiếu đặt cọc (như trang chi tiết web mở chứng từ DATCOC):
   * - Đầu phiếu: fn_nv_app_dat_coc_chi_tiet — dòng danh sách mới nhất (trạng thái hiện tại: vd vừa tự duyệt sau khi thu QR đủ cọc)
   *   + khách / giá của chứng từ (đã che trường theo nhóm) + loại căn, hướng + cờ nút QR (QuyenQR, DoiCanChoDuyet, TrangThaiHoan).
   * - Phiếu thu theo phiếu giữ chỗ (PaymentProgressService), chạy song song. Không tải lịch thanh toán: màn Đặt cọc chỉ hiện
   *   việc của khâu cọc (sếp 2026-11-17) — lịch thanh toán xem ở Hợp đồng.
   */
  getDepositDetail: async (payload: any = {}) => {
    const row = payload?.row ?? payload?.data ?? {};
    // uuid phiếu giữ chỗ (web: PhieuGiuChoId ?? MaPGC, MaPGC = pgc_id ?? id); không có thì id phiếu cọc — máy chủ tự quy về phiếu giữ chỗ
    const pgcId = row?.PhieuGiuChoId ?? payload?.PhieuGiuChoId ?? row?.MaPGC ?? payload?.MaPGC ?? row?.ID ?? null;
    if (!pgcId) return { data: row, phieuThu: [], tongDaThu: 0, receiptsError: true };

    const headerP = (async () => {
      try {
        const res = await callNv<any>("fn_nv_app_dat_coc_chi_tiet", { p_id: String(pgcId) });
        if (!res) return { ...row, QuyenQR: false };
        const dong = res.dong ? mapDepositRow(res.dong) : {};
        const pgc = res.doc?.pgc || {};
        const kh = res.doc?.khach_hang || null;
        const sp = res.san_pham || {};
        const h: any = { ...row, ...dong };
        h.DienTich = h.DienTich ?? num(pgc.dien_tich);
        h.DonGiaTT = h.DonGiaTT ?? num(pgc.don_gia_gom_vat);
        h.PhiBaoTri = num(pgc.phi_bao_tri) ?? h.PhiBaoTri;
        h.TongGiaGomVAT = num(pgc.gia_tri_hd) ?? h.TongGiaGomVAT;
        h.TongGiaTriHDMB = h.TongGiaTriHDMB ?? num(pgc.gia_tri_hd_sau_ck ?? pgc.gia_tri_hd);
        // Khách hiện tại của phiếu (đã che theo nhóm; khách công ty khác chỉ thấy qua chứng từ ⇒ cccd đã che)
        if (kh) {
          h.KhachHang = h.KhachHang || kh.ten_kh || kh.ten_cong_ty || "";
          h.DiDong = h.DiDong || kh.dien_thoai || "";
          h.Email = kh.email || "";
          h.SoCMND = kh.cccd || "";
          h.DiaChi = kh.dia_chi || "";
          h.MaSoKH = kh.ma_so_kh || "";
        }
        h.MaSP = h.MaSP || sp.ma_sp || "";
        h.MaSanPham = h.MaSanPham || sp.ky_hieu || "";
        h.LoaiCanHo = sp.loai_can || "";
        h.Huong = formatDirections(sp.huong_cua || undefined, sp.huong_bc || undefined);
        // Cờ nút "Tạo QR thanh toán" như web (lib/depositQr.canOfferDepositQr)
        h.QuyenQR = res.quyen?.payment_qr === true;
        h.DoiCanChoDuyet = res.doi_can_cho_duyet === true;
        return h;
      } catch (e) {
        console.log("ERROR fn_nv_app_dat_coc_chi_tiet:", errorMessage(e));
        // Không tải được ⇒ giữ dòng danh sách, khoá QR (fail-closed như quyền web)
        return { ...row, QuyenQR: false };
      }
    })();

    const [header, receipts] = await Promise.all([headerP, PaymentProgressService.getReceipts(String(pgcId))]);
    return {
      data: header,
      phieuThu: receipts.rows,
      tongDaThu: receipts.total,
      receiptsError: receipts.error,
    };
  },
};
