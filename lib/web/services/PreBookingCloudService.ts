// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/PreBookingCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * PreBookingCloudService — nghiệp vụ **Booking thiện chí** trên Cloud.
 *
 * Phần thân đã được tách theo nghiệp vụ trong thư mục `./preBooking`:
 *  - context.ts  : phiên đăng nhập, tiện ích, bộ giải mã tham chiếu → UUID
 *  - hydrate.ts  : JOIN dữ liệu hiển thị (khách hàng, dự án, căn, sàn…)
 *  - read.ts     : danh sách, chi tiết, thống kê
 *  - write.ts    : tạo mới, cập nhật, xóa mềm, khôi phục
 *  - status.ts   : duyệt, hủy, đồng bộ theo phiếu đặt cọc
 *  - assign.ts   : gán / hủy gán căn, gắn phiếu giữ chỗ
 *  - receipts.ts : tiền thu theo phiếu thu (tổng, danh sách)
 *  - vouchers.ts : lịch sử, đổi tên, phiếu gộp, phiếu hoàn
 *
 * File này chỉ giữ vai trò cổng vào để UI và các service khác không phải sửa
 * đường dẫn import.
 */
export {
  PreBookingCloudService,
  bookingMaCTDK,
  isAgencyAccount,
  agencyMaSan,
  sanValue,
  applyDeletedFilter,
  softDeletePatch,
  tenantUid,
  resolveProjectId,
  resolveProductId,
  resolvePgcId,
  resolveSanId,
  resetPreBookingCache,
  loadRefs,
  listOut,
  detailOut,
  mapRows,
} from "./preBooking";

export { default } from "./preBooking";
