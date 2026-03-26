import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const PriceServices = {
  getBlock: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };

    return await axiosApi
      .post("api/admin/beeland/block", dataInit)
      .then((res) => res.data);
  },
};
