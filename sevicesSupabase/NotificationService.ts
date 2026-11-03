import AsyncStorage from "@react-native-async-storage/async-storage";

import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyCode, getMaNv } from "./cloudTenant";
import { subscribeTableChanges } from "./realtimeHub";
import { notificationOrFilter, visibleNotifications, type AppNotification } from "../lib/notifications";

/**
 * Thông báo nhân viên — bảng `notifications` (Cloud), CÙNG cách web làm ở chuông thông báo
 * (beeland-dotnet/src/components/Layout/ModuleLayout.tsx): 50 tin mới nhất, lọc thông báo chung / công ty / tài khoản;
 * đánh dấu đã đọc = PATCH `is_read = true`; realtime = INSERT bảng `notifications`.
 * Thay API .NET cũ `api/admin/get-notifications` (đã ngừng từ khi chuyển dữ liệu sang Cloud).
 */

/** Mã công ty như web lưu `TenCTDKVT` (mã nhập lúc đăng nhập, vd `msr`). */
async function companyCode(): Promise<string> {
  const typed = ((await AsyncStorage.getItem("tenCTDKVT")) || "").trim();
  return typed || (await getCompanyCode());
}

export const NotificationService = {
  list: async (): Promise<AppNotification[]> => {
    const [code, maNV] = await Promise.all([companyCode(), getMaNv()]);
    const or = notificationOrFilter(code, maNV);
    if (!or) return [];
    const res = await axiosApiSupabase.get("rest/v1/notifications", {
      params: {
        select: "id,title,message,created_at,is_read,ma_ctdk,account_id,is_global,type,related_id",
        or,
        order: "created_at.desc",
        limit: "50",
      },
    });
    return visibleNotifications(Array.isArray(res.data) ? res.data : [], code, maNV);
  },

  markRead: async (ids: string[]): Promise<void> => {
    const list = ids.filter(Boolean);
    if (!list.length) return;
    await axiosApiSupabase.patch(`rest/v1/notifications?id=in.(${list.join(",")})`, { is_read: true });
  },

  /** Có thông báo mới (INSERT) → gọi `onInsert`; trả hàm huỷ. Server lọc theo công ty. */
  subscribe: (onInsert: () => void): (() => void) =>
    subscribeTableChanges("layout-notifications", [{ event: "INSERT", table: "notifications" }], () => onInsert()),
};
