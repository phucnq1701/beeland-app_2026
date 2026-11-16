// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/company/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Dòng máy chủ trả (fn_dm_company_list / fn_dm_company_save — _dm_company_out) */
export interface CompanyRaw {
  id: string;
  ten_ct: string | null;
  ten_ct_vt: string | null;
  dia_chi: string | null;
  dien_thoai: string | null;
  fax: string | null;
  email: string | null;
  ma_so_thue: string | null;
  /** Người đại diện (cột cũ "Giám đốc") */
  giam_doc?: string | null;
  chuc_vu?: string | null;
  /** Ủy quyền (database/manual/167): số giấy, ngày (yyyy-MM-dd), người ủy quyền */
  so_uy_quyen?: string | null;
  ngay_uy_quyen?: string | null;
  nguoi_uy_quyen?: string | null;
  so_tai_khoan?: string | null;
  ten_ngan_hang?: string | null;
  ap_dung: boolean | null;
  loai_cong_ty: string | null;
  parent_id: string | null;
}

/** Công ty nội bộ (dm_companies.is_san khác true) trên màn Hệ thống > Công ty — tên trường cũ của UI */
export interface CompanyRow {
  /** uuid dm_companies.id */
  ID: string;
  Id: string;
  MaCT: string;
  /** Tên công ty (dm_companies.ten_ct_vt) */
  TenCTVT: string;
  /** Tên viết tắt (dm_companies.ten_ct) */
  TenCT: string | null;
  DiaChi: string | null;
  DienThoai: string | null;
  Fax: string | null;
  Email: string | null;
  MaSoThue: string | null;
  /** Người đại diện (dm_companies.giam_doc) */
  NguoiDaiDien: string | null;
  /** Chức vụ người đại diện (dm_companies.chuc_vu) */
  ChucVu: string | null;
  /** Số giấy ủy quyền (dm_companies.so_uy_quyen) */
  SoUyQuyen: string | null;
  /** Ngày ủy quyền yyyy-MM-dd (dm_companies.ngay_uy_quyen) */
  NgayUyQuyen: string | null;
  /** Người ủy quyền (dm_companies.nguoi_uy_quyen) */
  NguoiUyQuyen: string | null;
  /** Số tài khoản ngân hàng (dm_companies.so_tai_khoan) */
  SoTaiKhoan: string | null;
  /** Tên ngân hàng của tài khoản (dm_companies.ten_ngan_hang) */
  TenNganHang: string | null;
  /** false = Hoạt động, true = Ngừng (ngược dm_companies.ap_dung) */
  State: boolean;
  /** uuid công ty cấp trên */
  ParentId: string | null;
  /** Loại công ty: chu_dau_tu / cty_ban_hang / dai_ly / null (@/constants/phanPhoi) */
  LoaiCT: string | null;
}

export interface CompanyInput {
  /** uuid khi sửa; bỏ trống khi thêm */
  Id?: string | null;
  TenCTVT: string;
  TenCT?: string | null;
  DiaChi?: string | null;
  DienThoai?: string | null;
  Fax?: string | null;
  /** undefined = không gửi (máy chủ giữ giá trị cũ) */
  Email?: string | null;
  NguoiDaiDien?: string | null;
  ChucVu?: string | null;
  SoUyQuyen?: string | null;
  /** yyyy-MM-dd */
  NgayUyQuyen?: string | null;
  NguoiUyQuyen?: string | null;
  SoTaiKhoan?: string | null;
  TenNganHang?: string | null;
  State?: boolean;
  ParentId?: string | null;
  /** Có khoá (kể cả null) mới gửi loai_cong_ty — bỏ trống thì máy chủ giữ nguyên */
  LoaiCT?: string | null;
}

/** Đại lý thuộc 1 Công ty bán hàng (fn_dm_company_agency_list / _add / _remove — _dm_company_agency_rows) */
export interface CompanyAgencyRaw {
  id: string;
  ten_ct_vt: string | null;
  ten_ct: string | null;
  dien_thoai: string | null;
  dia_chi: string | null;
  ap_dung: boolean | null;
  linked_at: string | null;
  /** Nhân viên đang hoạt động của đại lý */
  so_nv: number | null;
  /** Số giỏ "Qua đại lý" của công ty này đang có đại lý */
  so_gio: number | null;
}

export interface CompanyAgencyRow {
  Id: string;
  TenCTVT: string;
  TenCT: string | null;
  DienThoai: string | null;
  DiaChi: string | null;
  /** false = Hoạt động, true = Ngừng */
  State: boolean;
  LinkedAt: string | null;
  SoNV: number;
  SoGio: number;
}

/** Dòng thô của fn_company_agency_map */
export interface CompanyAgencyMapRaw {
  companies?: { id?: string; ten_ct_vt?: string | null; ten_ct?: string | null; loai_cong_ty?: string | null; ap_dung?: boolean | null }[];
  links?: { company_id?: string; agency_id?: string }[];
}

/** fn_company_agency_map: CĐT / CTBH nội bộ + đại lý thuộc từng CTBH (đọc dùng chung, không chặn form) */
export interface CompanyAgencyMap {
  companies: { Id: string; TenCTVT: string; LoaiCT: string | null; State: boolean }[];
  /** id công ty → id các đại lý */
  agenciesOf: Map<string, Set<string>>;
  /** id đại lý → id các công ty bán hàng */
  companiesOf: Map<string, Set<string>>;
}

/** Phiên bản thông tin công ty theo ngày hiệu lực (fn_dm_company_version_list / _save / _delete — database/manual/164) */
export interface CompanyVersion {
  id: string;
  company_id: string;
  /** yyyy-MM-dd; thông tin ban đầu = 1900-01-01 */
  hieu_luc_tu: string;
  /** yyyy-MM-dd; null = đến nay (bản mới nhất) */
  hieu_luc_den: string | null;
  is_goc: boolean;
  dang_hieu_luc: boolean;
  sap_hieu_luc: boolean;
  ten_ct: string | null;
  ten_ct_vt: string | null;
  dia_chi: string | null;
  dien_thoai: string | null;
  fax: string | null;
  email: string | null;
  ma_so_thue: string | null;
  giam_doc: string | null;
  chuc_vu: string | null;
  so_uy_quyen: string | null;
  /** yyyy-MM-dd */
  ngay_uy_quyen: string | null;
  nguoi_uy_quyen: string | null;
  so_tai_khoan: string | null;
  ten_ngan_hang: string | null;
  ly_do: string | null;
  nguoi_tao_ten: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Ghi phiên bản: có id = sửa bản đó; không id = điều chỉnh mới (company_id + hieu_luc_tu bắt buộc) */
export type CompanyVersionInput = Partial<
  Pick<
    CompanyVersion,
    | "id" | "company_id" | "hieu_luc_tu" | "ten_ct" | "ten_ct_vt" | "dia_chi" | "dien_thoai" | "fax" | "email"
    | "ma_so_thue" | "giam_doc" | "chuc_vu" | "so_uy_quyen" | "ngay_uy_quyen" | "nguoi_uy_quyen" | "so_tai_khoan" | "ten_ngan_hang" | "ly_do"
  >
>;
