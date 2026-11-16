import { callNv } from "@/services/nvApi";
import { getUser } from "@/services/session";

import { joinChannel, syncRealtimeAuth } from "./realtimeHub";
import { mapHopThu, type AppNotification } from "../lib/notifications";

/**
 * Thông báo nhân viên — bộ API riêng app, CÙNG nguồn chuông web từ 2026-11-15 (hộp thư thông báo theo kịch bản tb_nb_hop_thu):
 *  - fn_nv_app_thong_bao_list (= fn_tb_nb_hop_thu_list, 50 tin mới nhất của chính người đăng nhập — máy chủ lọc)
 *  - fn_nv_app_thong_bao_doc (= fn_tb_nb_doc: {id} 1 tin, {} tất cả)
 *  - realtime: kênh private `tb:u:<employee_id>`, sự kiện `tb_moi` ⇒ tải lại (như web).
 * Bảng notifications cũ (web đã chặn) không còn đọc.
 */
export const NotificationService = {
  list: async (): Promise<{ items: AppNotification[]; unread: number }> => {
    const r = await callNv<any>("fn_nv_app_thong_bao_list", { p_payload: { so_dong: 50 } });
    return { items: mapHopThu(r?.items), unread: Number(r?.chua_doc) || 0 };
  },

  /** Đánh dấu đã đọc: `id` = 1 tin, bỏ trống = tất cả. */
  markRead: async (id?: string): Promise<void> => {
    await callNv("fn_nv_app_thong_bao_doc", { p_payload: id ? { id } : {} });
  },

  /** Có thông báo mới → gọi `onNew`; trả hàm huỷ. */
  subscribe: (onNew: () => void): (() => void) => {
    let close: (() => void) | null = null;
    let closed = false;
    void (async () => {
      const emp = String((await getUser())?.employee_id || "").toLowerCase();
      if (!emp || closed) return;
      await syncRealtimeAuth();
      if (closed) return;
      const ch = joinChannel(`tb:u:${emp}`, { private: true }, (event) => {
        if (event === "tb_moi") onNew();
      });
      close = () => ch.close();
      if (closed) close();
    })().catch(() => undefined);
    return () => {
      closed = true;
      close?.();
    };
  },
};
