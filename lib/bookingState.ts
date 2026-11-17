/**
 * Trạng thái hiển thị của booking (không import — test nạp được). Người dùng chốt 2026-10-16: màn Booking (nội bộ + đại lý)
 * chỉ hiện 3 trạng thái **Chờ duyệt · Đã duyệt · Huỷ booking**, theo trạng thái của chính booking (`cloud_bookings.state`,
 * cột "Trạng thái booking" của web `bookingColumns`), không theo trạng thái vòng đời phiếu (Đặt cọc chờ duyệt, HĐMB…).
 * Màu cố định như web: chờ duyệt cam, đã duyệt xanh, hết hạn / huỷ xám.
 */

export type BookingGroup = "PENDING" | "APPROVED" | "CANCELLED";
export type BookingTabKey = "ALL" | BookingGroup;

/** Trạng thái máy chủ thuộc nhóm "Huỷ booking" (gửi `p_states` của fn_booking_list). */
const CANCELLED_STATES = ["EXPIRED", "CANCELLED", "REJECTED", "WAITING_REFUND", "REFUNDED", "RELEASED"];

/** PENDING / rỗng (phiếu chưa có dòng booking – máy chủ coi là PENDING) ⇒ chờ duyệt; APPROVED ⇒ đã duyệt; còn lại ⇒ huỷ. */
export function bookingStateGroup(state: unknown): BookingGroup {
  const s = String(state ?? "").trim().toUpperCase();
  if (!s || s === "PENDING") return "PENDING";
  if (s === "APPROVED") return "APPROVED";
  return "CANCELLED";
}

const BADGE: Record<BookingGroup, { label: string; tone: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  APPROVED: { label: "Đã duyệt", tone: "success" },
  CANCELLED: { label: "Huỷ booking", tone: "neutral" },
};

export function bookingStateBadge(state: unknown) {
  return BADGE[bookingStateGroup(state)];
}

export const BOOKING_TABS: { key: BookingTabKey; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: BADGE.PENDING.label },
  { key: "APPROVED", label: BADGE.APPROVED.label },
  { key: "CANCELLED", label: BADGE.CANCELLED.label },
];

/** `p_states` cho tab; "Tất cả" / không rõ ⇒ null (không lọc). */
export function statesForTab(key: unknown): string[] | null {
  if (key === "PENDING") return ["PENDING"];
  if (key === "APPROVED") return ["APPROVED"];
  if (key === "CANCELLED") return [...CANCELLED_STATES];
  return null;
}
