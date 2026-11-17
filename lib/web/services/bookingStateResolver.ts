// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/bookingStateResolver.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import {
  BookingStatusConfigService,
  BookingStatusConfig,
  DEFAULT_BOOKING_STATUSES,
} from "./BookingStatusConfigService";

/**
 * Resolver trạng thái đích cho các hành động nghiệp vụ Booking thiện chí.
 *
 * Thay vì hard-code mã trạng thái trong từng thao tác (gán căn, duyệt gộp,
 * hoàn booking...), các service sẽ hỏi resolver này: "hành động X thì phiếu
 * chuyển sang trạng thái nào?" — kết quả lấy theo "Cấu hình trạng thái booking"
 * của công ty đăng ký hiện tại (Bán hàng → Cài đặt). Nếu chưa cấu hình hoặc
 * hành động chưa được gắn cho trạng thái nào thì dùng mã mặc định (fallback).
 */

let cache: BookingStatusConfig[] | null = null;
let inflight: Promise<BookingStatusConfig[]> | null = null;
/** Cache phải gắn với công ty đăng ký đang đăng nhập (multi-tenant) */
let cacheTenant: string | null = null;

export const invalidateBookingStateResolver = () => {
  cache = null;
  inflight = null;
  cacheTenant = null;
};

const load = (): Promise<BookingStatusConfig[]> => {
  const tenant = BookingStatusConfigService.maCTDK();
  if (cacheTenant !== tenant) {
    cache = null;
    inflight = null;
    cacheTenant = tenant;
  }
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = BookingStatusConfigService.list()
      .then((rows) => {
        cache = rows?.length ? rows : DEFAULT_BOOKING_STATUSES;
        return cache;
      })
      .catch(() => {
        inflight = null;
        return DEFAULT_BOOKING_STATUSES;
      });
  }
  return inflight;
};

/**
 * Trả về MÃ trạng thái áp dụng cho hành động `action`.
 * @param action mã hành động trong BOOKING_ACTIONS (vd: ASSIGN_PRODUCT)
 * @param fallback mã trạng thái mặc định nếu chưa cấu hình
 */
export const stateFor = async (
  action: string,
  fallback: string
): Promise<string> => {
  try {
    const items = await load();
    const found = BookingStatusConfigService.statusForAction(items, action);
    return found?.code || fallback;
  } catch {
    return fallback;
  }
};

export default stateFor;
