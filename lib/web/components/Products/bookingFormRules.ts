// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/bookingFormRules.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Quy tắc thuần của form Tạo / Sửa Booking (spec booking-ctbh-dai-ly).
 * Đại lý phân phối không bắt buộc (D4): chỉ cần đã chọn khách hàng.
 */
export function canSubmitBooking(i: { hasCustomer: boolean; submitting?: boolean }): boolean {
  return i.hasCustomer && !i.submitting;
}

/** Phần Tiến độ thanh toán của payload tạo booking: form không còn ô TĐTT (D6), phiếu Cọc tự chọn theo chính sách */
export function bookingScheduleFields(): { MaTDTT: null; LichThanhToan: never[]; TenLichThanhToan: null } {
  return { MaTDTT: null, LichThanhToan: [], TenLichThanhToan: null };
}

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Bỏ đại lý khi CTBH KHÔNG do người dùng đổi (đổi tay đã xử lý ở handler): phiếu mới — đại lý mặc định không thuộc CTBH; sửa phiếu — chỉ khi CTBH
 * khác giá trị đã lưu (vd phiếu cũ chưa có CTBH, ô tự gán CTBH của tài khoản), vì máy chủ (G2) sẽ chặn cặp CTBH mới + đại lý không liên kết.
 */
export function shouldClearAgency(i: {
  isEditMode: boolean;
  savedCtbhId: string | null | undefined;
  ctbhId: string | null | undefined;
  maSan: string | null | undefined;
  agenciesOf: Map<string, Set<string>> | null | undefined;
}): boolean {
  if (i.isEditMode && lc(i.savedCtbhId) === lc(i.ctbhId)) return false;
  const san = lc(i.maSan);
  const ctbh = lc(i.ctbhId);
  if (!san || !ctbh || !i.agenciesOf) return false;
  return !(i.agenciesOf.get(ctbh)?.has(san) ?? false);
}

/**
 * Sửa booking: không đổi chính sách ⇒ không gửi khóa TĐTT (giữ đã lưu); đổi / bỏ chính sách ⇒ xóa TĐTT cũ để phiếu Cọc tự chọn theo chính sách mới.
 */
export function editScheduleFields(savedPolicyId: string | null | undefined, policyId: string | null | undefined): { MaTDTT?: null; LichThanhToan?: never[] } {
  return lc(savedPolicyId) === lc(policyId) ? {} : { MaTDTT: null, LichThanhToan: [] };
}
