import axiosApi from "./axiosApi";

export const DatCocService = {
  get: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/hop-dong/dat-coc", dataInit)
      .then((res) => res.data);
  },
  getTT: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/hop-dong/trang-thai", dataInit)
      .then((res) => res.data);
  },
};
