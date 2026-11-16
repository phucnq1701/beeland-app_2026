import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { chatAuthChanged } from "@/components/chat/chatPush";
import { useToast } from "@/components/ui";
import { onSessionExpired } from "@/services/session";

/**
 * Phiên hết hẳn (làm mới bị máy chủ từ chối: quá 30 ngày, tài khoản / công ty bị khoá, đổi mật khẩu…) ⇒ services/session.ts đã
 * xoá phiên; ở đây báo người dùng + đưa về màn Đăng nhập (một lần, dù nhiều lời gọi cùng lỗi).
 */
export function SessionGuard() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const handling = useRef(false);

  useEffect(() => onSessionExpired((reason) => {
    if (handling.current) return;
    handling.current = true;
    chatAuthChanged(false);
    queryClient.clear();
    toast.show({ type: "error", message: reason || "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại" });
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {
      // không có màn để đóng
    }
    router.replace("/login");
    setTimeout(() => { handling.current = false; }, 3000);
  }), [router, toast, queryClient]);

  return null;
}
