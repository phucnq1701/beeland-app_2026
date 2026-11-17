// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/disabledReasons.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Tooltip lý do cho select bị vô hiệu hóa ở Cọc / HĐ, Phiếu tính giá, Booking (spec 2026-11-09-quy-can-theo-bo-loc-luoi §2).
 * Câu cho ô Quỹ căn: UNIT_FUND_LOCK_REASON_* trong salesConfig/unitFundPriceList (hook trả lockReason).
 */
import { SALES_COMPANY_LOAD_FAILED_HINT } from "./useSalesPolicyGate";

/** Ô khóa theo cổng "chọn Công ty bán hàng trước" (useSalesPolicyGate); `field` viết thường, vd "chính sách bán hàng" */
export function policyGateReason(gate: { locked: boolean }, field: string, loadFailed?: boolean): string | undefined {
  if (!gate.locked) return undefined;
  return loadFailed ? SALES_COMPANY_LOAD_FAILED_HINT : `Chọn Công ty bán hàng trước để chọn ${field}`;
}

/** Ô Công ty bán hàng bị khóa (useSalesCompanyControl): required = tài khoản chỉ có 1 công ty; ngược lại = không có công ty nào */
export function salesCompanyLockReason(disabled: boolean, required: boolean): string | undefined {
  if (!disabled) return undefined;
  return required ? "Tài khoản chỉ thuộc 1 công ty bán hàng" : "Tài khoản chưa được gắn công ty bán hàng";
}

export const CUSTOMER_FROM_BOOKING_REASON = "Khách hàng lấy theo booking, không đổi được";
export const AGENCY_FIXED_REASON = "Tài khoản đại lý: cố định theo đại lý của bạn";
