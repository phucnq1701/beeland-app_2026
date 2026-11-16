// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/hydrate.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — lớp JOIN dữ liệu hiển thị.
 *
 * Bảng booking chỉ lưu khóa UUID, nên mọi tên (khách hàng, dự án, sàn, căn,
 * khoảng giá, diện tích, người tạo) được nạp theo lô ở đây rồi ghép vào
 * shape cũ mà UI đang dùng.
 */
import {
  catalogNameByIds,
  companyNameByIds,
  customerMetaByIds,
  employeeNameByIds,
  pgcCodeByIds,
  productMetaByIds,
  projectMetaByIds,
  type CustomerMeta,
  type ProductMeta,
  type ProjectMeta,
} from "./context";

export interface BookingRefs {
  customers: Record<string, CustomerMeta>;
  projects: Record<string, ProjectMeta>;
  products: Record<string, ProductMeta>;
  catalogs: Record<string, string>;
  companies: Record<string, string>;
  employees: Record<string, string>;
  pgcs: Record<string, string>;
}

const EMPTY: BookingRefs = {
  customers: {},
  projects: {},
  products: {},
  catalogs: {},
  companies: {},
  employees: {},
  pgcs: {},
};

/** Nạp toàn bộ dữ liệu liên kết của một lô dòng booking (1 lượt / bảng). */
export const loadRefs = async (rows: any[]): Promise<BookingRefs> => {
  if (!rows?.length) return EMPTY;
  const pick = (key: string) => rows.map((r) => r?.[key]).filter(Boolean);

  // Sản phẩm nạp trước để suy ra dự án cho dòng thiếu da_project_id,
  // tránh phải join thêm ở tầng trang.
  const products = await productMetaByIds(pick("san_pham_id"));
  const projectIds = [
    ...pick("da_project_id"),
    ...Object.values(products).map((p) => p.projectId),
  ].filter(Boolean) as string[];

  const [customers, projects, catalogs, companies, employees, pgcs] =
    await Promise.all([
      customerMetaByIds(pick("khach_hang_id")),
      projectMetaByIds(projectIds),
      catalogNameByIds([...pick("khoang_gia_id"), ...pick("khoang_dt_id")]),
      companyNameByIds(pick("san_id")),
      employeeNameByIds([
        ...pick("created_by_id"),
        ...pick("nguoi_duyet_id"),
        ...pick("updated_by_id"),
      ]),
      pgcCodeByIds(pick("phieu_giu_cho_id")),
    ]);

  return { customers, projects, products, catalogs, companies, employees, pgcs };
};

/** Dòng danh sách (shape cũ của UI). */
export const listOut = (r: any, refs: BookingRefs, totalRow = 0): any => {
  const kh = r.khach_hang_id ? refs.customers[String(r.khach_hang_id)] : null;
  const sp = r.san_pham_id ? refs.products[String(r.san_pham_id)] : null;
  const projectId = r.da_project_id ?? sp?.projectId ?? null;
  const da = projectId ? refs.projects[String(projectId)] : null;
  const nguoiTao = r.created_by_id
    ? refs.employees[String(r.created_by_id)]
    : null;
  const nguoiDuyet = r.nguoi_duyet_id
    ? refs.employees[String(r.nguoi_duyet_id)]
    : null;

  return {
    TotalRow: totalRow,
    ID: Number(r.seq),
    UID: r.id,

    // Khách hàng
    MaKH: r.khach_hang_id ?? null,
    MaSoKH: kh?.MaSoKH ?? null,
    TenKH: kh?.TenKH ?? null,
    DiDong: kh?.DiDong ?? null,
    Email: kh?.Email ?? null,
    SoCMND: kh?.SoCMND ?? null,
    NgayCap: kh?.NgayCap ?? null,
    NoiCap: kh?.NoiCap ?? null,

    // Dự án / sàn (fallback theo dự án của sản phẩm khi phiếu thiếu da_project_id)
    ProjectId: projectId,
    MaDA: da?.MaDA ?? projectId,
    TenDA: da?.TenDA ?? null,
    CompanyIdChungTu: r.company_id ?? null,
    TenCtyChungTu: r.ten_cong_ty ?? null,
    MaSan: r.san_id ?? null,
    TenCTVT: r.san_id ? refs.companies[String(r.san_id)] ?? null : null,

    // Tiêu chí
    TenKhoangGia: r.khoang_gia_id
      ? refs.catalogs[String(r.khoang_gia_id)] ?? null
      : null,
    TenDT: r.khoang_dt_id ? refs.catalogs[String(r.khoang_dt_id)] ?? null : null,
    MaKhoangGia: r.khoang_gia_id ?? null,
    MaDienTich: r.khoang_dt_id ?? null,

    // Sản phẩm
    SanPhamId: r.san_pham_id ?? null,
    MaSP: sp?.MaSP ?? null,
    KyHieu: sp?.KyHieu ?? null,
    KyHieuSP: sp?.KyHieu ?? null,
    TenSP: sp?.KyHieu ?? null,

    // Phiếu giữ chỗ
    PhieuGiuChoId: r.phieu_giu_cho_id ?? null,
    MaPGC: r.phieu_giu_cho_id ?? null,
    SoPhieuGC: r.phieu_giu_cho_id
      ? refs.pgcs[String(r.phieu_giu_cho_id)] ?? null
      : null,

    // Tiền / trạng thái
    TienGiuCho: Number(r.tien_giu_cho) || 0,
    HanBooking: r.han_booking,
    FormCode: r.form_code,
    State: r.state,
    CreatedAt: r.created_at,
    IsDaThu: r.is_da_thu,
    TienThu: Number(r.tien_thu) || 0,
    SoTienThu: Number(r.tien_thu) || 0,
    TongTienThu: Number(r.tien_thu) || 0,
    LSDoiTenID: r.ls_doi_ten_id,
    MaPhieuHoan: r.ma_phieu_hoan,
    MaPhieuGop: r.ma_phieu_gop,
    IsChoDuyetGop: r.is_cho_duyet_gop,
    GhiChu: r.dien_giai,
    SoPhieu: r.so_phieu ?? `BK${r.seq}`,

    // Người thực hiện
    HoTen: nguoiTao ?? r.created_by_name ?? null,
    NguoiTao: nguoiTao ?? r.created_by_name ?? null,
    NgayDuyet: r.ngay_duyet ?? null,
    NgayXacNhan: r.ngay_duyet ?? null,
    NguoiDuyet: nguoiDuyet ?? r.nguoi_duyet ?? null,
    NguoiXacNhan: nguoiDuyet ?? r.nguoi_duyet ?? null,

    IsDeleted: r.deleted_at ? 1 : 0,
    DeletedAt: r.deleted_at ?? null,
    DeletedBy: r.deleted_by ?? null,
  };
};

const idList = (raw: any, key: string) =>
  (Array.isArray(raw) ? raw : []).map((v: any) =>
    typeof v === "object" ? v : { [key]: v }
  );

/** Dòng chi tiết (thêm tiêu chí tìm căn, đồng sở hữu, tài liệu). */
export const detailOut = (r: any, refs: BookingRefs): any => {
  const tc = r.tieu_chi || {};
  return {
    ...listOut(r, refs),
    MaKhu: tc.MaKhu ?? null,
    MaKhoangGia: r.khoang_gia_id ?? tc.MaKhoangGia ?? null,
    MaDienTich: r.khoang_dt_id ?? tc.MaDienTich ?? null,
    Tangs: idList(tc.Tangs, "MaTang").map((x: any) => ({
      ...x,
      MaKhu: tc.MaKhu ?? null,
    })),
    Huongs: idList(tc.Huongs, "MaHuong"),
    LoaiCans: idList(tc.LoaiCans, "MaLoaiCan"),
    Views: idList(tc.Views, "MaView"),
    ViTris: idList(tc.Vitris, "MaViTri"),
    KhoangTangs: idList(tc.KhoangTangs, "MaKhoangTang"),
    DongDungTens: r.dong_so_huu ?? [],
    TaiLieus: r.tai_lieus ?? [],
  };
};

/** Tiện ích: map cả lô dòng sang shape danh sách. */
export const mapRows = async (rows: any[], totalRow = 0) => {
  const refs = await loadRefs(rows);
  return rows.map((r) => listOut(r, refs, totalRow));
};
