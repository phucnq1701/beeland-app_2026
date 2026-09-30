/**
 * Đếm ngược thời gian giữ chỗ. Không import gì để test nạp trực tiếp được.
 */

/** Dưới ngưỡng này (giây) đồng hồ chuyển màu đỏ. */
export const URGENT_THRESHOLD_SEC = 180;

/** Đọc hạn (ISO string, epoch ms, Date) thành ms; không đọc được → null. Dùng chung với lib/bookingProgress. */
export function toMs(value: unknown): number | null {
  let t = NaN;
  if (value instanceof Date) t = value.getTime();
  else if (typeof value === 'number') t = value;
  else if (typeof value === 'string' && value.trim()) t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** Số giây còn lại (không âm); không đọc được hạn → null. */
export function remainingSeconds(expiresAt: unknown, nowMs: number): number | null {
  const t = toMs(expiresAt);
  if (t === null) return null;
  return Math.max(0, Math.floor((t - nowMs) / 1000));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "mm:ss", từ 1 giờ trở lên "h:mm:ss"; âm → "00:00". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export type CountdownTone = 'none' | 'normal' | 'urgent' | 'expired';

export function countdownTone(seconds: number | null): CountdownTone {
  if (seconds === null) return 'none';
  if (seconds <= 0) return 'expired';
  if (seconds < URGENT_THRESHOLD_SEC) return 'urgent';
  return 'normal';
}
