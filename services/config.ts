/**
 * Máy chủ BEELAND (.NET 8 + SQL Server). App nhân viên chỉ gọi bộ API riêng `api/app-nhan-vien/*` (docs/app-api-rieng.md).
 * `EXPO_PUBLIC_API_URL` (chỉ khi chạy thử, vd `http://localhost:5117`) để thử API chạy trên máy trước khi deploy.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://api-beeland26.beesky.vn").replace(/\/+$/, "");

/** Tiền tố bộ API riêng của app nhân viên. */
export const NV_API_BASE = `${API_URL}/api/app-nhan-vien`;
