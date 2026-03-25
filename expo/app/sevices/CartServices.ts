import axios from "axios";
import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CartService = {
  getSearchCustomer: async (name: string) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      inputSearch: name,
    };

    return await axiosApi
      .post("api/beeland/search-customer", dataInit)
      .then((res) => res.data);
  },

  addCustomer: async (payload: any) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };

    return await axiosApi
      .post("api/beeland/add-customer", dataInit)
      .then((res) => res.data);
  },

  addBooking: async (payload: any) => {
    return await axiosApi
      .post("api/admin/san-pham/add-booking", payload)
      .then((res) => res.data);
  },

  getBanks: async () => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
    };

    return await axiosApi
      .post("api/beeland/banks", dataInit)
      .then((res) => res.data);
  },

  confirmReceipt: async (payload: any) => {
    return await axiosApi
      .post("api/beeland/confirm-receipt", payload)
      .then((res) => res.data);
  },

  confirmReceiptUpload: async (formData:any) => {
    const res = await axios.post(
      "https://apibeehomecore.appbeesky.com/api/BeeHomeAdmin/uploadFile",
      formData,
      {
        headers: {
          CompanyCode: "beesky",
          Type: "BookingApp",
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return res.data;
  },
};
