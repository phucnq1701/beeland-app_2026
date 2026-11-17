/**
 * SHIM VIẾT TAY — thay web src/components/PriceSheet/priceSheetConstants.tsx (có icon lucide-react): cùng id / nhãn các bước,
 * không icon (app tự vẽ). Web đổi bước ⇒ sửa tại đây (tests/web-steps.test.cjs so id + thứ tự với web).
 */
/** Khách hàng đầu (bắt buộc chọn trước) — theo web fb2f8c5d, chủ dự án chốt 2026-11-16; 360 vẫn cuối */
export const PRICESHEET_STEPS = [
  { id: "customer", label: "Thông tin khách hàng" },
  { id: "product", label: "Sản phẩm & Chính sách" },
  { id: "schedule", label: "Lịch thanh toán" },
  { id: "customer360", label: "Thông tin 360 khách hàng" },
];
