// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/company/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { CompanyAgencyMap, CompanyAgencyMapRaw, CompanyAgencyRaw, CompanyAgencyRow, CompanyInput, CompanyRaw, CompanyRow } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown) => UUID_RE.test(String(v ?? "").trim());

const str = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s || null;
};

/** Dòng fn_dm_company_list / fn_dm_company_save → dòng UI */
export const toCompanyRow = (r: Partial<CompanyRaw> | null | undefined): CompanyRow => {
  const id = String(r?.id ?? "");
  return {
    ID: id,
    Id: id,
    MaCT: id,
    TenCTVT: r?.ten_ct_vt ?? "",
    TenCT: r?.ten_ct ?? null,
    DiaChi: r?.dia_chi ?? null,
    DienThoai: r?.dien_thoai ?? null,
    Fax: r?.fax ?? null,
    Email: r?.email ?? null,
    MaSoThue: r?.ma_so_thue ?? null,
    NguoiDaiDien: r?.giam_doc ?? null,
    ChucVu: r?.chuc_vu ?? null,
    SoUyQuyen: r?.so_uy_quyen ?? null,
    NgayUyQuyen: r?.ngay_uy_quyen ? String(r.ngay_uy_quyen).slice(0, 10) : null,
    NguoiUyQuyen: r?.nguoi_uy_quyen ?? null,
    SoTaiKhoan: r?.so_tai_khoan ?? null,
    TenNganHang: r?.ten_ngan_hang ?? null,
    // ap_dung: true = Hoạt động; UI State: true = Ngừng
    State: r?.ap_dung === false,
    ParentId: r?.parent_id ? String(r.parent_id) : null,
    LoaiCT: r?.loai_cong_ty ?? null,
  };
};

/**
 * Form → jsonb của fn_dm_company_save (tenant / is_san do máy chủ gán).
 * Không gửi mã số thuế — form không có, máy chủ giữ nguyên. Loại công ty, email, người đại diện, chức vụ, ủy quyền, tài khoản ngân hàng
 * chỉ gửi khi người gọi truyền khoá (vắng mặt ⇒ máy chủ giữ giá trị cũ).
 */
export const toCompanyPayload = (input: CompanyInput): Record<string, unknown> => {
  const p: Record<string, unknown> = {};
  if (isUuid(input.Id)) p.id = String(input.Id).trim();
  p.ten_ct_vt = str(input.TenCTVT);
  p.ten_ct = str(input.TenCT);
  p.dia_chi = str(input.DiaChi);
  p.dien_thoai = str(input.DienThoai);
  p.fax = str(input.Fax);
  p.ap_dung = !input.State;
  p.parent_id = isUuid(input.ParentId) ? String(input.ParentId).trim() : null;
  if (input.LoaiCT !== undefined) p.loai_cong_ty = str(input.LoaiCT);
  if (input.Email !== undefined) p.email = str(input.Email);
  if (input.NguoiDaiDien !== undefined) p.giam_doc = str(input.NguoiDaiDien);
  if (input.ChucVu !== undefined) p.chuc_vu = str(input.ChucVu);
  if (input.SoUyQuyen !== undefined) p.so_uy_quyen = str(input.SoUyQuyen);
  if (input.NgayUyQuyen !== undefined) p.ngay_uy_quyen = str(input.NgayUyQuyen);
  if (input.NguoiUyQuyen !== undefined) p.nguoi_uy_quyen = str(input.NguoiUyQuyen);
  if (input.SoTaiKhoan !== undefined) p.so_tai_khoan = str(input.SoTaiKhoan);
  if (input.TenNganHang !== undefined) p.ten_ngan_hang = str(input.TenNganHang);
  return p;
};

/** Dòng đại lý của công ty → dòng UI */
export const toCompanyAgencyRow = (r: Partial<CompanyAgencyRaw> | null | undefined): CompanyAgencyRow => ({
  Id: String(r?.id ?? ""),
  TenCTVT: r?.ten_ct_vt || r?.ten_ct || "(chưa đặt tên)",
  TenCT: r?.ten_ct ?? null,
  DienThoai: r?.dien_thoai ?? null,
  DiaChi: r?.dia_chi ?? null,
  State: r?.ap_dung === false,
  LinkedAt: r?.linked_at ?? null,
  SoNV: Number(r?.so_nv ?? 0),
  SoGio: Number(r?.so_gio ?? 0),
});

const lower = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** fn_company_agency_map → bản đồ tra 2 chiều (uuid chữ thường) */
export const toCompanyAgencyMap = (raw: CompanyAgencyMapRaw | null | undefined): CompanyAgencyMap => {
  const agenciesOf = new Map<string, Set<string>>();
  const companiesOf = new Map<string, Set<string>>();
  (Array.isArray(raw?.links) ? raw.links : []).forEach((l) => {
    const c = lower(l?.company_id);
    const a = lower(l?.agency_id);
    if (!c || !a) return;
    if (!agenciesOf.has(c)) agenciesOf.set(c, new Set());
    if (!companiesOf.has(a)) companiesOf.set(a, new Set());
    agenciesOf.get(c)!.add(a);
    companiesOf.get(a)!.add(c);
  });
  return {
    companies: (Array.isArray(raw?.companies) ? raw.companies : []).map((c) => ({
      Id: lower(c?.id),
      TenCTVT: c?.ten_ct_vt || c?.ten_ct || "(chưa đặt tên)",
      LoaiCT: c?.loai_cong_ty ?? null,
      State: c?.ap_dung === false,
    })),
    agenciesOf,
    companiesOf,
  };
};
