import axiosApiSupabase from "./axiosApiSupabase";

export const AuthSupabaseService = {
  login: async (payload: any) => {
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
