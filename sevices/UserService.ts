import axios from "axios";
import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Phản hồi /api/app/get-version (tên field giữ nguyên theo API, kể cả lỗi chính tả "Vesion"). */
export type StoreVersionResponse = {
  data?: { VesionIOS?: string | number; VesionAndroid?: string | number; linkIOS?: string; linkAndroid?: string };
};

export const UserService = {
  getTransactions: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/hop-dong/giu-cho", JSON.stringify(dataInit))
      .then((res) => res.data);
  },
  userInfo: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/UserInfo", JSON.stringify(dataInit))
      .then((res) => res.data);
  },
  // checkVersion: async () => {
  //   return await axiosApi
  //     .post("/api/app/get-version", {
  //       MaLoaiApp: 5,
  //     })
  //     .then((res) => res.data);
  // },
  async checkVersion(): Promise<StoreVersionResponse | null> {
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
