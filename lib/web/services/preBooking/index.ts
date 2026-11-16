// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — điểm gom dịch vụ.
 *
 * Giữ nguyên tên hàm công khai mà UI đang dùng (`BookingThienChi`), nhưng bên
 * trong được tách theo nghiệp vụ: đọc / ghi / trạng thái / gán căn / chứng từ.
 */
import { ok } from "./context";
import * as read from "./read";
import * as write from "./write";
import * as status from "./status";
import * as assign from "./assign";
import * as vouchers from "./vouchers";

export const PreBookingCloudService = {
  /* Danh sách & chi tiết */
  getList: read.getList,
  getById: read.getById,
  getByKH: read.getByKH,
  getByMPG: read.getByMPG,
  countByKH: read.countByKH,
  countActiveByCustomer: read.countActiveByCustomer,

  /* Thêm / sửa / xóa */
  add: write.add,
  delete: write.remove,
  restore: write.restore,

  /* Trạng thái (RPC fn_pre_booking_change_state — gửi mã hành động `Action`) */
  approve: status.approve,
  /* Gắn phiếu đặt cọc lập từ booking (fn_pre_booking_attach_deposit) */
  attachDeposit: status.attachDeposit,

  /* Gán căn */
  assign: assign.assign,
  unassign: assign.unassign,

  /* Đổi tên & lịch sử */
  rename: vouchers.rename,
  lsThuTien: vouchers.lsThuTien,
  lsDoiTen: vouchers.lsDoiTen,
  lsThaoTac: vouchers.lsThaoTac,
  lsGopBooking: vouchers.lsGopBooking,
  lsHoanBooking: vouchers.lsHoanBooking,

  /* Phiếu gộp */
  phieuGop: vouchers.phieuGop,
  phieuGopGetList: vouchers.phieuGopGetList,
  phieuGopChangeState: vouchers.phieuGopChangeState,
  phieuGopDelete: vouchers.phieuGopDelete,
  phieuGopRestore: vouchers.phieuGopRestore,

  /* Phiếu hoàn */
  phieuHoan: vouchers.phieuHoan,
  phieuHoanGetList: vouchers.phieuHoanGetList,
  phieuHoanChangeState: vouchers.phieuHoanChangeState,
  phieuHoanDelete: vouchers.phieuHoanDelete,
  phieuHoanRestore: vouchers.phieuHoanRestore,

  /* Danh mục sản phẩm đã đọc trực tiếp trên Cloud ở màn hình gán căn */
  getSPKhaDung: async (_payload: any) => ok([]),
  getSPTieuChi: async (_payload: any) => ok([]),
};

export {
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
} from "./context";
export { loadRefs, listOut, detailOut, mapRows } from "./hydrate";

export default PreBookingCloudService;
