/**
 * Định dạng dùng chung (thay cho ~18 bản formatCurrency/formatDate viết lại ở từng màn).
 *
 * Không dùng Intl/toLocaleString: Hermes trên Android có thể thiếu locale vi-VN,
 * khi đó số sẽ hiện theo kiểu en-US. Tự nhóm hàng nghìn bằng regex cho ổn định.
 * File này không được import gì để test nạp trực tiếp được.
 */

export const EMPTY = '—';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function groupThousands(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "50.000.000"; không hợp lệ → "—". */
export function formatNumberVN(value: unknown): string {
  const n = toNumber(value);
  return n === null ? EMPTY : groupThousands(n);
}

/** "50.000.000 ₫"; không hợp lệ → "—". */
export function formatVND(value: unknown): string {
  const n = toNumber(value);
  return n === null ? EMPTY : `${groupThousands(n)} ₫`;
}

function trimDecimal(n: number, digits: number): string {
  const factor = 10 ** digits;
  return String(Math.round(n * factor) / factor).replace('.', ',');
}

/** "3,48 tỷ", "12,5 triệu"; dưới 1 triệu → formatVND. */
export function formatVNDShort(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${trimDecimal(abs / 1e9, 2)} tỷ`;
  if (abs >= 1e6) return `${sign}${trimDecimal(abs / 1e6, 1)} triệu`;
  return formatVND(n);
}

/** Lấy số từ chuỗi người dùng gõ ("50.000.000 ₫" → 50000000); rỗng → null. */
export function parseVND(text: string): number | null {
  const digits = String(text ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

function toDate(value: unknown): Date | null {
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === 'number') d = new Date(value);
  else if (typeof value === 'string' && value.trim()) d = new Date(value);
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "dd/MM/yyyy" theo giờ máy; không hợp lệ → "—". */
export function formatDate(value: unknown): string {
  const d = toDate(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : EMPTY;
}

/** "HH:mm dd/MM/yyyy" theo giờ máy; không hợp lệ → "—". */
export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())} ${formatDate(d)}` : EMPTY;
}

/** "0912 *** 486"; chuỗi ngắn hơn 7 ký tự giữ nguyên. */
export function maskPhone(phone: string | null | undefined): string {
  const s = String(phone ?? '').trim();
  if (s.length < 7) return s;
  return `${s.slice(0, 4)} *** ${s.slice(-3)}`;
}

/** Chữ cái đầu của 2 từ cuối ("Nguyễn Minh Anh" → "MA"); rỗng → "?". */
export function getInitials(name: string | null | undefined): string {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(-2)
    .map((w) => Array.from(w)[0])
    .join('')
    .toUpperCase();
}

/**
 * Bỏ dấu + chữ thường để tìm kiếm không phân biệt dấu ("Hà Nội" ↔ "ha noi").
 * Dùng khoảng ký tự tổ hợp U+0300–U+036F thay cho \p{Diacritic} vì Hermes cũ không hỗ trợ.
 */
export function foldVietnamese(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}
