import axiosApi from "./axiosApi";

export const BaoCaoService = {
  getTongQuan: async (payload: any) => {
    return await axiosApi
      .post("api/bao-cao/summary", payload)
      .then((res) => res.data);
  },

  getThuTien: async (payload: any) => {
    return await axiosApi
      .post("api/bao-cao/thu-tien", payload)
      .then((res) => res.data);
  },
  getHopDong: async (payload: any) => {
    return await axiosApi
      .post("api/bao-cao/hop-dong", payload)
      .then((res) => res.data);
  },
  getSapHH: async (payload: any) => {
    return await axiosApi
      .post("api/bao-cao/sap-den-han", payload)
      .then((res) => res.data);
  },
  getDotQuaHan: async (payload: any) => {
    return await axiosApi
      .post("api/bao-cao/qua-han", payload)
      .then((res) => res.data);
  },
};
