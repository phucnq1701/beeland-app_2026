import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ProductService = {
  getProducts: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };

    return await axiosApi
      .post("api/admin/san-pham/chung-cu", dataInit)
      .then((res) => res.data);
  },

  getKhuVuc: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/project/list_khu", dataInit)
      .then((res) => res.data);
  },

  getBannerProduct: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/beeland/get-product-images", dataInit)
      .then((res) => res.data);
  },

  getDetailProducts: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/SanPham/ChiTiet", dataInit)
      .then((res) => res.data);
  },

  getGiuCho: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/giu-cho-chi-tiet", dataInit)
      .then((res) => res.data);
  },

  postDuyet: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/admin/giu-cho/xuly", dataInit)
      .then((res) => res.data);
  },
};
