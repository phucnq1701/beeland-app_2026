/**
 * Thông báo tin nhắn (banner trong app + push) – logic thuần, KHÔNG import (test: tests/chatNotify.test.cjs).
 * Nguồn banner: (1) realtime `chat:u` sự kiện `message_new` khi app đang mở; (2) push nhận lúc app đang mở
 * (máy chủ: migration beeland 20261013150000_chat_push, edge `chat-push`). Hai nguồn trùng nhau → khử theo id tin.
 * Nội dung dựng giống máy chủ (`_chat_push_noi_dung`) để banner và push đọc như nhau.
 */

export interface ChatBanner {
  /** id tin nhắn – khoá khử trùng. */
  key: string;
  conversationId: string;
  title: string;
  body: string;
}

const KENH: Record<string, string> = { app: "App", web: "Web", zalo: "Zalo", facebook: "Facebook" };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

/** Xem trước nội dung tin (ảnh / tệp / chữ gộp khoảng trắng, ≤ 180 ký tự). */
export function previewText(msg: { loai?: unknown; noi_dung?: unknown; attachments?: unknown }): string {
  const atts = Array.isArray(msg.attachments) ? msg.attachments : [];
  if (msg.loai === "image") return "Đã gửi ảnh";
  if (msg.loai === "file") {
    const ten = isObj(atts[0]) ? str(atts[0].ten_tep).trim() : "";
    return ten ? `Đã gửi tệp: ${ten}` : "Đã gửi tệp";
  }
  const t = str(msg.noi_dung).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 180) : "Tin nhắn mới";
}

/**
 * Banner từ sự kiện realtime `message_new` (payload `{message, conversation, muted}` của `_chat_emit_message`).
 * null khi: tin của chính mình / hệ thống / đã thu hồi, hoặc hội thoại tắt tiếng mà không @nhắc mình.
 */
export function bannerFromEvent(payload: unknown, meId: string | null | undefined): ChatBanner | null {
  if (!isObj(payload) || !isObj(payload.message)) return null;
  const m = payload.message;
  const c = isObj(payload.conversation) ? payload.conversation : {};
  const id = str(m.id);
  const conv = str(m.conversation_id) || str(c.id);
  if (!id || !conv || id.startsWith("local-")) return null;
  if (m.sender_type !== "employee" && m.sender_type !== "contact") return null;
  if (m.recalled_at) return null;
  const sender = isObj(m.sender) ? m.sender : {};
  if (m.sender_type === "employee" && meId && str(sender.id) === meId) return null;
  const mentions = Array.isArray(m.mentions) ? m.mentions : [];
  const nhac = !!meId && mentions.includes(meId);
  if (payload.muted === true && !nhac) return null;

  const gui = str(sender.ten).trim() || (m.sender_type === "contact" ? "Khách" : "Nhân viên");
  const xem = previewText(m);
  let title: string;
  let body: string;
  if (c.loai === "customer") {
    title = m.sender_type === "contact" ? `${gui}${KENH[str(c.kenh)] ? ` · ${KENH[str(c.kenh)]}` : ""}` : "Khách hàng";
    body = m.sender_type === "employee" ? `${gui}: ${xem}` : xem;
  } else if (c.loai === "group") {
    title = str(c.ten).trim() || "Nhóm";
    body = `${gui}: ${xem}`;
  } else {
    title = gui;
    body = xem;
  }
  if (nhac) body = `${gui} đã nhắc đến bạn: ${xem}`;
  return { key: id, conversationId: conv, title, body };
}

/** Banner từ push (data do máy chủ gắn: `{type:'chat', conversation_id, message_id}`). */
export function bannerFromPush(content: { title?: unknown; body?: unknown; data?: unknown } | null | undefined): ChatBanner | null {
  const d = isObj(content?.data) ? content!.data : null;
  if (!d || d.type !== "chat") return null;
  const conv = str(d.conversation_id);
  const key = str(d.message_id);
  if (!conv || !key) return null;
  return { key, conversationId: conv, title: str(content!.title) || "Tin nhắn mới", body: str(content!.body) };
}

/** id hội thoại trong push được bấm (null nếu không phải push chat). */
export function chatTarget(data: unknown): string | null {
  return isObj(data) && data.type === "chat" && str(data.conversation_id) ? str(data.conversation_id) : null;
}

/** Bộ nhớ khử trùng có giới hạn: `add(key)` trả false nếu đã thấy. */
export function createSeen(limit = 200): { add: (key: string) => boolean } {
  const keys: string[] = [];
  const set = new Set<string>();
  return {
    add(key: string) {
      if (set.has(key)) return false;
      set.add(key);
      keys.push(key);
      if (keys.length > limit) set.delete(keys.shift() as string);
      return true;
    },
  };
}
