import axios from "axios";
import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CongViecService = {
  addGhiChuCV: async (payload: any) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/KhachHang/AddNhatKy", dataInit)
      .then((res) => res.data);
  },
  addLichHen: async (payload: any) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/KhachHang/AddLichSuLamViec", dataInit)
      .then((res) => res.data);
  },
};
