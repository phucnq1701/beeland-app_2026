// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/finance/interest-details/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { DonViLai } from "../interest-rates";

/** Tình trạng đối soát với bảng lãi ngân hàng gửi. */
export type ReconcileStatus = "match" | "missing" | "mismatch";

export const RECONCILE_STATUS_META: Record<ReconcileStatus, { label: string; color: string }> = {
  match: { label: "Khớp", color: "green" },
  missing: { label: "Thiếu", color: "orange" },
  mismatch: { label: "Không khớp", color: "red" },
};

/** Form (màn hình) gọi — máy chủ kiểm quyền theo form này */
export type InterestForm =
  | "/finance/overdue-interest"
  | "/finance/interest-incentives"
  | "/finance/debt-summary"
  | "/contracts/list"
  | "/contracts/investment"
  | "/sales/deposits";

/** Form danh sách lãi (không theo 1 phiếu giữ chỗ): chỉ 2 màn tài chính; mặc định Lãi quá hạn */
export type InterestListForm = "/finance/overdue-interest" | "/finance/interest-incentives";

export interface InterestDetailFilter {
  projectIds?: string[];
  /** Có `pgcId` (tab lịch sử HĐ / cọc): form là màn đang mở, máy chủ kiểm phạm vi phiếu giữ chỗ */
  pgcId?: string;
  keyword?: string;
  /** Không có `pgcId`: chỉ nhận `InterestListForm` (form khác ⇒ lỗi, không gửi) */
  form?: InterestForm;
  /** Ô "Công ty" — chỉ áp cho danh sách (không `pgcId`) */
  companyIds?: string[];
}

/** 1 dòng lãi gửi lên — ngày "YYYY-MM-DD" hoặc "" */
export interface InterestRowInput {
  fromDate: string;
  toDate: string;
  principalBase: number;
  principalPaid: number;
  principalPaidDate: string;
  days: number;
  interest: number;
  /** Lãi suất của dòng (đợt), đơn vị theo `donVi` (%/ngày hoặc %/năm); thiếu/0 → máy chủ dùng lãi suất của hợp đồng */
  rate?: number;
  /** Đơn vị của `rate`: ngay | nam; thiếu → máy chủ coi là ngay */
  donVi?: DonViLai;
  /** Đợt thanh toán của dòng (để chia phiếu "Thu tiền lãi" ghi đợt); thiếu → máy chủ đọc "Đợt N" trong ghi chú */
  dotTT?: number;
  /** Phiếu thu nguồn (cloud_cash_vouchers.id) của dòng lãi đã thu gốc; thiếu → máy chủ suy từ "PT <số>" cuối ghi chú */
  receiptId?: string;
  note: string;
}

export interface InterestSaveItem {
  pgcId: string;
  rate: number;
  rows: InterestRowInput[];
}

/**
 * Phạm vi thay khi lưu: paid = dòng có ngày thu trong [from, to]; unpaid = mọi dòng chưa trả gốc; all = cả hai;
 * selected = chỉ dòng của đúng phiếu thu (paid) / đợt (unpaid) gửi lên — phiếu/đợt đã thu lãi → lỗi PT409
 */
export interface InterestSaveScope {
  kind?: "all" | "paid" | "unpaid" | "selected";
  /** "YYYY-MM-DD" — chỉ áp cho dòng paid */
  from?: string;
  to?: string;
}

/** Phiếu thu / đợt có dòng lãi đã thu hoặc đã đối soát — `dots` khoá dạng "<pgc_id>:<đợt>" */
export interface InterestLockedKeys {
  receipts: Set<string>;
  dots: Set<string>;
}

export interface InterestSaveResult {
  contracts?: number;
  inserted: number;
  replaced: number;
  /** Dòng bỏ qua vì đợt / phiếu thu đó đã có lãi được thu / đối soát (không lưu trùng) */
  skipped?: number;
}

/** Kết quả xoá: `skipped` = dòng đã thu lãi / đã đối soát nên được giữ lại */
export interface InterestDeleteResult {
  deleted: number;
  skipped: number;
}

export interface InterestDetail {
  id: string;
  productCode: string;
  customer: string;
  phone: string;
  /** DD/MM/YYYY hoặc "" */
  fromDate: string;
  toDate: string;
  principalBase: number;
  principalPaid: number;
  principalPaidDate: string;
  days: number;
  rate: number;
  /** Đơn vị của `rate` */
  donVi: DonViLai;
  interest: number;
  note: string;
  collected: number;
  remain: number;
  bank: string;
  branch: string;
  reconcileStatus?: ReconcileStatus | null;
  reconcileNote?: string | null;
  reconciledAt?: string | null;
  MaCTDK?: string;
  MaDA?: string | null;
  MaSP?: string | null;
  MaPGC?: string | null;
  TenDA?: string;
  KyHieu?: string;
  SoHD?: string;
  NguoiNhap?: string;
  createdAt?: string | null;
  /** Đợt thanh toán của dòng lãi (dot_tt) — null với dữ liệu cũ */
  dotTT?: number | null;
  /** Công ty của chứng từ (dòng lãi) */
  CompanyIdChungTu?: string | null;
  TenCtyChungTu?: string;
  /** Nguồn tính (manual 171): job khi duyệt phiếu thu / chi, hoặc tự tính (lưu tay) — dòng cũ ⇒ TU_TINH */
  nguonTinh?: "PHIEU_THU" | "PHIEU_CHI" | "TU_TINH";
  /** Phiếu thu / chi kích hoạt job (khi nguồn là phiếu) */
  nguonPhieuId?: string | null;
  soPhieuNguon?: string | null;
}

type Num = number | string | null;

/** Phần tử `fn_interest_detail_list` — snake_case, số có thể là chuỗi */
export interface InterestDetailRaw {
  id?: string;
  ma_da?: string | null;
  ma_sp?: string | null;
  ma_pgc?: string | null;
  product_code?: string | null;
  customer?: string | null;
  phone?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  principal_base?: Num;
  principal_paid?: Num;
  principal_paid_date?: string | null;
  days?: Num;
  rate?: Num;
  don_vi?: string | null;
  interest?: Num;
  collected?: Num;
  remain?: Num;
  bank?: string | null;
  branch?: string | null;
  note?: string | null;
  reconcile_status?: string | null;
  reconcile_note?: string | null;
  reconciled_at?: string | null;
  created_at?: string | null;
  dot_tt?: number | null;
  ten_da?: string | null;
  ky_hieu?: string | null;
  so_hd?: string | null;
  ten_nguoi_nhap?: string | null;
  company_id?: string | null;
  ten_cong_ty?: string | null;
  nguon_tinh?: string | null;
  nguon_phieu_id?: string | null;
  job_id?: string | null;
  so_phieu_nguon?: string | null;
}
