/**
 * Trạng thái phiếu tính giá – nhãn + màu Tag như web (phieu-tinh-gia/index.tsx cột "Trạng thái").
 * Màu là tên preset antd (StatusBadge tự đổi sang tông soft của app).
 */
export const PRICE_SHEET_STATUSES = [
  { value: "draft", label: "Nháp", color: "default" },
  { value: "sent", label: "Đã gửi", color: "blue" },
  { value: "approved", label: "Đã duyệt", color: "green" },
  { value: "rejected", label: "Từ chối", color: "red" },
] as const;

export function priceSheetStatus(v: any): { label: string; color: string } {
  const s = PRICE_SHEET_STATUSES.find((x) => x.value === v);
  return s ? { label: s.label, color: s.color } : { label: String(v || ""), color: "default" };
}

/** Như web: nút Duyệt tắt khi đã duyệt, Từ chối tắt khi đã từ chối */
export function canApprove(status: any): boolean {
  return status !== "approved";
}
export function canReject(status: any): boolean {
  return status !== "rejected";
}
