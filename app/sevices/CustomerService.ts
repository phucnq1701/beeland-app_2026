import axiosApi from "./axiosApi";

export const CustomerService = {
  getCustomers: async (payload: any = "") => {
    const init = {
      inputSearch: payload,
      MaTT: 0,
      MaNVCS: 0,
      MaNKH: 0,
      Offset: 1,
      Limit: 50,
    };
    return await axiosApi
      .post("api/admin/Getlist_Customer", init)
      .then((res) => res.data);
  },

  

  getCustomer: async (payload: any = {}) => {
    return await axiosApi
      .post("api/admin/Customer/ViewChiTiet", payload)
      .then((res) => res.data);
  },

  addCustomer: async (payload: any = {}) => {
    const init = {
      MaKH: payload.maKH,
      TenKH: payload.hoTen,
      MaSoKH: "",
      MaQD: 7,
      NgaySinh: null,
      SoCMND: payload.soCMND,
      NgayCap: null,
      NoiCap: "",
      DiDong: payload.diDong,
      DiDong2: "",
      Email: payload.email,
      Email2: "",
      PurposeID: 5,
      ThuongTru: payload.diaChi,
      MaXa: null,
      MaHuyen: null,
      MaTinh: null,
      DiaChi: payload.diaChi,
      MaXa2: null,
      MaTinh2: null,
      MaHuyen2: null,
      MaNKH: payload.maNKH,
      HowToKnowID: payload.maNguon,
      MaNN: null,
      MaTT: 1,
      GhiChu: payload.ghiChu,
    };
    console.log(init, "init");

    return await axiosApi
      .post("api/admin/AddCustom", init)
      .then((res) => res.data);
  },

  delete: async (payload: any = {}) => {
    return await axiosApi
      .post("api/admin/DelteteCustomer", payload)
      .then((res) => res.data);
  },

  getNguonKH: async () => {
    return await axiosApi.get("api/admin/NguonDen").then((res) => res.data);
  },

  getNhomKH: async () => {
    return await axiosApi.get("api/admin/NhomKH").then((res) => res.data);
  },

  getTrangThaiKH: async () => {
    return await axiosApi.get("api/admin/khTrangThai").then((res) => res.data);
  },

  // ghi chú
  getGhiChunByMaKH: async (payload: any = {}) => {
    return await axiosApi
      .post("api/admin/KhachHang/ListNhatKyKH", payload)
      .then((res) => res.data);
  },

  addGhiChu: async (payload: any = {}) => {
    const init = {
      ID: payload.ID,
      MaKH: payload.MaKH,
      MaTT: payload.MaTT,
      DienGiai: payload.DienGiai,
    };

    return await axiosApi
      .post("api/admin/KhachHang/AddNhatKy", init)
      .then((res) => res.data);
  },

  // lịch hẹn
  getLichHenByMaKH: async (payload: any = {}) => {
    return await axiosApi
      .post("api/admin/KhachHang/List_LichSuLamViec", payload)
      .then((res) => res.data);
  },

  getLichHen: async (payload: any = {}) => {
    return await axiosApi
      .post("api/admin/KhachHang/List_LichSuLamViec", payload)
      .then((res) => res.data);
  },

  addLichHen: async (payload: any = {}) => {
    const init = {
      MaLH: payload.MaLH,
      MaKH: payload.MaKH,
      NgayHen: payload.NgayHen,
      DienGiai: payload.DienGiai,
      TieuDe: payload.TieuDe,
    };

    return await axiosApi
      .post("api/admin/KhachHang/AddLichSuLamViec", init)
      .then((res) => res.data);
  },

  getHopDong: async (payload: any = {}) => {
    return await axiosApi
      .post("api/admin/hop-dong/danh-sach", payload)
      .then((res) => res.data);
  },

  getQRCode: async (payload: any) => {
    return await axiosApi
      .post("https://api.vietqr.io/v2/generate", payload)
      .then((res) => res.data);
  },
};
