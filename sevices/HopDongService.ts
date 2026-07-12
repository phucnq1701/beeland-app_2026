import axiosApi from "./axiosApi";

export const HopDongService = {
  get: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/ListHopDong", dataInit)
      .then((res) => res.data);
  },
  getDetailLTT: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/ChiTietLichTT", dataInit)
      .then((res) => res.data);
  },
  getDetailLST: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/ChiTietThuChi", dataInit)
      .then((res) => res.data);
  },
};
