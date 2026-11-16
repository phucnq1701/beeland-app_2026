// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/assign.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — nghiệp vụ GÁN CĂN.
 * (Thu tiền: phiếu thu loại 36/47 ở Thu chi — xem receipts.ts. Gắn phiếu đặt cọc: `status.attachDeposit`.)
 *
 * A1: shim gọi `fn_pre_booking_assign` / `fn_pre_booking_unassign` — máy chủ khoá booking + chuyển căn
 * (`fn_product_transaction` / `fn_product_recompute_status`) trong 1 giao dịch, dựng `assign_snapshot`, ghi nhật ký.
 */
import { PreBookingActions } from "../sales/pre-booking-actions";
import { fail, failFrom, ok, resolveProductId } from "./context";
import { bySeq } from "./read";

/** Gán căn cho phiếu booking (máy chủ kiểm căn "Mở bán", ngưỡng Tiền thu, trạng thái booking). */
export const assign = async (payload: any) => {
  const seq = Number(payload?.MaBooking ?? payload?.ID);
  const row = await bySeq(seq);
  if (!row) return fail("Không tìm thấy phiếu booking");

  const productId = await resolveProductId({
    MaSP: payload?.MaSP,
    KyHieu: payload?.KyHieu,
    projectId: row.da_project_id,
  });
  if (!productId) return fail("Không xác định được căn cần gán");

  try {
    await PreBookingActions.assign(seq, productId);
    return ok(true);
  } catch (e) {
    return failFrom(e, "Không gán được căn");
  }
};

/** Hủy gán căn — máy chủ trả booking về trạng thái trước khi gán, tính lại trạng thái căn. */
export const unassign = async (payload: any) => {
  const seq = Number(payload?.MaBooking ?? payload?.ID);
  if (!seq) return fail("Không tìm thấy phiếu booking");
  try {
    await PreBookingActions.unassign(seq);
    return ok(true);
  } catch (e) {
    return failFrom(e, "Không hủy gán căn được");
  }
};
