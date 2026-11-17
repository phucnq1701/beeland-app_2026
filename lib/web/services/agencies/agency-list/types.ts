// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/agencies/agency-list/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Dòng đại lý trên màn Danh sách đại lý (dm_companies.is_san = true) — giữ tên trường cũ của UI */
export interface AgencyRow {
  /** uuid dm_companies.id (rowKey của bảng) */
  ID: string;
  Id: string;
  /** Tên đại lý (dm_companies.ten_ct_vt) */
  TenCTVT: string;
  /** Tên viết tắt (dm_companies.ten_ct) */
  TenCT: string | null;
  DiaChi: string | null;
  DienThoai: string | null;
  Fax: string | null;
  Email: string | null;
  /** Mã số thuế (dm_companies.ma_so_thue) */
  MaSoThue: string | null;
  /** Người đại diện (dm_companies.giam_doc — tên cột cũ "Giám đốc") */
  GiamDoc: string | null;
  /** Chức vụ người đại diện (dm_companies.chuc_vu) */
  ChucVu: string | null;
  /** Số tài khoản ngân hàng (dm_companies.so_tai_khoan) */
  SoTaiKhoan: string | null;
  /** Tên ngân hàng của tài khoản (dm_companies.ten_ngan_hang) */
  TenNganHang: string | null;
  /** false = Hoạt động, true = Ngừng (ngược dm_companies.ap_dung) */
  State: boolean;
  /** 'cty_ban_hang' | 'dai_ly' */
  LoaiCT: string | null;
}

export interface AgencyListFilter {
  keyword?: string | null;
  /** null = tất cả, false = Hoạt động, true = Ngừng */
  state?: boolean | null;
}

export interface AgencyInput {
  /** uuid khi sửa; bỏ trống khi thêm */
  Id?: string | null;
  TenCTVT: string;
  TenCT?: string | null;
  DiaChi?: string | null;
  DienThoai?: string | null;
  Fax?: string | null;
  /** undefined = không gửi (máy chủ giữ giá trị cũ) */
  Email?: string | null;
  MaSoThue?: string | null;
  GiamDoc?: string | null;
  ChucVu?: string | null;
  SoTaiKhoan?: string | null;
  TenNganHang?: string | null;
  State?: boolean;
  LoaiCT?: string | null;
}

/** Dòng đại lý máy chủ trả (fn_dm_agency_list / fn_dm_agency_save — _dm_agency_out) */
export interface AgencyRaw {
  id: string;
  ten_ct: string | null;
  ten_ct_vt: string | null;
  dia_chi: string | null;
  dien_thoai: string | null;
  fax: string | null;
  email: string | null;
  ma_so_thue?: string | null;
  giam_doc?: string | null;
  chuc_vu?: string | null;
  so_tai_khoan?: string | null;
  ten_ngan_hang?: string | null;
  ma_dl: string | null;
  ap_dung: boolean | null;
  loai_cong_ty: string | null;
  parent_id: string | null;
}
