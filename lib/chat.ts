/**
 * Chat (BeeChat khách hàng + chat nội bộ / đại lý) – logic thuần, KHÔNG import (test nạp trực tiếp: tests/chat.test.cjs).
 * Kiểu dữ liệu = hình dạng trả về của `fn_chat_*` (web: beeland/src/services/chat/types.ts, migration 20261011100*,
 * kênh app: 20261013120000_chat_kenh_app). Luật quyền giống web (beeland/src/pages/customers/quan-ly/beechat/index.tsx).
 */

export type ChatLoai = "direct" | "group" | "customer";
export type ChatVaiTro = "owner" | "admin" | "member";
/** Khu hộp thư của fn_chat_inbox. */
export type ChatKhu = "beechat" | "noi_bo" | "dai_ly" | "tat_ca";

export interface ChatMe {
  employee_id: string;
  ho_ten: string;
  anh: string | null;
  is_dai_ly: boolean;
  san_id: string | null;
  ten_san: string | null;
  is_chat_dai_ly: boolean;
  is_admin: boolean;
  tenant: string;
  kenh: { user: string; presence: string };
}

export interface ChatContact {
  employee_id: string;
  ho_ten: string;
  anh: string | null;
  chuc_vu: string | null;
  phong_ban: string | null;
  san_id: string | null;
  ten_san: string | null;
}

export interface ChatAttachment {
  id: string;
  ten_tep: string;
  mime: string;
  kich_thuoc: number;
  rong: number | null;
  cao: number | null;
  /** App: tệp đang gửi còn trên máy (xem trước bằng uri cục bộ). */
  local_uri?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: "employee" | "contact" | "system";
  sender: { id: string | null; ten: string | null; anh: string | null; loai: "employee" | "contact" } | null;
  loai: string;
  noi_dung: string | null;
  reply_to: { id: string; noi_dung: string | null; sender_ten: string | null } | null;
  mentions: string[] | null;
  system_event: Record<string, unknown> | null;
  edited_at: string | null;
  recalled_at: string | null;
  trang_thai_gui: string | null;
  client_msg_id?: string | null;
  created_at: string;
  attachments: ChatAttachment[];
  /** App: tin đang gửi / gửi lỗi (chưa có trên máy chủ). */
  local_status?: "sending" | "failed";
}

export interface ChatConversation {
  id: string;
  loai: ChatLoai;
  ten: string | null;
  anh_dai_dien: string | null;
  san_id: string | null;
  ten_san: string | null;
  trang_thai: string | null;
  tags: string[];
  kenh: string | null;
  widget_id?: string | null;
  ten_widget?: string | null;
  created_at?: string;
  last_message_at: string | null;
  last_message_preview: string | null;
}

export interface ChatInboxItem {
  conversation: ChatConversation;
  doi_dien: { employee_id: string; ho_ten: string; anh: string | null } | null;
  contact: { id: string; ho_ten: string | null; nguon: string; customer_id: string | null; last_seen_at?: string | null } | null;
  thanh_vien?: { ten: string[]; tong: number } | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
  la_thanh_vien: boolean;
}

export interface ChatInboxPage {
  items: ChatInboxItem[];
  next_cursor: string | null;
}

export interface ChatMember {
  employee_id: string;
  ho_ten: string;
  anh: string | null;
  vai_tro: ChatVaiTro;
  nguon_them: string | null;
  last_read_at: string | null;
  is_dai_ly: boolean;
}

export interface ChatConversationDetail {
  conversation: ChatConversation;
  members: ChatMember[];
  me: { vai_tro: ChatVaiTro; pinned: boolean; muted: boolean; last_read_at: string | null } | null;
  contact: {
    id: string;
    nguon: string;
    ho_ten: string | null;
    dien_thoai: string | null;
    email: string | null;
    last_seen_at: string | null;
    customer: { id: string; ten_kh: string; ma_so_kh: string | null } | null;
  } | null;
}

export interface ChatMessagesPage {
  items: ChatMessage[];
  doc_boi: { employee_id: string; last_read_at: string }[];
  contact_last_read_at: string | null;
  has_more: boolean;
}

/** Tên kênh khách (khớp web KENH_LABEL / NGUON_LABEL). */
export const KENH_LABEL: Record<string, string> = { web: "Web", zalo: "Zalo", facebook: "Facebook", app: "App" };
export const NGUON_LABEL: Record<string, string> = {
  web: "Web chat",
  zalo: "Zalo",
  facebook: "Facebook",
  app: "App khách hàng",
};

export const CHAT_TEXT_MAX = 4000;
export const CHAT_FILES_MAX = 10;
export const CHAT_FILE_MAX_MB = 20;
/** Tin liền nhau cùng người gửi trong khoảng này → một cụm (ẩn tên / giờ lặp lại). */
export const CHAT_GROUP_GAP_MS = 5 * 60 * 1000;

/** MIME bucket `chat-files` cho phép (spec chat 1.7 – không SVG/HTML/JS). */
export const CHAT_ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/zip",
];

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip",
};

/** MIME của tệp chọn từ máy: ưu tiên MIME bộ chọn trả, thiếu thì đoán theo đuôi. */
export function chatFileMime(name: string, mime?: string | null): string {
  const m = (mime || "").toLowerCase();
  if (m && m !== "application/octet-stream") return m;
  const ext = (name.split(".").pop() || "").toLowerCase();
  return EXT_MIME[ext] || m || "application/octet-stream";
}

/** Kiểm tệp trước khi xin link tải lên; null = hợp lệ. */
export function chatFileError(file: { name: string; size?: number | null; mime?: string | null }): string | null {
  const mime = chatFileMime(file.name, file.mime);
  if (!CHAT_ALLOWED_MIME.includes(mime)) return "Định dạng tệp không được hỗ trợ";
  if ((file.size ?? 0) > CHAT_FILE_MAX_MB * 1024 * 1024) return `Tệp vượt quá ${CHAT_FILE_MAX_MB} MB`;
  if (file.size === 0) return "Tệp rỗng";
  return null;
}

export const isImageMime = (mime: string | null | undefined) => !!mime && mime.toLowerCase().startsWith("image/");

const byTime = (a: ChatMessage, b: ChatMessage) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Gộp tin (như web chatReducers.mergeMessages): bỏ trùng theo id, tin thật thay tin tạm cùng `client_msg_id`,
 * sắp tăng theo `created_at`. Bản mới giữ `client_msg_id` của bản cũ nếu thiếu (realtime người khác bỏ trường này).
 */
export function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const out = [...list];
  for (const m of incoming) {
    let idx = out.findIndex((x) => x.id === m.id);
    if (idx < 0 && m.client_msg_id) idx = out.findIndex((x) => x.client_msg_id === m.client_msg_id);
    if (idx >= 0) out[idx] = { ...m, client_msg_id: m.client_msg_id ?? out[idx].client_msg_id };
    else out.push(m);
  }
  return out.sort(byTime);
}

/** Mốc tải tin mới: tin máy chủ mới nhất (bỏ tin đang gửi / lỗi). */
export function latestServerTime(list: ChatMessage[]): string | null {
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].local_status) return list[i].created_at;
  return null;
}

/** Dòng xem trước trong hộp thư (server dựng "[Hình ảnh]", "[Tệp] a.pdf"). */
export function previewText(p: string | null | undefined): string {
  if (!p) return "Chưa có tin nhắn";
  if (p === "[Hình ảnh]") return "Đã gửi một ảnh";
  if (p.startsWith("[Tệp]")) return `Đã gửi tệp ${p.slice(5).trim()}`.trim();
  return p;
}

/** Tên hiển thị của hội thoại (như web conversationTitle). */
export function conversationTitle(it: Pick<ChatInboxItem, "conversation" | "doi_dien" | "contact">): string {
  const c = it.conversation;
  if (c.loai === "direct") return it.doi_dien?.ho_ten ?? c.ten ?? "Cuộc trò chuyện";
  if (c.loai === "customer") return it.contact?.ho_ten || c.ten || "Khách vãng lai";
  return c.ten ?? "Nhóm";
}

/** Tên hội thoại ở màn chi tiết: direct = người còn lại. */
export function detailTitle(d: ChatConversationDetail, meId: string): string {
  const c = d.conversation;
  if (c.loai === "direct") return d.members.find((m) => m.employee_id !== meId)?.ho_ten ?? c.ten ?? "Cuộc trò chuyện";
  if (c.loai === "customer") return d.contact?.ho_ten || c.ten || "Khách vãng lai";
  return c.ten ?? "Nhóm";
}

/**
 * Được bấm "Tham gia" hội thoại khách chưa là thành viên (khớp web + _chat_can 'join'):
 * NV nội bộ (không phải đại lý) và là admin, hoặc hội thoại kênh app (mọi NV vào được BeeChat — DB kiểm quyền).
 */
export function canJoinCustomer(me: Pick<ChatMe, "is_admin" | "is_dai_ly">, c: Pick<ChatConversation, "loai" | "kenh">): boolean {
  return c.loai === "customer" && !me.is_dai_ly && (me.is_admin || c.kenh === "app");
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Hôm nay" / "Hôm qua" / "Thứ Hai, 12/10/2026". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return "Hôm nay";
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return "Hôm qua";
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Giờ ở hộp thư: hôm nay "HH:mm", hôm qua "Hôm qua", trong tuần "Thứ Hai", xa hơn "dd/MM". */
export function listTimeLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return timeLabel(iso);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (days === 1) return "Hôm qua";
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Nội dung tin hệ thống (thành viên vào / ra, mở lại…) — gọn như web. */
export function systemText(m: ChatMessage, nameOf: (id: string) => string): string {
  const e = m.system_event ?? {};
  const t = String(e.type ?? "");
  const by = e.by ? nameOf(String(e.by)) : "";
  const ids = Array.isArray(e.ids) ? (e.ids as unknown[]).map((x) => nameOf(String(x))) : [];
  switch (t) {
    case "member_joined": return `${by || "Một nhân viên"} đã tham gia cuộc trò chuyện`;
    case "member_left": return `${by || "Một thành viên"} đã rời cuộc trò chuyện`;
    case "member_added": return `${by || "Ai đó"} đã thêm ${ids.join(", ") || "thành viên"}`;
    case "member_removed": return `${by || "Ai đó"} đã xoá ${ids.join(", ") || "thành viên"}`;
    case "group_created": return `${by || "Ai đó"} đã tạo nhóm`;
    case "renamed": return `${by || "Ai đó"} đã đổi tên nhóm`;
    case "role": return `${by || "Ai đó"} đã đổi vai trò của ${ids.join(", ") || "thành viên"}`;
    case "customer_linked": return `${by || "Nhân viên"} đã gắn hồ sơ khách hàng`;
    case "reopened": return "Hội thoại đã mở lại";
    case "contact_info": return "Khách đã cập nhật thông tin liên hệ";
    default: return m.noi_dung || "Cập nhật cuộc trò chuyện";
  }
}

export type ChatRow =
  | { type: "day"; key: string; label: string }
  | { type: "system"; key: string; message: ChatMessage }
  | { type: "message"; key: string; message: ChatMessage; mine: boolean; first: boolean; last: boolean; footer: string | null };

const isMine = (m: ChatMessage, meId: string) => m.sender_type === "employee" && m.sender?.id === meId;
const senderKey = (m: ChatMessage) => `${m.sender_type}:${m.sender?.id ?? ""}`;

/**
 * Dòng hiển thị (cũ nhất trước): vạch ngày, tin hệ thống, tin thường đánh dấu đầu/cuối cụm.
 * Giờ dưới tin cuối cụm; tin cuối cùng của mình kèm "Đã xem" khi có người khác đọc tới (readBy = mốc đọc của người khác).
 */
export function chatRows(list: ChatMessage[], meId: string, othersReadAt: string | null, now: Date = new Date()): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastMine = -1;
  list.forEach((m, i) => { if (isMine(m, meId)) lastMine = i; });
  let prevDay = "";
  const same = (a: ChatMessage | undefined, b: ChatMessage) =>
    !!a && a.sender_type !== "system" && senderKey(a) === senderKey(b) &&
    Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) <= CHAT_GROUP_GAP_MS &&
    dayLabel(a.created_at, now) === dayLabel(b.created_at, now);
  list.forEach((m, i) => {
    const day = dayLabel(m.created_at, now);
    if (day !== prevDay) {
      rows.push({ type: "day", key: `day-${m.created_at}`, label: day });
      prevDay = day;
    }
    if (m.sender_type === "system") {
      rows.push({ type: "system", key: m.id, message: m });
      return;
    }
    const mine = isMine(m, meId);
    const first = !same(list[i - 1], m);
    const last = !list[i + 1] || !same(m, list[i + 1]);
    let footer: string | null = null;
    if (m.local_status === "sending") footer = "Đang gửi…";
    else if (m.local_status === "failed") footer = "Chưa gửi được";
    else if (mine && i === lastMine) {
      const seen = !!othersReadAt && othersReadAt >= m.created_at;
      footer = `${timeLabel(m.created_at)} · ${seen ? "Đã xem" : "Đã gửi"}`;
    } else if (last) footer = timeLabel(m.created_at);
    rows.push({ type: "message", key: m.id, message: m, mine, first, last, footer });
  });
  return rows;
}

/** Mốc đọc mới nhất của người khác (TV khác mình; hội thoại khách: tính cả mốc khách đã đọc). */
export function othersReadAt(page: Pick<ChatMessagesPage, "doc_boi" | "contact_last_read_at">, meId: string): string | null {
  let best: string | null = page.contact_last_read_at ?? null;
  for (const r of page.doc_boi ?? []) {
    if (r.employee_id !== meId && r.last_read_at && (!best || r.last_read_at > best)) best = r.last_read_at;
  }
  return best;
}

/** Id UUID v4 cho `client_msg_id` (chống gửi trùng, không cần an toàn mật mã). */
export function newClientId(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(Math.round((kb / 1024) * 10) / 10).toString().replace(".", ",")} MB`;
}
