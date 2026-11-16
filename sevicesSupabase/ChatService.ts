import type {
  ChatContact, ChatConversationDetail, ChatInboxPage, ChatMe, ChatMessage, ChatMessagesPage,
} from "@/lib/chat";
import { callNv, errorMessage, postFormNv } from "@/services/nvApi";
import { getJwt } from "@/services/session";

import { joinChannel, syncRealtimeAuth, type HubChannel } from "./realtimeHub";

/**
 * Chat — bộ API riêng app (fn_nv_app_chat_*, lõi chung: SP app gọi thẳng đúng SP chat web usp_chat_* — người gọi / công ty từ phiên,
 * trả `{data}` | `{error}` như web). Tệp: fn_nv_app_chat_tep_tai (multipart, máy chủ ghi tệp vào kho chat-files đúng đường dẫn SP cấp ⇒
 * attachment_id) / fn_nv_app_chat_tep_link (URL ký 300 s tải thẳng từ kho). Không còn REST bảng / edge chat-files / kho ký PUT của Supabase.
 * Realtime: kênh private `chat:u:<employee_id>` (JWT phiên app trên websocket), 5 sự kiện như web — hub SignalR `realtimeHub.ts`.
 */

const SESSION_EXPIRED = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
const URL_TTL_MS = 240_000;

/** Tên hàm web (fn_chat_*) ⇒ endpoint app. */
export const CHAT_FN: Record<string, string> = {
  fn_chat_me: "fn_nv_app_chat_me",
  fn_chat_danh_ba: "fn_nv_app_chat_danh_ba",
  fn_chat_inbox: "fn_nv_app_chat_inbox",
  fn_chat_conversation_get: "fn_nv_app_chat_hoi_thoai",
  fn_chat_messages: "fn_nv_app_chat_tin",
  fn_chat_send: "fn_nv_app_chat_gui",
  fn_chat_edit: "fn_nv_app_chat_sua_tin",
  fn_chat_recall: "fn_nv_app_chat_thu_hoi",
  fn_chat_pref: "fn_nv_app_chat_tuy_chinh",
  fn_chat_customer_tags: "fn_nv_app_chat_the_khach",
  fn_chat_customer_link: "fn_nv_app_chat_lien_ket_khach",
  fn_chat_request_info: "fn_nv_app_chat_xin_thong_tin",
  fn_chat_mark_read: "fn_nv_app_chat_da_doc",
  fn_chat_direct_open: "fn_nv_app_chat_mo_1_1",
  fn_chat_group_create: "fn_nv_app_chat_tao_nhom",
  fn_chat_members_add: "fn_nv_app_chat_them_tv",
  fn_chat_members_remove: "fn_nv_app_chat_bot_tv",
  fn_chat_leave: "fn_nv_app_chat_roi",
  fn_chat_join: "fn_nv_app_chat_tham_gia",
  fn_chat_customer_status: "fn_nv_app_chat_trang_thai_khach",
  fn_chat_push_dang_ky: "fn_nv_app_chat_push_dang_ky",
  fn_chat_push_huy: "fn_nv_app_chat_push_huy",
};

/** RPC chat: lỗi máy chủ / lỗi nghiệp vụ `{error}` → Error(message tiếng Việt). */
async function chatRpc<T>(fn: string, args: Record<string, unknown> = {}, fallback = "Có lỗi xảy ra, vui lòng thử lại"): Promise<T> {
  const target = CHAT_FN[fn];
  if (!target) throw new Error(fallback);
  if (!(await getJwt())) throw new Error(SESSION_EXPIRED);
  let data: any;
  try {
    data = await callNv<any>(target, args);
  } catch (e) {
    const m = errorMessage(e, fallback);
    throw new Error(/phiên đăng nhập không hợp lệ/i.test(m) ? "Tài khoản chưa có hồ sơ nhân viên nên chưa dùng được chat." : m);
  }
  if (data && typeof data === "object" && data.error) throw new Error(String(data.error));
  return data?.data as T;
}

const urlCache = new Map<string, { url: string; exp: number }>();

export const ChatService = {
  me: () => chatRpc<ChatMe>("fn_chat_me"),
  danhBa: (tab: "noi_bo" | "dai_ly", q?: string) => chatRpc<ChatContact[]>("fn_chat_danh_ba", { p_tab: tab, p_q: q || null }),
  inbox: (filter: Record<string, unknown>) => chatRpc<ChatInboxPage>("fn_chat_inbox", { p_filter: filter }),
  conversationGet: (id: string) => chatRpc<ChatConversationDetail>("fn_chat_conversation_get", { p_id: id }),
  messages: (id: string, opts: { before?: string | null; after?: string | null; limit?: number } = {}) =>
    chatRpc<ChatMessagesPage>("fn_chat_messages", {
      p_id: id, p_before: opts.before ?? null, p_after: opts.after ?? null, p_limit: opts.limit ?? 50,
    }),
  send: (
    id: string,
    msg: { client_msg_id: string; noi_dung: string | null; attachment_ids?: string[]; reply_to_id?: string | null; mentions?: string[] },
  ) => chatRpc<ChatMessage>("fn_chat_send", { p_id: id, p_msg: msg }, "Gửi tin nhắn thất bại"),
  edit: (messageId: string, noiDung: string) =>
    chatRpc<ChatMessage>("fn_chat_edit", { p_message_id: messageId, p_noi_dung: noiDung }, "Không sửa được tin nhắn"),
  recall: (messageId: string) => chatRpc<ChatMessage>("fn_chat_recall", { p_message_id: messageId }, "Không thu hồi được tin nhắn"),
  pref: (id: string, patch: { pinned?: boolean; muted?: boolean }) =>
    chatRpc<ChatConversationDetail>("fn_chat_pref", { p_id: id, p_patch: patch }),
  customerTags: (id: string, tags: string[]) => chatRpc<ChatConversationDetail>("fn_chat_customer_tags", { p_id: id, p_tags: tags }),
  customerLink: (id: string, customerId: string | null) =>
    chatRpc<ChatConversationDetail>("fn_chat_customer_link", { p_id: id, p_customer_id: customerId }),
  requestInfo: (id: string) => chatRpc<ChatMessage>("fn_chat_request_info", { p_id: id }),
  markRead: (id: string) => chatRpc<{ last_read_at: string | null }>("fn_chat_mark_read", { p_id: id }),
  directOpen: (employeeId: string) => chatRpc<ChatConversationDetail>("fn_chat_direct_open", { p_employee_id: employeeId }),
  groupCreate: (ten: string, ids: string[]) =>
    chatRpc<ChatConversationDetail>("fn_chat_group_create", { p_ten: ten, p_employee_ids: ids }),
  membersAdd: (id: string, ids: string[]) => chatRpc<ChatConversationDetail>("fn_chat_members_add", { p_id: id, p_employee_ids: ids }),
  membersRemove: (id: string, ids: string[]) =>
    chatRpc<ChatConversationDetail>("fn_chat_members_remove", { p_id: id, p_employee_ids: ids }),
  leave: (id: string) => chatRpc<{ conversation_id: string }>("fn_chat_leave", { p_id: id }),
  join: (id: string) => chatRpc<ChatConversationDetail>("fn_chat_join", { p_id: id }),
  customerStatus: (id: string, s: "open" | "closed") =>
    chatRpc<ChatConversationDetail>("fn_chat_customer_status", { p_id: id, p_trang_thai: s }),
  /** Push (beeland migration 20261013150000_chat_push): gắn máy này với NV đang đăng nhập / gỡ khi đăng xuất. */
  pushRegister: (pushToken: string, platform: "ios" | "android") =>
    chatRpc<{ ok: boolean }>("fn_chat_push_dang_ky", { p_push_token: pushToken, p_nen_tang: platform }),
  pushUnregister: (pushToken: string) => chatRpc<{ so: number }>("fn_chat_push_huy", { p_push_token: pushToken }),

  /** Tải một tệp lên kho `chat-files` của hội thoại (1 bước, máy chủ ghi tệp) → id tệp để gửi kèm tin. */
  async upload(conversationId: string, file: { uri: string; name: string; mime: string; size: number }): Promise<string> {
    let r: { attachment_id?: string };
    try {
      r = await postFormNv<{ attachment_id?: string }>("fn_nv_app_chat_tep_tai", () => {
        const body = new FormData();
        body.append("conversation_id", conversationId);
        body.append("file", { uri: file.uri, name: file.name, type: file.mime } as any);
        return body;
      });
    } catch (e: any) {
      throw new Error(e?.status === 413 ? "Tệp quá lớn" : errorMessage(e, "Tải tệp lên thất bại, vui lòng thử lại"));
    }
    if (!r?.attachment_id) throw new Error("Tải tệp lên thất bại, vui lòng thử lại");
    return r.attachment_id;
  },

  /** Link xem tệp (máy chủ ký 300 s, dùng lại 240 s). */
  async fileUrl(attachmentId: string): Promise<string> {
    const hit = urlCache.get(attachmentId);
    if (hit && hit.exp > Date.now()) return hit.url;
    let url = "";
    try {
      url = String((await callNv<{ url?: string }>("fn_nv_app_chat_tep_link", { p_attachment_id: attachmentId }))?.url || "");
    } catch (e) {
      throw new Error(errorMessage(e, "Không mở được tệp"));
    }
    if (!/^https?:\/\//i.test(url)) throw new Error("Không mở được tệp");
    urlCache.set(attachmentId, { url, exp: Date.now() + URL_TTL_MS });
    return url;
  },
};

/* ---------------- Realtime ---------------- */

export const CHAT_EVENT_NAMES = ["message_new", "message_updated", "conversation_updated", "member_changed", "read"] as const;
export type ChatEventName = (typeof CHAT_EVENT_NAMES)[number];
export type ChatEvent = { event: ChatEventName; payload: any };

/**
 * Nghe kênh cá nhân `chat:u:<employee_id>` (private, JWT). `onStatus(true)` khi đã nối; nối lại sau khi rớt → màn tải bù.
 * Trả hàm huỷ (an toàn cả khi gọi trước lúc kênh tạo xong).
 */
export function subscribeChatUser(employeeId: string, onEvent: (e: ChatEvent) => void, onStatus: (live: boolean) => void): () => void {
  let ch: HubChannel | null = null;
  let closed = false;
  void (async () => {
    const jwt = await getJwt();
    if (!jwt || closed) return onStatus(false);
    await syncRealtimeAuth();
    if (closed) return;
    ch = joinChannel(
      `chat:u:${employeeId}`,
      { private: true },
      (event, payload) => {
        if ((CHAT_EVENT_NAMES as readonly string[]).includes(event)) onEvent({ event: event as ChatEventName, payload: payload ?? {} });
      },
      onStatus,
    );
  })().catch(() => onStatus(false));
  return () => {
    closed = true;
    ch?.close();
    ch = null;
  };
}

/* ---------------- Đang gõ ---------------- */

const TYPING_GAP_MS = 3000;

/**
 * "Đang gõ" của một hội thoại (như web hooks/chat/useChatTyping.ts):
 * - hội thoại khách (có `channelKey`): kênh công khai `chatv:<key>` – nghe khách gõ (`from: 'visitor'`), mình gõ phát
 *   `from: 'agent'` (app khách / widget hiện "đang soạn tin");
 * - nội bộ / nhóm: kênh private `chat:c:<id>` (chỉ thành viên, JWT) – payload `{employee_id}`.
 * `onTyping(id)`: 'visitor' hoặc employee_id. `ping()` phát tối đa 1 lần / 3 s.
 */
export function subscribeTyping(
  opts: { conversationId: string; meId: string; channelKey?: string | null },
  onTyping: (who: string) => void,
): { ping: () => void; close: () => void } {
  let ch: HubChannel | null = null;
  let closed = false;
  let last = 0;
  void (async () => {
    if (opts.channelKey) {
      ch = joinChannel(`chatv:${opts.channelKey}`, {}, (event, payload) => {
        if (event === "typing" && payload?.from === "visitor") onTyping("visitor");
      });
      return;
    }
    const jwt = await getJwt();
    if (!jwt || closed) return;
    await syncRealtimeAuth();
    if (closed) return;
    ch = joinChannel(`chat:c:${opts.conversationId}`, { private: true }, (event, payload) => {
      const who = payload?.employee_id;
      if (event === "typing" && who && who !== opts.meId) onTyping(who);
    });
  })().catch(() => undefined);
  return {
    ping() {
      const now = Date.now();
      if (!ch || now - last < TYPING_GAP_MS) return;
      last = now;
      const payload = opts.channelKey ? { t: "typing", from: "agent" } : { employee_id: opts.meId };
      ch.send("typing", payload);
    },
    close() {
      closed = true;
      ch?.close();
      ch = null;
    },
  };
}
