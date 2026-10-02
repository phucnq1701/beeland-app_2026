/**
 * Điều kiện + số tiền QR thanh toán đặt cọc (module DATCOC) – như web:
 *  - beeland/src/pages/sales/giao-dich/dat-coc/index.tsx (isApprovableMaTT: chỉ phiếu chờ duyệt)
 *  - beeland/src/services/ContractCloudService.ts (isPendingDepositStatus / isApprovedDepositStatus)
 *  - beeland/src/pages/sales/components/BookingVAQRDialog.tsx (số tiền = max(0, TienCoc - DaThu))
 * Không import gì để test nạp trực tiếp được.
 */

const fold = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();

/** "Đặt cọc chờ duyệt" là tên trong danh mục pgc_trang_thai (mã 8); các tên khác là dữ liệu cũ. */
const PENDING = ['Đặt cọc chờ duyệt', 'ĐC chờ duyệt', 'Chờ duyệt', 'Chờ xử lý', 'Đang chờ duyệt'].map(fold);
const APPROVED = ['Đặt cọc đã duyệt', 'ĐC đã duyệt'].map(fold);

const DEPOSIT_PENDING_CODE = 8;

/** Mã trạng thái dạng số từ item_code (có thể lẫn chữ) – cùng cách lọc của fn_deposit_list. */
export function statusCodeNum(v: unknown): number | null {
  const digits = String(v ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

export function isPendingDeposit(row: { TenTT?: unknown; MaTT?: unknown } | null | undefined): boolean {
  const name = fold(row?.TenTT);
  if (APPROVED.includes(name)) return false;
  // Web: tên trống cũng coi là chờ duyệt (trạng thái đầu của phiếu cọc)
  if (!name || PENDING.includes(name)) return true;
  return statusCodeNum(row?.MaTT) === DEPOSIT_PENDING_CODE;
}

/** Tiền cọc còn phải thu = số tiền trên mã QR. */
export function depositQrAmount(row: { TienCoc?: unknown; DaThu?: unknown } | null | undefined): number {
  const remain = (Number(row?.TienCoc) || 0) - (Number(row?.DaThu) || 0);
  return remain > 0 ? Math.round(remain) : 0;
}

export function canCreateDepositQr(
  row: { TenTT?: unknown; MaTT?: unknown; TienCoc?: unknown; DaThu?: unknown } | null | undefined
): boolean {
  return isPendingDeposit(row) && depositQrAmount(row) > 0;
}
