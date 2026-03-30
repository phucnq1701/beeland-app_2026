import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const DocumentService = {

  getStatusSP: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/san-pham/trang-thai", dataInit)
      .then((res) => res.data);
  },

  // ===== DOCUMENT =====
  get: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApi
      .post("api/duan/documents/get-list", dataInit)
      .then((res) => res.data);
  },

  add: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApi
      .post("api/duan/documents", dataInit)
      .then((res) => res.data);
  },

  edit: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApi
      .put("api/duan/documents", dataInit)
      .then((res) => res.data);
  },

  delete: async (id: string | number) => {
    return await axiosApi
      .delete(`api/duan/documents/${id}`)
      .then((res) => res.data);
  },

  // ===== DOCUMENT DETAIL =====
  getDetail: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApi
      .post("api/duan/documents/detail/get-list", dataInit)
      .then((res) => res.data);
  },

  addDetail: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApi
      .post("api/duan/documents/detail", dataInit)
      .then((res) => res.data);
  },

  editDetail: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApi
      .put("api/duan/documents/detail", dataInit)
      .then((res) => res.data);
  },

  deleteDetail: async (id: string | number) => {
    return await axiosApi
      .delete(`api/duan/documents/detail/${id}`)
      .then((res) => res.data);
  },

};