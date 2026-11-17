// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/finance/interest-rates/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Đơn vị tỷ lệ lãi: "ngay" = %/ngày (mẫu số 1), "nam" = %/năm (chia 365) */
export type DonViLai = "ngay" | "nam";

/** Một dòng lãi suất của dự án (khoảng ngày đến hạn → tỷ lệ % theo đơn vị ngày/năm + số ngày không tính lãi) */
export interface ProjectInterestRate {
  id: string;
  projectId: string;
  /** "YYYY-MM-DD" */
  tuNgay: string;
  /** "YYYY-MM-DD" */
  denNgay: string;
  /** % theo `donVi` (%/ngày hoặc %/năm) */
  tyLe: number;
  donVi: DonViLai;
  soNgayKhongTinhLai: number;
  apDung: boolean;
  updatedAt?: string | null;
}

export interface InterestRateInput {
  id?: string | null;
  projectId: string;
  tuNgay: string;
  denNgay: string;
  tyLe: number;
  donVi: DonViLai;
  soNgayKhongTinhLai: number;
  apDung: boolean;
}

export interface InterestRateRaw {
  id: string;
  project_id: string;
  tu_ngay: string;
  den_ngay: string;
  ty_le: number | string;
  so_ngay_khong_tinh_lai: number | string | null;
  don_vi?: string | null;
  ap_dung: boolean;
  updated_at?: string | null;
}

/** Cài đặt lãi quá hạn riêng của hợp đồng (TTHopDong.LaiQHTyLe / LaiQHSoNgayKhongTinh / LaiQHDonVi; RPC trả `lai_qh`) — có thì thay lãi suất dự án */
export interface InterestOverride {
  /** % theo `donVi` */
  tyLe: number;
  soNgayKhongTinhLai: number;
  donVi: DonViLai;
}
