/**
 * Quên mật khẩu (nhân viên + đại lý) — endpoint `functions/v1/staff-reset-password` của API .NET
 * (api-beeland-new `StaffResetPasswordService`): request → verify → reset; lỗi trả HTTP 400/500 `{ error }`.
 * Chỉ hàm thuần (không import) để test nạp trực tiếp.
 */

/** Như máy chủ (cloud-auth change-password + giới hạn Argon2). */
export const MIN_PASSWORD = 6;
export const MAX_PASSWORD = 256;
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
