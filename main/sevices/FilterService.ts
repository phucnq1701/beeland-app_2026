import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const FilterService = {
  getStatusSP: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/san-pham/trang-thai", dataInit)
      .then((res) => res.data);
  },
  getStatusTransaction: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
      Type: 1,
    };
    return await axiosApi
      .post("api/admin/hop-dong/trang-thai", dataInit)
      .then((res) => res.data);
  },
};
