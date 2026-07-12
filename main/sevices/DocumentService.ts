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

  getDocument: async (maKieuFile: any) => {
    return await axiosApi
      .get(`api/admin/danhmuc/loaitailieu/${maKieuFile}`)
      .then((res) => res.data);
  },
  getDetailDocument: async (payload: any) => {
    return await axiosApi
      .post("api/admin/du-an/tai-lieu/list", payload)
      .then((res) => res.data);
  },
  getDetailVideo: async (payload: any) => {
    return await axiosApi
      .post("api/admin/danhmuc/thuvienvideo/list", payload)
      .then((res) => res.data);
  },

  getIMG: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/beeland/get-ThuVienHinhAnh", dataInit)
      .then((res) => res.data);
  },
  getVideo: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/beeland/get-ThuVienVideo", dataInit)
      .then((res) => res.data);
  },
  getFolderVideo: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApi
      .post("api/duan/documents/get-list", dataInit)
      .then((res) => res.data);
  },
};
