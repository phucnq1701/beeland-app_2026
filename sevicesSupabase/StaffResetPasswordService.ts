import axiosApiSupabase from "./axiosApiSupabase";
import { staffResetMock } from "../mocks/staffResetPassword";
import { normalizeLogin } from "../lib/staffResetPassword";

/**
 * Quên mật khẩu tự phục vụ (nhân viên nội bộ + đại lý) — `functions/v1/staff-reset-password` của API .NET
 * (api-beeland-new `StaffResetPasswordService`, nhánh staff-reset-password). Lỗi: axios ném, `response.data = { error, retryAfter? }`
 * → đọc bằng `lib/staffResetPassword.resetErrorMessage / retryAfterOf`.
 * Bản giả: `EXPO_PUBLIC_STAFF_RESET_MOCK=1` (mã 123456) — dùng khi BE chưa triển khai, tắt bằng cách bỏ biến.
 */
export type ResetRequestResult = { otpId: string; expiresIn: number; resendAfter: number; message: string };
export type ResetVerifyResult = { resetToken: string; expiresIn: number };

const USE_MOCK = process.env.EXPO_PUBLIC_STAFF_RESET_MOCK === "1";
const post = async (body: Record<string, unknown>) =>
  USE_MOCK ? staffResetMock(body) : (await axiosApiSupabase.post("functions/v1/staff-reset-password", body)).data;

export const StaffResetPasswordService = {
  /** Gửi mã OTP tới email đăng ký (máy chủ trả cùng dạng dù tài khoản có email hay không). */
  request: async (companyCode: string, account: string): Promise<ResetRequestResult> =>
    post({ action: "request", ...normalizeLogin(companyCode, account) }),

  verify: async (otpId: string, code: string): Promise<ResetVerifyResult> => post({ action: "verify", otpId, code }),

  reset: async (resetToken: string, newPassword: string): Promise<{ message: string }> =>
    post({ action: "reset", resetToken, newPassword }),
};
