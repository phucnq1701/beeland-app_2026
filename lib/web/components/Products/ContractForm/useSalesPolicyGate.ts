// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/useSalesPolicyGate.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useCallback, useState } from "react";

/** Cổng "chọn Công ty bán hàng trước": chưa có công ty thì khóa chọn chính sách / chiết khấu (trừ chế độ chỉ xem) */
export const SALES_POLICY_GATE_HINT = "Chọn Công ty bán hàng để chọn chính sách bán hàng";

export const SALES_COMPANY_LOAD_FAILED_HINT = "Không tải được danh sách Công ty bán hàng, vui lòng tải lại trang";

export function useSalesPolicyGate(
  congTyBanHangId: string | null | undefined,
  readOnly?: boolean,
  /** Tải danh sách Công ty bán hàng lỗi: ô chọn không dùng được nên hiện câu báo lỗi thay câu nhắc chọn */
  loadFailed?: boolean,
): { locked: boolean; hint: string | null } {
  const locked = !readOnly && !congTyBanHangId;
  return { locked, hint: locked ? (loadFailed ? SALES_COMPANY_LOAD_FAILED_HINT : SALES_POLICY_GATE_HINT) : null };
}

/**
 * Người dùng đổi Công ty bán hàng: khác công ty đang có thì gọi `markEdited` (bật cờ kiểm lại mức chiết khấu theo công ty mới;
 * chứng từ mở lại chỉ đối soát khi có cờ). Mở phiếu không gọi hàm này nên không bỏ tick gì.
 */
export function onSalesCompanyChange(
  prev: string | null | undefined,
  next: unknown,
  set: (id: string | null) => void,
  markEdited: () => void,
): void {
  const id = next ? String(next) : null;
  if ((prev ?? "").toLowerCase() !== (id ?? "").toLowerCase()) markEdited();
  set(id);
}

/**
 * Cờ "người dùng đã đổi Công ty bán hàng": chỉ bật đối soát mức chiết khấu, KHÔNG đánh dấu phiếu đã sửa
 * (không tính lại giá / lịch thanh toán). Đặt lại mỗi khi nạp phiếu (cùng chỗ đặt lại "đã sửa").
 */
export function useCompanyChangeFlag(): { changed: boolean; mark: () => void; reset: () => void } {
  const [changed, setChanged] = useState(false);
  const mark = useCallback(() => setChanged(true), []);
  const reset = useCallback(() => setChanged(false), []);
  return { changed, mark, reset };
}

/**
 * Chứng từ có bắt buộc Công ty bán hàng không: phụ lục HĐ (`type2 === "appendix"`) nằm ngoài phạm vi phân bổ
 * theo công ty nên không bắt buộc, không khóa chính sách. HĐ chuyển nhượng vẫn bắt buộc (giao dịch mới).
 */
export function requiresSalesCompany(type2: string | null | undefined): boolean {
  return type2 !== "appendix";
}
