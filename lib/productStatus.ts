/**
 * Trạng thái hiển thị của căn/dự án. Không import gì để test nạp trực tiếp được.
 * Tone ánh xạ sang cặp màu *Subtle / on*Subtle của Badge (đạt tương phản AA),
 * thay cho bảng màu nền đậm + chữ trắng cũ (vd xanh lá chữ trắng chỉ ~2,3:1).
 */

export type StatusTone = 'success' | 'info' | 'warning' | 'brand' | 'danger' | 'neutral';

export type UnitStatus =
  | 'available'
  | 'deposit'
  | 'holding'
  | 'pending_kitchen'
  | 'sold'
  | 'locked'
  | 'booking';

export const UNIT_STATUS_META: Record<UnitStatus, { label: string; tone: StatusTone }> = {
  available: { label: 'Trống', tone: 'success' },
  deposit: { label: 'Đã cọc', tone: 'info' },
  holding: { label: 'Giữ chỗ', tone: 'warning' },
  pending_kitchen: { label: 'Bếp chờ', tone: 'brand' },
  sold: { label: 'Đã bán', tone: 'danger' },
  locked: { label: 'Khoá', tone: 'neutral' },
  booking: { label: 'Booking', tone: 'warning' },
};

export function unitStatusMeta(status: unknown): { label: string; tone: StatusTone } {
  return typeof status === 'string' && status in UNIT_STATUS_META
    ? UNIT_STATUS_META[status as UnitStatus]
    : { label: 'Khác', tone: 'neutral' };
}

/** Trạng thái dự án → badge (nhận diện theo TenTT/MaTT như trang chủ cũ). */
export function projectStatus(p: any): { label: string; tone: StatusTone } {
  const tt = String(p?.TenTT || p?.ten_tt || '').trim();
  const ma = String(p?.MaTT ?? p?.ma_tt ?? '');
  if (tt === 'Đã bán' || ma === '2') return { label: tt || 'Đã bán', tone: 'danger' };
  if (tt === 'Đầu tư' || ma === '3') return { label: tt || 'Đầu tư', tone: 'brand' };
  return { label: tt || 'Đang bán', tone: 'success' };
}
