// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/status.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — nghiệp vụ TRẠNG THÁI (duyệt, thu tiền, duyệt thu cọc, hủy duyệt, từ chối).
 *
 * A1: shim gọi `fn_pre_booking_change_state` — client chỉ gửi MÃ HÀNH ĐỘNG; máy chủ kiểm quyền / phạm vi / trạng thái nguồn,
 * tra trạng thái đích theo cấu hình tenant, ghi nhật ký và tự lập phiếu thu 36 khi đích là "đã duyệt" (lỗi lập phiếu ⇒ vẫn
 * duyệt + `warning`). Đồng bộ theo phiếu cọc nằm ở máy chủ (`_prebooking_sync_by_pgc`).
 */
import { PreBookingActions, type PreBookingAction } from "../sales/pre-booking-actions";
import { fail, failFrom, ok, uid } from "./context";

export interface ApprovePayload {
  Ids?: (number | null | undefined)[];
  ID?: number | null;
  Action?: PreBookingAction;
  /** Khoá cũ (`State`…) bị bỏ qua — máy chủ tra trạng thái đích */
  [legacy: string]: unknown;
}

/** Đổi trạng thái 1 hoặc nhiều phiếu booking theo mã hành động (`Action`). */
export const approve = async (payload: ApprovePayload) => {
  const action = payload?.Action;
  if (!action) return fail("Thiếu mã hành động");
  const ids = (payload?.Ids ?? [payload?.ID]).map(Number).filter(Boolean);
  if (!ids.length) return fail("Thiếu dữ liệu");
  try {
    const r = await PreBookingActions.changeState(ids, action);
    return ok(true, { items: r.items, ...(r.warning ? { warning: r.warning } : {}) });
  } catch (e) {
    return failFrom(e, "Không đổi được trạng thái booking");
  }
};

/**
 * Gắn phiếu đặt cọc vừa lập từ booking (thay `ganPGC` + `approve(CREATE_DEPOSIT)`): `MaPGC` = cloud_pgc_phieu_giucho.id;
 * không phải uuid ⇒ null, máy chủ tự tìm phiếu đặt cọc còn hiệu lực mới nhất của căn booking giữ.
 */
export const attachDeposit = async (payload: { MaBooking: number | string; MaPGC?: unknown }) => {
  const seq = Number(payload?.MaBooking);
  if (!seq) return fail("Thiếu dữ liệu");
  try {
    return ok(await PreBookingActions.attachDeposit(seq, uid(payload?.MaPGC)));
  } catch (e) {
    return failFrom(e, "Không gắn được phiếu đặt cọc");
  }
};
