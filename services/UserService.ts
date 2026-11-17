import axios from "axios";

/** Phản hồi /api/app/get-version (tên field giữ nguyên theo API, kể cả lỗi chính tả "Vesion"). */
export type StoreVersionResponse = {
  data?: { VesionIOS?: string | number; VesionAndroid?: string | number; linkIOS?: string; linkAndroid?: string };
};

export const UserService = {
  /** Bản mới trên store — hệ thống quản lý phiên bản app riêng (api-bms), không phải dữ liệu BEELAND. */
  async checkVersion(): Promise<StoreVersionResponse | null> {
    const response = await axios.post(
      `https://api-bms.beesky.vn/api/app/get-version`,
      { MaLoaiApp: 1 },
      { headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  },
};
