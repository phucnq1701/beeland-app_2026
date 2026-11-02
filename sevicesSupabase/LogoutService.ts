import AsyncStorage from "@react-native-async-storage/async-storage";

import { SESSION_KEYS } from "@/lib/sessionKeys";

import axiosApiSupabase from "./axiosApiSupabase";

/**
 * Đăng xuất giống web (`beeland/src/lib/cloudAuthClient.ts` › `signOutCloudSession`): cloud-auth `logout` huỷ phiên
 * trên máy chủ (lỗi mạng bỏ qua) rồi xoá phiên trên máy → mở lại app phải đăng nhập lại.
 * Giữ `@last_login` (điền sẵn) và Face ID (docs/auth.md).
 */
export async function logoutCurrentSession(): Promise<void> {
  const token = await AsyncStorage.getItem("@token").catch(() => null);
  if (token) {
    await axiosApiSupabase
      .post("functions/v1/cloud-auth", { action: "logout", token }, { timeout: 8000 })
      .catch(() => undefined);
  }
  try {
    await AsyncStorage.multiRemove(SESSION_KEYS);
  } catch {
    for (const key of SESSION_KEYS) await AsyncStorage.removeItem(key).catch(() => undefined);
  }
}
