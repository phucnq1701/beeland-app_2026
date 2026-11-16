/**
 * SHIM VIẾT TAY — thay web src/components/PriceSheet/priceSheetConstants.tsx (có icon lucide-react): cùng id / nhãn các bước,
 * không icon (app tự vẽ). Web đổi bước ⇒ sửa tại đây (test web-pricing so id với web).
 */
export const PRICESHEET_STEPS = [
  { id: "product", label: "Sản phẩm & Chính sách" },
  { id: "schedule", label: "Lịch thanh toán" },
  { id: "customer", label: "Thông tin khách hàng" },
  { id: "customer360", label: "Thông tin 360 khách hàng" },
];
