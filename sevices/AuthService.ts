import axiosApi from "./axiosApi";

export const AuthService = {
  login: async (payload: any) => {
    return await axiosApi
      .post("api/login", payload)
      .then((res) => res.data);
  },
  forgotPassword: async (payload: any) => {
    return await axiosApi
      .post("api/FogotPassword", payload)
      .then((res) => res.data);
  },

  verifyOTP: async (payload: any) => {
    return await axiosApi
      .post("api/admin/Staff/Authentication_OTP", payload)
      .then((res) => res.data);
  },
  resetPassword: async (payload: any) => {
    return axiosApi
      .post("api/admin/Staff/RestPassword", payload)
      .then((res) => res.data);
  },
};
