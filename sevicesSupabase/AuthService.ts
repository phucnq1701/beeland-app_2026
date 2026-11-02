import axiosApiSupabase from "./axiosApiSupabase";

export const AuthSupabaseService = {
  login: async (payload: any) => {
    return await axiosApiSupabase
      .post("functions/v1/cloud-auth", payload)
      .then((res) => res.data);
  },
  /**
   * Kiểm tra mật khẩu (bật Face ID ở màn Tài khoản): cloud-auth không có action riêng → `login` rồi `logout` ngay
   * phiên vừa cấp (login chỉ thêm phiên, không thu hồi phiên đang dùng – beeland supabase/functions/cloud-auth).
   * Lỗi mạng → ném.
   */
  verifyPassword: async (
    account: { loginType: "INTERNAL" | "AGENCY"; companyCode: string; username: string },
    password: string
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    const res = await AuthSupabaseService.login({
      action: "login",
      maCTDK: account.companyCode,
      email: account.username,
      password,
      typeAccount: account.loginType === "AGENCY" ? "AGENCY" : "SYSTEM",
    });
    if (res?.status !== 200) return { ok: false, message: res?.message || "Mật khẩu không đúng" };
    const token = res?.token ?? res?.data?.token;
    if (token) {
      void axiosApiSupabase.post("functions/v1/cloud-auth", { action: "logout", token }).catch(() => undefined);
    }
    return { ok: true };
  },
  loginAgency: async (payload: any) => {
    return await axiosApiSupabase
      .post("functions/v1/cloud-auth", payload)
      .then((res) => res.data);
  },
  forgotPassword: async (payload: any) => {
    return await axiosApiSupabase
      .post("api/FogotPassword", payload)
      .then((res) => res.data);
  },

  verifyOTP: async (payload: any) => {
    return await axiosApiSupabase
      .post("api/admin/Staff/Authentication_OTP", payload)
      .then((res) => res.data);
  },
  resetPassword: async (payload: any) => {
    return axiosApiSupabase
      .post("api/admin/Staff/RestPassword", payload)
      .then((res) => res.data);
  },
};
