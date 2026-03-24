import axios from "axios";
import axiosApi from "./axiosApi";

export const AuthService = {
  login: async (payload: any) => {
    return await axiosApi.post("api/login", payload).then((res) => res.data);
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
  async checkVersion(): Promise<null> {
    let response = await axios.post(
      `https://api-bms.beesky.vn/api/app/get-version`,
      { MaLoaiApp: 1 },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  },
};
