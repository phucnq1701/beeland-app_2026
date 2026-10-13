import "react-native-url-polyfill/auto";

import { RealtimeClient, type RealtimeChannel } from "@supabase/supabase-js";

import type {
  ChatContact, ChatConversationDetail, ChatInboxPage, ChatMe, ChatMessage, ChatMessagesPage,
} from "@/lib/chat";

import axiosApiSupabase, { SUPABASE_ANON_KEY } from "./axiosApiSupabase";
import { getValidSupabaseJwt } from "./cloudTenant";

/**
 * Chat – CÙNG RPC với web (beeland/src/services/chat/ChatService.ts): `fn_chat_*` bằng JWT ứng dụng (claim employee_id),
 * trả `{data}` | `{error}`. Tệp: edge `chat-files` (JWT người dùng – KHÔNG dùng `@token` như interceptor axios gắn cho
 * functions/v1) → `upload_url` trả `{attachment_id, path, token}` → PUT lên link ký kho `chat-files`; `file_url` → link 5 phút.
 * Realtime: kênh private `chat:u:<employee_id>` (cần JWT trên websocket), 5 sự kiện như web.
 */

const API_URL = "https://api-beelandv2.beesky.vn";
const SESSION_EXPIRED = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
const URL_TTL_MS = 240_000;

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.message || e?.response?.data?.hint || (e instanceof Error && e.message) || fallback;

async function requireJwt(): Promise<string> {
  const jwt = await getValidSupabaseJwt();
  if (!jwt) throw new Error(SESSION_EXPIRED);
  return jwt;
}

/** RPC `fn_chat_*`: lỗi PostgREST / lỗi nghiệp vụ `{error}` → Error(message tiếng Việt). */
async function chatRpc<T>(fn: string, args: Record<string, unknown> = {}, fallback = "Có lỗi xảy ra, vui lòng thử lại"): Promise<T> {
  await requireJwt();
  let data: any;
  try {
    data = (await axiosApiSupabase.post(`rest/v1/rpc/${fn}`, args)).data;
  } catch (e) {
    const m = errMsg(e, fallback);
    throw new Error(/phiên đăng nhập không hợp lệ/i.test(m) ? "Tài khoản chưa có hồ sơ nhân viên nên chưa dùng được chat." : m);
  }
  if (data && typeof data === "object" && data.error) throw new Error(String(data.error));
  return data?.data as T;
}

/** Edge `chat-files` bằng JWT (fetch riêng – interceptor axios gắn `@token` cho functions/v1). */
async function callFiles<T>(body: Record<string, unknown>): Promise<T> {
  const jwt = await requireJwt();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/functions/v1/chat-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Không kết nối được máy chủ. Vui lòng kiểm tra mạng.");
  }
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.error) throw new Error(String(json?.error || json?.message || "Không xử lý được tệp"));
  return json?.data as T;
}

/** Đổi URL nội bộ (http://api-gw:8000/storage/v1/…) về địa chỉ công khai. */
const toPublicUrl = (u: string) => {
  const i = u.indexOf("/storage/v1/");
  return i < 0 ? u : `${API_URL}${u.slice(i)}`;
};

/** PUT multipart lên link ký (XHR: lớp mạng native nhận phần tệp `{ uri, name, type }`, fetch của RN thì không ổn định). */
function putSigned(path: string, token: string, file: { uri: string; name: string; mime: string }): Promise<void> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", { uri: file.uri, name: file.name, type: file.mime } as any);
  const url = `${API_URL}/storage/v1/object/upload/sign/chat-files/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(
      xhr.status === 413 ? "Tệp quá lớn" : "Tải tệp lên thất bại, vui lòng thử lại",
    )));
    xhr.onerror = () => reject(new Error("Không kết nối được máy chủ. Vui lòng kiểm tra mạng."));
    xhr.send(body);
  });
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

  /** Tải một tệp lên kho `chat-files` của hội thoại → id tệp để gửi kèm tin. */
  async upload(conversationId: string, file: { uri: string; name: string; mime: string; size: number }): Promise<string> {
    const r = await callFiles<{ attachment_id: string; path: string; token: string }>({
      action: "upload_url", conversation_id: conversationId, ten_tep: file.name, mime: file.mime, kich_thuoc: file.size,
    });
    if (!r?.attachment_id || !r.path || !r.token) throw new Error("Không tạo được liên kết tải lên");
    await putSigned(r.path, r.token, file);
    return r.attachment_id;
  },

  /** Link xem tệp (máy chủ ký 300 s, dùng lại 240 s). */
  async fileUrl(attachmentId: string): Promise<string> {
    const hit = urlCache.get(attachmentId);
    if (hit && hit.exp > Date.now()) return hit.url;
    const r = await callFiles<{ url: string }>({ action: "file_url", attachment_id: attachmentId });
    const url = toPublicUrl(String(r?.url || ""));
    if (!/^https?:\/\//i.test(url)) throw new Error("Không mở được tệp");
    urlCache.set(attachmentId, { url, exp: Date.now() + URL_TTL_MS });
    return url;
  },
};

/* ---------------- Realtime ---------------- */

export const CHAT_EVENT_NAMES = ["message_new", "message_updated", "conversation_updated", "member_changed", "read"] as const;
export type ChatEventName = (typeof CHAT_EVENT_NAMES)[number];
export type ChatEvent = { event: ChatEventName; payload: any };

let rt: RealtimeClient | null = null;
function realtime(): RealtimeClient {
  if (!rt) rt = new RealtimeClient(`${API_URL.replace(/^http/, "ws")}/realtime/v1`, { params: { apikey: SUPABASE_ANON_KEY } });
  return rt;
}

/**
 * Nghe kênh cá nhân `chat:u:<employee_id>` (private, JWT). `onStatus(true)` khi đã nối; nối lại sau khi rớt → màn tải bù.
 * Trả hàm huỷ (an toàn cả khi gọi trước lúc kênh tạo xong).
 */
export function subscribeChatUser(employeeId: string, onEvent: (e: ChatEvent) => void, onStatus: (live: boolean) => void): () => void {
  let ch: RealtimeChannel | null = null;
  let closed = false;
  void (async () => {
    const jwt = await getValidSupabaseJwt();
    if (!jwt || closed) return onStatus(false);
    const client = realtime();
    await client.setAuth(jwt);
    if (closed) return;
    let c = client.channel(`chat:u:${employeeId}`, { config: { private: true, broadcast: { self: false } } });
    for (const name of CHAT_EVENT_NAMES) c = c.on("broadcast", { event: name }, (msg: { payload?: unknown }) => onEvent({ event: name, payload: msg?.payload ?? {} }));
    ch = c;
    c.subscribe((status) => onStatus(status === "SUBSCRIBED"));
  })().catch(() => onStatus(false));
  return () => {
    closed = true;
    if (ch) void realtime().removeChannel(ch);
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
  let ch: RealtimeChannel | null = null;
  let closed = false;
  let last = 0;
  void (async () => {
    const client = realtime();
    if (opts.channelKey) {
      const c = client.channel(`chatv:${opts.channelKey}`, { config: { broadcast: { self: false } } });
      c.on("broadcast", { event: "typing" }, (msg: { payload?: { from?: string } }) => {
        if (msg?.payload?.from === "visitor") onTyping("visitor");
      });
      ch = c;
      c.subscribe();
      return;
    }
    const jwt = await getValidSupabaseJwt();
    if (!jwt || closed) return;
    await client.setAuth(jwt);
    if (closed) return;
    const c = client.channel(`chat:c:${opts.conversationId}`, { config: { private: true, broadcast: { self: false } } });
    c.on("broadcast", { event: "typing" }, (msg: { payload?: { employee_id?: string } }) => {
      const who = msg?.payload?.employee_id;
      if (who && who !== opts.meId) onTyping(who);
    });
    ch = c;
    c.subscribe();
  })().catch(() => undefined);
  return {
    ping() {
      const now = Date.now();
      if (!ch || now - last < TYPING_GAP_MS) return;
      last = now;
      const payload = opts.channelKey ? { t: "typing", from: "agent" } : { employee_id: opts.meId };
      void ch.send({ type: "broadcast", event: "typing", payload });
    },
    close() {
      closed = true;
      if (ch) void realtime().removeChannel(ch);
      ch = null;
    },
  };
}
