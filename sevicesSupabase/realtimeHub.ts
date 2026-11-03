import {
  HttpTransportType,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

import { API_URL, SUPABASE_ANON_KEY } from "./axiosApiSupabase";
import { getValidSupabaseJwt } from "./cloudTenant";

/**
 * Realtime của API .NET (thay Supabase Realtime từ 01/11/2026): hub SignalR `/api/realtime`, cùng giao thức web
 * `beeland-dotnet/src/integrations/dotnet/realtimeShim.ts` — gọi `Join(ref, topic, { private, self })` / `Leave(ref)` /
 * `Broadcast(ref, event, payload)`, nhận `broadcast(topic, isPrivate, event, payload)`.
 * Xác thực: JWT ứng dụng (`@supabase_jwt`) qua `access_token`, chưa có / hết hạn thì anon key (chỉ vào được `chatv:*`).
 * Kênh private (`chat:u:…`, `chat:c:…`) cần JWT đúng nhân viên → gọi `syncRealtimeAuth()` trước khi vào (như `setAuth` cũ).
 * Thay đổi bảng (`postgres_changes`): `subscribeTableChanges()` — gửi danh sách bảng theo dõi kèm `Join` như web, nhận
 * `postgres_changes(ref, ids, data)` với `data = { eventType, new, old (chỉ khoá chính), commit_timestamp }`. Server chỉ cho
 * tài khoản đã đăng nhập và tự lọc theo công ty + RLS (api-beeland-new `Realtime/RealtimeTables.cs`).
 * Chỉ dùng WebSocket, bỏ bước negotiate.
 */

type Listener = {
  onBroadcast: (event: string, payload: any) => void;
  onStatus: (live: boolean) => void;
  /** `ids` = id binding (theo `Topic.changes`) mà sự kiện khớp. */
  onChange?: (ids: number[], data: any) => void;
};

/** Một bảng cần theo dõi — cú pháp Supabase: `filter` dạng `cột=op.giá_trị` (eq|neq|lt|lte|gt|gte|in). */
export type TableChange = {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  table: string;
  schema?: string;
  filter?: string;
};

export type TableChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any>;
  old: Record<string, any>;
  commit_timestamp?: string;
};

type Topic = {
  name: string;
  isPrivate: boolean;
  /** `ref` của lần Join trên kết nối hiện tại; `null` khi chưa vào kênh. */
  ref: string | null;
  listeners: Set<Listener>;
  /** Bảng theo dõi (id binding = vị trí + 1); rỗng với kênh chỉ broadcast. */
  changes: TableChange[];
};

export type HubChannel = {
  send: (event: string, payload: unknown) => void;
  close: () => void;
};

const keyOf = (name: string, isPrivate: boolean) => `${isPrivate ? "p" : "c"}:${name}`;
const currentToken = async () => (await getValidSupabaseJwt()) || SUPABASE_ANON_KEY;

/** Mỗi topic chỉ Join một lần trên server, nhiều nơi nghe dùng chung (đếm tham chiếu). */
const topics = new Map<string, Topic>();
let conn: HubConnection | null = null;
let starting: Promise<void> | null = null;
/** Token kết nối hiện tại đang dùng (để biết khi nào phải nối lại bằng JWT mới). */
let usedToken = "";
let refSeq = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function setLive(t: Topic, live: boolean) {
  if (!live) t.ref = null;
  t.listeners.forEach((l) => l.onStatus(live));
}

async function join(c: HubConnection, t: Topic) {
  const ref = `r${++refSeq}`;
  try {
    const res: any = await c.invoke("Join", ref, t.name, {
      private: t.isPrivate,
      self: false,
      postgresChanges: t.changes.map((b, i) => ({
        id: i + 1,
        event: b.event,
        schema: b.schema ?? "public",
        table: b.table,
        filter: b.filter ?? null,
      })),
    });
    const ok = res?.ok === true;
    // Đã đóng / kết nối đã đổi trong lúc chờ → rời kênh vừa vào.
    if (topics.get(keyOf(t.name, t.isPrivate)) !== t || conn !== c) {
      if (ok) void c.invoke("Leave", ref).catch(() => undefined);
      return;
    }
    if (!ok) console.log(`[Realtime] Join ${t.name}:`, res?.error);
    if (ok) t.ref = ref;
    setLive(t, ok);
  } catch {
    setLive(t, false);
  }
}

function scheduleRetry() {
  if (retryTimer || !topics.size) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, 5000);
}

function connect(): Promise<void> {
  if (starting) return starting;
  const c = new HubConnectionBuilder()
    .withUrl(`${API_URL}/api/realtime`, {
      // Gọi lại mỗi lần nối / tự nối lại → JWT hết hạn (server đóng kết nối) thì lấy JWT mới.
      accessTokenFactory: async () => (usedToken = await currentToken()),
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (r) => Math.min(30_000, 1000 * 2 ** r.previousRetryCount) })
    .configureLogging(LogLevel.None)
    .build();
  c.on("broadcast", (topic: string, isPrivate: boolean, event: string, payload: any) => {
    topics.get(keyOf(topic, isPrivate))?.listeners.forEach((l) => l.onBroadcast(event, payload));
  });
  c.on("postgres_changes", (ref: string, ids: number[], data: any) => {
    topics.forEach((t) => {
      if (t.ref === ref) t.listeners.forEach((l) => l.onChange?.(ids, data));
    });
  });
  c.onreconnecting(() => topics.forEach((t) => setLive(t, false)));
  c.onreconnected(() => topics.forEach((t) => void join(c, t)));
  // Server đóng hẳn (không tự nối lại được) → nối lại từ đầu nếu còn kênh đang nghe.
  c.onclose(() => {
    if (conn !== c) return;
    conn = null;
    starting = null;
    topics.forEach((t) => setLive(t, false));
    scheduleRetry();
  });
  conn = c;
  starting = c.start().then(
    () => {
      if (conn === c) topics.forEach((t) => void join(c, t));
    },
    () => {
      if (conn !== c) return;
      conn = null;
      starting = null;
      scheduleRetry();
    },
  );
  return starting;
}

/** Bỏ kết nối hiện tại (các kênh chuyển "rớt"); `reconnect` → nối lại ngay nếu còn kênh. */
function dropConnection(reconnect: boolean) {
  const c = conn;
  conn = null;
  starting = null;
  topics.forEach((t) => setLive(t, false));
  if (c) void c.stop();
  if (reconnect && topics.size) void connect();
}

/**
 * Kết nối đang dùng token khác JWT hiện tại (vừa đăng nhập / đổi tài khoản / JWT mới) → nối lại bằng JWT mới và vào lại
 * các kênh. Gọi trước khi vào kênh private.
 */
export async function syncRealtimeAuth(): Promise<void> {
  const token = await currentToken();
  if (conn && usedToken && token !== usedToken) dropConnection(true);
}

/**
 * Nghe một kênh. `onStatus(true)` khi đã vào kênh (false khi rớt / bị từ chối); tự vào lại sau khi nối lại.
 * `send` chỉ gửi khi đã vào kênh.
 */
export function joinChannel(
  name: string,
  opts: { private?: boolean },
  onBroadcast: Listener["onBroadcast"],
  onStatus: Listener["onStatus"] = () => undefined,
): HubChannel {
  const isPrivate = !!opts.private;
  const key = keyOf(name, isPrivate);
  const listener: Listener = { onBroadcast, onStatus };
  let t = topics.get(key);
  if (!t) {
    t = { name, isPrivate, ref: null, listeners: new Set(), changes: [] };
    topics.set(key, t);
    t.listeners.add(listener);
    if (conn?.state === HubConnectionState.Connected) void join(conn, t);
    else void connect();
  } else {
    t.listeners.add(listener);
    if (t.ref) onStatus(true);
  }
  const topic = t;
  let open = true;
  return {
    send: (event, payload) => {
      if (open && topic.ref && conn?.state === HubConnectionState.Connected) {
        void conn.invoke("Broadcast", topic.ref, event, payload).catch(() => undefined);
      }
    },
    close: () => {
      if (!open) return;
      open = false;
      topic.listeners.delete(listener);
      if (topic.listeners.size) return;
      topics.delete(key);
      if (topic.ref && conn?.state === HubConnectionState.Connected) void conn.invoke("Leave", topic.ref).catch(() => undefined);
      topic.ref = null;
      // Không còn kênh nào → đóng kết nối.
      if (!topics.size) dropConnection(false);
    },
  };
}

let changeSeq = 0;

/**
 * Theo dõi thay đổi các bảng (như `supabase.channel(..).on("postgres_changes", ..)` của web). Mỗi lần gọi là một kênh
 * riêng; `onChange(data, index)` với `index` = vị trí bảng trong `changes`. Cần JWT đăng nhập (server từ chối anon) →
 * tự `syncRealtimeAuth()` trước khi vào kênh. Trả hàm huỷ.
 */
export function subscribeTableChanges(
  name: string,
  changes: TableChange[],
  onChange: (data: TableChangePayload, index: number) => void,
  onStatus: (live: boolean) => void = () => undefined,
): () => void {
  let closed = false;
  let ch: HubChannel | null = null;
  void (async () => {
    await syncRealtimeAuth();
    if (closed) return;
    const topicName = `${name}-${Date.now().toString(36)}${++changeSeq}`;
    const key = keyOf(topicName, false);
    const listener: Listener = {
      onBroadcast: () => undefined,
      onStatus,
      onChange: (ids, data) => {
        if (!data) return;
        ids.forEach((id) => {
          if (id >= 1 && id <= changes.length) onChange(data as TableChangePayload, id - 1);
        });
      },
    };
    const t: Topic = { name: topicName, isPrivate: false, ref: null, listeners: new Set([listener]), changes };
    topics.set(key, t);
    if (conn?.state === HubConnectionState.Connected) void join(conn, t);
    else void connect();
    ch = {
      send: () => undefined,
      close: () => {
        t.listeners.delete(listener);
        topics.delete(key);
        if (t.ref && conn?.state === HubConnectionState.Connected) void conn.invoke("Leave", t.ref).catch(() => undefined);
        t.ref = null;
        if (!topics.size) dropConnection(false);
      },
    };
  })().catch(() => onStatus(false));
  return () => {
    closed = true;
    ch?.close();
    ch = null;
  };
}
