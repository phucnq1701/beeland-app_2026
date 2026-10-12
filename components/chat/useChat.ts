import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  chatFileMime, latestServerTime, mergeMessages, newClientId, othersReadAt,
  type ChatConversationDetail, type ChatInboxItem, type ChatKhu, type ChatMe, type ChatMessage,
} from "@/lib/chat";
import { ChatService, subscribeChatUser, subscribeTyping, type ChatEvent } from "@/sevicesSupabase/ChatService";

/** Realtime chưa nối được → làm mới định kỳ khi màn đang mở. */
const POLL_MS = 15_000;

/* ---------------- me + kênh realtime dùng chung ---------------- */

let mePromise: Promise<ChatMe> | null = null;
let meValue: ChatMe | null = null;
const eventListeners = new Set<(e: ChatEvent) => void>();
const statusListeners = new Set<(live: boolean) => void>();
let unsubscribe: (() => void) | null = null;
let live = false;
let refs = 0;

/** Hồ sơ chat của người đăng nhập (`fn_chat_me`), lấy một lần; lỗi → lần sau thử lại. */
export function loadChatMe(): Promise<ChatMe> {
  if (!mePromise) {
    mePromise = ChatService.me().then((m) => {
      meValue = m;
      return m;
    });
    mePromise.catch(() => {
      mePromise = null;
    });
  }
  return mePromise;
}

/** Đăng xuất / đổi tài khoản: bỏ hồ sơ + kênh cũ. */
export function resetChatSession(): void {
  mePromise = null;
  meValue = null;
  unsubscribe?.();
  unsubscribe = null;
  live = false;
}

function retain(me: ChatMe) {
  refs++;
  if (!unsubscribe) {
    unsubscribe = subscribeChatUser(
      me.employee_id,
      (e) => eventListeners.forEach((l) => l(e)),
      (ok) => {
        live = ok;
        statusListeners.forEach((l) => l(ok));
      },
    );
  }
}

function release() {
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    unsubscribe?.();
    unsubscribe = null;
    live = false;
  }
}

/** `me` + đăng ký kênh realtime `chat:u` (đếm tham chiếu – nhiều màn dùng chung một kênh). */
export function useChatSession(onEvent?: (e: ChatEvent) => void, onReconnect?: () => void) {
  const [me, setMe] = useState<ChatMe | null>(meValue);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setLive] = useState(live);
  const evRef = useRef(onEvent);
  evRef.current = onEvent;
  const reRef = useRef(onReconnect);
  reRef.current = onReconnect;

  const load = useCallback(() => {
    setError(null);
    loadChatMe().then(setMe).catch((e) => setError(e instanceof Error ? e.message : "Không tải được chat"));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!me) return;
    const ev = (e: ChatEvent) => evRef.current?.(e);
    const st = (ok: boolean) => {
      setLive((was) => {
        if (ok && !was) reRef.current?.();
        return ok;
      });
    };
    eventListeners.add(ev);
    statusListeners.add(st);
    retain(me);
    setLive(live);
    return () => {
      eventListeners.delete(ev);
      statusListeners.delete(st);
      release();
    };
  }, [me]);

  return { me, error, live: isLive, retry: load };
}

/* ---------------- Hộp thư ---------------- */

const PAGE = 30;

export function useChatInbox(khu: ChatKhu, q: string, enabled: boolean) {
  const [items, setItems] = useState<ChatInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const req = useRef(0);
  const [focused, setFocused] = useState(false);

  const filter = useCallback(
    (extra: Record<string, unknown> = {}) => ({ khu, limit: PAGE, ...(q.trim() ? { q: q.trim() } : {}), ...extra }),
    [khu, q],
  );

  const load = useCallback(
    async (mode: "load" | "refresh" | "silent") => {
      if (!enabled) return;
      const id = ++req.current;
      if (mode === "load") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const page = await ChatService.inbox(filter());
        if (id !== req.current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      } catch (e) {
        if (id === req.current && mode !== "silent") setError(e instanceof Error ? e.message : "Không tải được hộp thư");
      } finally {
        if (id === req.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, filter],
  );

  useEffect(() => {
    void load("load");
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const id = req.current;
    try {
      const page = await ChatService.inbox(filter({ cursor }));
      if (id !== req.current) return;
      setItems((cur) => [...cur, ...page.items.filter((x) => !cur.some((c) => c.conversation.id === x.conversation.id))]);
      setCursor(page.next_cursor);
    } catch {
      /* cuộn lại để thử */
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, filter, loadingMore]);

  // Sự kiện realtime (gộp dồn dập) → tải lại trang đầu ngầm.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silent = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load("silent"), 400);
  }, [load]);
  const session = useChatSession(silent, silent);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      silent();
      return () => setFocused(false);
    }, [silent]),
  );

  // Dự phòng: realtime chưa nối, hoặc khu khách (hội thoại chưa tham gia không phát chat:u cho mình).
  useEffect(() => {
    if (!focused || !enabled) return;
    const t = !session.live || khu === "beechat" ? setInterval(() => void load("silent"), POLL_MS * 2) : null;
    const sub = AppState.addEventListener("change", (s) => s === "active" && silent());
    return () => {
      if (t) clearInterval(t);
      sub.remove();
    };
  }, [enabled, focused, khu, load, session.live, silent]);

  return { items, loading, refreshing, error, hasMore: !!cursor, loadingMore, refresh: () => load("refresh"), reload: () => load("load"), loadMore };
}

/**
 * Số hội thoại có tin chưa đọc (chấm ở Trang chủ): tải khi màn được mở lại + tải lại ngầm mỗi khi có sự kiện realtime
 * `chat:u` (tin mới / đã đọc ở thiết bị khác). Lỗi / chưa có hồ sơ chat → 0.
 */
export function useChatUnreadCount(): number {
  const [n, setN] = useState(0);
  const req = useRef(0);
  const fetchCount = useCallback(() => {
    const id = ++req.current;
    loadChatMe()
      .then(() => ChatService.inbox({ khu: "tat_ca", chua_doc: true, limit: 50 }))
      .then((p) => id === req.current && setN(p.items.filter((x) => x.unread > 0 && !x.muted).length))
      .catch(() => id === req.current && setN(0));
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fetchCount, 600);
  }, [fetchCount]);
  useChatSession(debounced, debounced);
  useFocusEffect(useCallback(() => fetchCount(), [fetchCount]));
  return n;
}

/** "Đang gõ" của một hội thoại: danh sách người đang gõ ('visitor' = khách) + `ping()` khi mình gõ. */
export function useChatTyping(conversationId: string, meId: string | undefined, channelKey: string | null | undefined, enabled: boolean) {
  const [ids, setIds] = useState<string[]>([]);
  const pingRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    setIds([]);
    if (!enabled || !meId) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const sub = subscribeTyping({ conversationId, meId, channelKey }, (who) => {
      setIds((cur) => (cur.includes(who) ? cur : [...cur, who]));
      clearTimeout(timers.get(who));
      timers.set(who, setTimeout(() => {
        timers.delete(who);
        setIds((cur) => cur.filter((x) => x !== who));
      }, 4000));
    });
    pingRef.current = sub.ping;
    return () => {
      sub.close();
      pingRef.current = () => undefined;
      timers.forEach(clearTimeout);
    };
  }, [conversationId, meId, channelKey, enabled]);
  const ping = useCallback(() => pingRef.current(), []);
  return { typingIds: ids, ping };
}

/* ---------------- Một hội thoại ---------------- */

export type PickedChatFile = { uri: string; name: string; mime?: string | null; size?: number | null };

export function useChatThread(id: string) {
  const [detail, setDetail] = useState<ChatConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [focused, setFocused] = useState(false);
  const listRef = useRef(messages);
  listRef.current = messages;
  const pending = useRef(new Map<string, { text: string; files: PickedChatFile[]; uploaded: string[]; replyToId: string | null; mentions: string[] }>());
  const meRef = useRef<ChatMe | null>(null);
  const lastRead = useRef<string | null>(null);

  const loadDetail = useCallback(async () => {
    const d = await ChatService.conversationGet(id);
    setDetail(d);
    return d;
  }, [id]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [d, page] = await Promise.all([loadDetail(), ChatService.messages(id, { limit: 50 })]);
      void d;
      setMessages((cur) => mergeMessages(cur.filter((m) => m.local_status), page.items));
      setHasMore(page.has_more);
      if (meRef.current) setReadAt(othersReadAt(page, meRef.current.employee_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không mở được cuộc trò chuyện");
    } finally {
      setLoading(false);
    }
  }, [id, loadDetail]);

  const fetchNew = useCallback(async () => {
    const after = latestServerTime(listRef.current);
    if (!after) return reload();
    try {
      const page = await ChatService.messages(id, { after, limit: 100 });
      setMessages((cur) => mergeMessages(cur, page.items));
      if (meRef.current) setReadAt(othersReadAt(page, meRef.current.employee_id));
    } catch {
      /* lần sau thử lại */
    }
  }, [id, reload]);

  const onEvent = useCallback(
    (e: ChatEvent) => {
      const p = e.payload ?? {};
      const cid = p.conversation?.id ?? p.conversation_id ?? p.message?.conversation_id;
      if (cid !== id) return;
      if ((e.event === "message_new" || e.event === "message_updated") && p.message) {
        setMessages((cur) => mergeMessages(cur, [p.message as ChatMessage]));
      } else if (e.event === "read") {
        if (p.employee_id !== meRef.current?.employee_id && p.last_read_at) {
          setReadAt((cur) => (!cur || p.last_read_at > cur ? p.last_read_at : cur));
        }
      } else {
        void loadDetail().catch(() => undefined);
      }
    },
    [id, loadDetail],
  );
  const session = useChatSession(onEvent, () => void fetchNew());
  meRef.current = session.me;

  useEffect(() => {
    if (session.me) void reload();
  }, [session.me, reload]);
  useEffect(() => {
    if (session.error) {
      setError(session.error);
      setLoading(false);
    }
  }, [session.error]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Dự phòng: realtime rớt, hoặc mình chưa là thành viên (không nhận chat:u của hội thoại này).
  const isMember = !!detail?.me;
  useEffect(() => {
    if (!focused) return;
    const t = !session.live || !isMember ? setInterval(() => void fetchNew(), POLL_MS) : null;
    const sub = AppState.addEventListener("change", (s) => s === "active" && void fetchNew());
    return () => {
      if (t) clearInterval(t);
      sub.remove();
    };
  }, [focused, session.live, isMember, fetchNew]);

  // Đang mở + là thành viên + có tin mới của người khác → đánh dấu đã đọc.
  useEffect(() => {
    if (!focused || !isMember || !session.me) return;
    const last = [...messages].reverse().find((m) => !m.local_status);
    if (!last || lastRead.current === last.id) return;
    lastRead.current = last.id;
    void ChatService.markRead(id).catch(() => {
      lastRead.current = null;
    });
  }, [focused, isMember, messages, id, session.me]);

  const loadOlder = useCallback(async () => {
    const oldest = listRef.current.find((m) => !m.local_status);
    if (!oldest || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await ChatService.messages(id, { before: oldest.created_at, limit: 50 });
      setMessages((cur) => mergeMessages(cur, page.items));
      setHasMore(page.has_more);
    } catch {
      /* cuộn lại để thử */
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, id, loadingOlder]);

  const deliver = useCallback(
    async (clientId: string): Promise<string | null> => {
      const job = pending.current.get(clientId);
      if (!job) return null;
      const localId = `local-${clientId}`;
      setMessages((cur) => cur.map((m) => (m.id === localId ? { ...m, local_status: "sending" } : m)));
      try {
        for (const f of job.files.slice(job.uploaded.length)) {
          job.uploaded.push(
            await ChatService.upload(id, { uri: f.uri, name: f.name, mime: chatFileMime(f.name, f.mime), size: f.size ?? 0 }),
          );
        }
        const sent = await ChatService.send(id, {
          client_msg_id: clientId,
          noi_dung: job.text.trim() || null,
          attachment_ids: job.uploaded,
          ...(job.replyToId ? { reply_to_id: job.replyToId } : {}),
          ...(job.mentions.length ? { mentions: job.mentions } : {}),
        });
        pending.current.delete(clientId);
        // Giữ ảnh cục bộ để khỏi xin link ký ngay sau khi gửi.
        const local = job.files.map((f) => f.uri);
        setMessages((cur) =>
          mergeMessages(cur, [{ ...sent, attachments: sent.attachments.map((a, i) => ({ ...a, local_uri: local[i] })) }]),
        );
        return null;
      } catch (e) {
        setMessages((cur) => cur.map((m) => (m.id === localId ? { ...m, local_status: "failed" } : m)));
        return e instanceof Error ? e.message : "Gửi tin nhắn thất bại";
      }
    },
    [id],
  );

  const send = useCallback(
    (text: string, files: PickedChatFile[], opts: { replyTo?: ChatMessage | null; mentions?: string[] } = {}) => {
      const me = meRef.current;
      const clientId = newClientId();
      const replyTo = opts.replyTo ?? null;
      pending.current.set(clientId, { text, files, uploaded: [], replyToId: replyTo?.id ?? null, mentions: opts.mentions ?? [] });
      const local: ChatMessage = {
        id: `local-${clientId}`,
        conversation_id: id,
        sender_type: "employee",
        sender: { id: me?.employee_id ?? null, ten: me?.ho_ten ?? null, anh: me?.anh ?? null, loai: "employee" },
        loai: files.length ? "file" : "text",
        noi_dung: text.trim() || null,
        reply_to: replyTo ? { id: replyTo.id, noi_dung: replyTo.noi_dung, sender_ten: replyTo.sender?.ten ?? null } : null,
        mentions: opts.mentions ?? null,
        system_event: null,
        edited_at: null,
        recalled_at: null,
        trang_thai_gui: null,
        client_msg_id: clientId,
        created_at: new Date().toISOString(),
        attachments: files.map((f, i) => ({
          id: `local-${clientId}-${i}`, ten_tep: f.name, mime: chatFileMime(f.name, f.mime), kich_thuoc: f.size ?? 0,
          rong: null, cao: null, local_uri: f.uri,
        })),
        local_status: "sending",
      };
      setMessages((cur) => mergeMessages(cur, [local]));
      return deliver(clientId);
    },
    [deliver, id],
  );

  const retry = useCallback(
    (messageId: string) => {
      const m = listRef.current.find((x) => x.id === messageId);
      return m?.client_msg_id ? deliver(m.client_msg_id) : Promise.resolve(null);
    },
    [deliver],
  );

  const discard = useCallback((messageId: string) => {
    const m = listRef.current.find((x) => x.id === messageId);
    if (m?.client_msg_id) pending.current.delete(m.client_msg_id);
    setMessages((cur) => cur.filter((x) => x.id !== messageId));
  }, []);

  /** Sửa / thu hồi tin của mình (server kiểm ≤ 24 giờ) – kết quả thay ngay trong danh sách. */
  const edit = useCallback(async (messageId: string, text: string) => {
    const m = await ChatService.edit(messageId, text.trim());
    setMessages((cur) => mergeMessages(cur, [m]));
  }, []);
  const recall = useCallback(async (messageId: string) => {
    const m = await ChatService.recall(messageId);
    setMessages((cur) => mergeMessages(cur, [m]));
  }, []);

  return {
    me: session.me, detail, setDetail, messages, readAt, hasMore, loading, error, loadingOlder,
    reload, loadOlder, send, retry, discard, edit, recall,
  };
}
