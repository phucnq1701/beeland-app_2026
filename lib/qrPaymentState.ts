/**
 * Trạng thái hiển thị của màn Thanh toán QR (spec 5.4, 5.5).
 * Thứ tự ưu tiên quyết định màn hiện gì khi nhiều điều kiện cùng đúng.
 * Không import gì để test nạp trực tiếp được.
 */

export type QrScreenState =
  | 'loading'
  | 'error'
  | 'paid'
  | 'noDeadline'
  | 'expired'
  | 'mismatch'
  | 'active'
  | 'needsNewQr'
  | 'needsQr';

export type QrScreenInput = {
  loading: boolean;
  loadError: string | null;
  paid: boolean;
  hasActiveVa: boolean;
  amountMismatch: boolean;
  /** Giây còn lại của hạn giữ chỗ; null = booking chưa có hạn. */
  remainingSec: number | null;
  /** Booking từng có mã QR nhưng đã bị huỷ/hết hạn. */
  hadPreviousQr: boolean;
};

export function getQrScreenState(i: QrScreenInput): QrScreenState {
  if (i.loading) return 'loading';
  if (i.loadError) return 'error';
  if (i.paid) return 'paid';
  if (i.remainingSec === null) return 'noDeadline';
  if (i.remainingSec <= 0) return 'expired';
  if (i.hasActiveVa && i.amountMismatch) return 'mismatch';
  if (i.hasActiveVa) return 'active';
  if (i.hadPreviousQr) return 'needsNewQr';
  return 'needsQr';
}
