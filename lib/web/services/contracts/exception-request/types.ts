// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/contracts/exception-request/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Loại yêu cầu ngoại lệ: Phiếu tính giá / Chính sách bán hàng / Lịch thanh toán */
export type ExceptionRequestLoai = "PTG" | "CSBH" | "TDTT";

export const EXCEPTION_REQUEST_LOAI: readonly ExceptionRequestLoai[] = ["PTG", "CSBH", "TDTT"];

/** Một dòng của fn_exception_request_active: đối tượng hết hạn được phép chọn cho giao dịch (ngoại lệ DA_DUYET) */
export interface ActiveExceptionItem {
  loai: ExceptionRequestLoai;
  /** uuid, chữ thường */
  doi_tuong_id: string;
}

export type ExceptionRequestStatus = "CHO_DUYET" | "DA_DUYET" | "TU_CHOI" | "HUY";

/** Một dòng của fn_exception_request_list */
export interface ExceptionRequestRow {
  id: string;
  so_phieu: string;
  phieu_giu_cho_id: string;
  da_project_id: string | null;
  ten_du_an: string | null;
  ma_quy_can: string | null;
  ten_quy_can: string | null;
  ma_sp: string | null;
  ma_giao_dich: string | null;
  ten_kh: string | null;
  loai: ExceptionRequestLoai;
  doi_tuong_id: string;
  ten_doi_tuong: string | null;
  /** YYYY-MM-DD — đầu mút bị vượt */
  han_doi_tuong: string | null;
  ly_do: string | null;
  trang_thai: ExceptionRequestStatus;
  nguoi_tao: string | null;
  created_at: string | null;
  nguoi_duyet: string | null;
  ngay_duyet: string | null;
  ly_do_tu_choi: string | null;
  nguoi_huy: string | null;
  ngay_huy: string | null;
  ly_do_huy: string | null;
}

export interface ExceptionRequestStats {
  tong: number;
  cho_duyet: number;
  da_duyet: number;
  tu_choi: number;
  huy: number;
}

export interface ExceptionRequestFilter {
  projectId?: string | null;
  loai?: ExceptionRequestLoai | null;
  trangThai?: ExceptionRequestStatus | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ExceptionRequestPage {
  rows: ExceptionRequestRow[];
  total: number;
  stats: ExceptionRequestStats;
}

/** Giao dịch chọn ở bước 4 của hộp tạo */
export interface ExceptionTxnOption {
  pgc_id: string;
  ma_sp: string | null;
  ma_giao_dich: string | null;
  ten_kh: string | null;
  giai_doan: number;
}

/** Phiếu / chính sách / lịch đang hết hạn có thể xin ngoại lệ */
export interface ExceptionObjectOption {
  id: string;
  ten: string;
  /** YYYY-MM-DD — đến ngày */
  het_han: string | null;
  tu_ngay: string | null;
}

export interface ExceptionRequestLog {
  id: string;
  hanh_dong: "TAO" | "DUYET" | "TU_CHOI" | "HUY" | "XOA";
  ghi_chu: string | null;
  nguoi_thuc_hien: string | null;
  created_at: string;
}
