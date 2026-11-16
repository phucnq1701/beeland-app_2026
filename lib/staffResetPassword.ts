/**
 * Quên mật khẩu (nhân viên + đại lý) — endpoint app `fn_nv_app_quen_mat_khau` (= edge staff-reset-password của API .NET)
 * (api-beeland-new `StaffResetPasswordService`): request → verify → reset; lỗi trả HTTP 400/500 `{ error }`.
 * Chỉ hàm thuần (không import) để test nạp trực tiếp.
 */

/**
 * Chính sách mật khẩu chung (sếp chốt 2026-11-10, giống web + máy chủ MatKhauChinhSach): tối thiểu 8 ký tự, ít nhất 1 chữ hoa,
 * 1 chữ thường, 1 số, 1 ký tự đặc biệt (không phải chữ / số / khoảng trắng).
 */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

export interface PasswordRule { key: string; label: string; hint?: string; ok: (pw: string) => boolean }

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'Tối thiểu 8 ký tự', ok: (p) => [...p].length >= MIN_PASSWORD && [...p].length <= MAX_PASSWORD },
  { key: 'upper', label: 'Có ít nhất 1 chữ cái viết hoa (A – Z)', ok: (p) => /\p{Lu}/u.test(p) },
  { key: 'lower', label: 'Có ít nhất 1 chữ cái viết thường (a – z)', ok: (p) => /\p{Ll}/u.test(p) },
  { key: 'digit', label: 'Có ít nhất 1 số (0 – 9)', ok: (p) => /\d/.test(p) },
  { key: 'special', label: 'Có ít nhất 1 ký tự đặc biệt', hint: '(ví dụ: ! @ # $ % ^ & * ...)', ok: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

/** Mật khẩu đạt đủ chính sách */
export const isStrongPassword = (pw: string) => PASSWORD_RULES.every((r) => r.ok(pw));
export const OTP_LENGTH = 6;

export const isOtpCode = (code: string) => /^[0-9]{6}$/.test(code);

/** Gửi lên như màn đăng nhập (máy chủ tự trim + chữ thường). */
export function normalizeLogin(companyCode: string, account: string) {
  return { maCTDK: String(companyCode ?? '').trim(), account: String(account ?? '').trim() };
}

/** Thông điệp lỗi cho người dùng: `{error}` / `{message}` của máy chủ; không có phản hồi → lỗi mạng; còn lại → fallback. */
export function resetErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (data && typeof data === 'object') {
    const msg = data.error ?? data.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (err && !err.response && err.message) return 'Không kết nối được máy chủ';
  return fallback;
}

/** Số giây phải chờ trước khi gửi lại mã (lỗi "Vui lòng chờ n giây…" kèm `retryAfter`). */
export function retryAfterOf(err: any): number | null {
  const v = Number(err?.response?.data?.retryAfter);
  return Number.isFinite(v) && v > 0 ? Math.ceil(v) : null;
}
