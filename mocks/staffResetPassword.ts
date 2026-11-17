/**
 * Bản giả `functions/v1/staff-reset-password` (bật bằng EXPO_PUBLIC_STAFF_RESET_MOCK=1) — mã đúng 123456, sai 5 lần huỷ mã,
 * chờ 60 giây giữa hai lần gửi. Lỗi ném giống axios (`response.data.error`). Không đổi mật khẩu thật.
 */
let otp: { id: string; attempts: number; sentAt: number; used: boolean } | null = null;
let token: string | null = null;

const fail = (error: string, extra: Record<string, unknown> = {}) => {
  const e: any = new Error(error);
  e.response = { status: 400, data: { error, ...extra } };
  throw e;
};
const delay = () => new Promise((r) => setTimeout(r, 400));

export async function staffResetMock(body: Record<string, any>): Promise<any> {
  await delay();
  switch (body.action) {
    case "request": {
      if (!body.maCTDK || !body.account) fail("Vui lòng nhập mã công ty và tài khoản");
      const wait = otp ? 60 - Math.floor((Date.now() - otp.sentAt) / 1000) : 0;
      if (wait > 0) fail(`Vui lòng chờ ${wait} giây rồi gửi lại mã`, { retryAfter: wait });
      otp = { id: `mock-${Date.now()}`, attempts: 0, sentAt: Date.now(), used: false };
      return { success: true, otpId: otp.id, expiresIn: 600, resendAfter: 60, message: "Nếu tài khoản có email đăng ký, mã xác thực đã được gửi tới email đó." };
    }
    case "verify": {
      if (!otp || otp.id !== body.otpId || otp.used) fail("Mã xác thực đã hết hạn hoặc không còn hiệu lực, vui lòng gửi lại mã");
      if (body.code !== "123456") {
        otp!.attempts += 1;
        if (otp!.attempts >= 5) { otp!.used = true; fail("Mã xác thực đã hết hạn hoặc không còn hiệu lực, vui lòng gửi lại mã"); }
        fail(`Mã xác thực không đúng. Còn ${5 - otp!.attempts} lần thử`);
      }
      otp!.used = true;
      token = "0".repeat(64);
      return { success: true, resetToken: token, expiresIn: 900 };
    }
    case "reset": {
      if (!token || body.resetToken !== token) fail("Phiên đặt lại mật khẩu đã hết hạn, vui lòng thực hiện lại");
      token = null;
      return { success: true, message: "Đã đặt lại mật khẩu, vui lòng đăng nhập lại" };
    }
    default:
      return fail("Thao tác không hợp lệ");
  }
}
