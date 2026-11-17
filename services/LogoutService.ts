import { AuthApi } from "@/services/AuthApi";

/**
 * Đăng xuất: thu hồi phiên trên máy chủ (`fn_nv_app_dang_xuat`, lỗi mạng bỏ qua) rồi xoá phiên trên máy →
 * mở lại app phải đăng nhập lại. Giữ `@last_login` (điền sẵn) và Face ID (docs/auth.md).
 */
export async function logoutCurrentSession(): Promise<void> {
  await AuthApi.logout();
}
