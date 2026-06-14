import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BookingService = {
  getLockList: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/san-pham/danh-sach-lock-can", dataInit)
      .then((res) => res.data);
  },

  getLockDetail: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/lock-can-chi-tiet", dataInit)
      .then((res) => res.data);
  },

  lockCan: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/san-pham/lock-can", dataInit)
      .then((res) => res.data);
  },

  addImageBooking: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/beeland/add-images-booking", dataInit)
      .then((res) => res.data);
  },
  getListImageGC: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/hop-dong/anh-giu-cho", dataInit)
      .then((res) => res.data);
  },
};
