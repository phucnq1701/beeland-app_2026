// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/stepGate.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Khoá tab tới khi chọn khách (spec 2026-11-16-csbh-so-luong-kho-tab-khach §2) — dùng chung cho thanh bước của Phiếu tính giá và Hợp đồng.
 * Chưa có khách (mã KH) ⇒ mọi bước khác bước Khách hàng bị khoá. Không khoá khi bước khách đã khoá sẵn (đổi căn TTĐC: khách thừa kế phiếu cũ)
 * hoặc khi tắt cổng (`off`: phiếu mẫu không có bước khách, phiếu cũ mở để xem — lưu vẫn bắt chọn khách).
 */
export const CUSTOMER_FIRST_TIP = "Chọn khách hàng trước";

export function stepLocked(
  stepId: string | undefined,
  opts: { hasCustomer: boolean; customerStepId: string; customerLocked?: boolean; off?: boolean },
): boolean {
  if (!stepId || opts.off || opts.customerLocked || opts.hasCustomer) return false;
  return stepId !== opts.customerStepId;
}
