/**
 * Suy ra tiến độ 4 bước của booking từ dữ liệu đã có trong
 * BookingService.getBookingEditDetail (spec 5.3) – không gọi thêm API.
 * Hạn giữ chỗ đọc bằng cùng hàm với đồng hồ đếm ngược (lib/countdown.toMs).
 */
import { toMs } from './countdown';

export const BOOKING_STEPS = ['Giữ chỗ', 'Đã thu tiền', 'Đặt cọc', 'Hợp đồng'] as const;

export type BookingProgressInput = {
  /** Giai đoạn phiếu giữ chỗ: GIUCHO → DATCOC → HDMB. */
  giaiDoan?: string | null;
  daThu?: number | string | null;
  tienGiuCho?: number | string | null;
  /** PENDING | APPROVED | CANCELLED */
  state?: string | null;
  hetHanLuc?: string | number | Date | null;
};

export type BookingProgress = {
  current: 0 | 1 | 2 | 3;
  paid: boolean;
  cancelled: boolean;
  expired: boolean;
};

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.trim()) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getBookingProgress(b: BookingProgressInput, nowMs: number): BookingProgress {
  const stage = String(b.giaiDoan ?? '').toUpperCase();
  const beyondHold = stage === 'DATCOC' || stage === 'HDMB';
  const tienGiuCho = num(b.tienGiuCho);
  const paid = (tienGiuCho > 0 && num(b.daThu) >= tienGiuCho) || beyondHold;
  const cancelled = b.state === 'CANCELLED';

  const deadline = toMs(b.hetHanLuc);
  const expired =
    !paid &&
    !cancelled &&
    deadline !== null &&
    deadline <= nowMs &&
    (stage === '' || stage === 'GIUCHO');

  const current: BookingProgress['current'] =
    stage === 'HDMB' ? 3 : stage === 'DATCOC' ? 2 : paid ? 1 : 0;

  return { current, paid, cancelled, expired };
}
