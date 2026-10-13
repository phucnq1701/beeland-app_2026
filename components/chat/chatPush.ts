import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { ChatService } from "@/sevicesSupabase/ChatService";
import { getValidSupabaseJwt } from "@/sevicesSupabase/cloudTenant";

/**
 * Push tin nhắn (docs/chat.md mục Thông báo). Máy chủ: bảng `chat_push_thiet_bi` + edge `chat-push` (beeland migration
 * 20261013150000_chat_push). App: xin quyền → Expo push token → `fn_chat_push_dang_ky` (mỗi lần mở app / đăng nhập);
 * đăng xuất → `fn_chat_push_huy`. Mọi lỗi nuốt im (push là phụ, không chặn luồng chính).
 */

type Notif = typeof import("expo-notifications");

const TOKEN_KEY = "@chat_push_token";
export const CHAT_CHANNEL = "chat";

let mod: Notif | null | undefined;
/** expo-notifications cần bản build có native module; bản build cũ nhận OTA → null (chỉ còn banner realtime). */
export function notifications(): Notif | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === "web") return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- nạp có điều kiện: bản build cũ không có native module
    mod = require("expo-notifications") as Notif;
  } catch {
    mod = null;
  }
  return mod;
}

/* ---------------- trạng thái đăng nhập (đăng xuất chỉ chuyển màn, JWT cũ còn trong máy) ---------------- */

let loggedOut = false;
const authListeners = new Set<() => void>();

export function isChatLoggedOut(): boolean {
  return loggedOut;
}

/** login.tsx / account.tsx gọi khi đăng nhập xong / đăng xuất → ChatNotifier nối lại kênh + đăng ký lại push. */
export function chatAuthChanged(isLoggedIn: boolean): void {
  loggedOut = !isLoggedIn;
  authListeners.forEach((l) => l());
}

export function onChatAuthChanged(l: () => void): () => void {
  authListeners.add(l);
  return () => authListeners.delete(l);
}

/* ---------------- hội thoại đang mở (không hiện banner của chính nó) ---------------- */

let activeChat: string | null = null;
export const getActiveChat = () => activeChat;
export function setActiveChat(id: string | null): void {
  activeChat = id;
}

/* ---------------- đăng ký / huỷ ---------------- */

let channelReady = false;
let registering: Promise<void> | null = null;
let rerun = false;

async function ensureChannel(n: Notif) {
  if (channelReady || Platform.OS !== "android") return;
  await n.setNotificationChannelAsync(CHAT_CHANNEL, {
    name: "Tin nhắn",
    importance: n.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 200, 120, 200],
    lockscreenVisibility: n.AndroidNotificationVisibility.PRIVATE,
  });
  channelReady = true;
}

async function doRegister(ask: boolean): Promise<void> {
  const n = notifications();
  if (!n || loggedOut) return;
  if (!(await getValidSupabaseJwt())) return;
  let perm = await n.getPermissionsAsync();
  if (!perm.granted && ask && perm.canAskAgain) perm = await n.requestPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel(n);
  const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await n.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  if (!token || loggedOut) return;
  await ChatService.pushRegister(token, Platform.OS === "ios" ? "ios" : "android");
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Đăng ký máy này cho NV đang đăng nhập (`ask`: được hỏi quyền thông báo nếu chưa từng từ chối). */
export function registerChatPush(ask = true): Promise<void> {
  if (registering) {
    // đang đăng ký dở (có thể bằng phiên cũ) → chạy lại một lượt sau khi xong
    rerun = true;
    return registering;
  }
  registering = doRegister(ask)
    .catch((e) => console.log("[chatPush] đăng ký lỗi:", e instanceof Error ? e.message : String(e)))
    .finally(() => {
      registering = null;
      if (rerun) {
        rerun = false;
        void registerChatPush(false);
      }
    });
  return registering;
}

/** Đăng xuất: gỡ máy khỏi NV (gọi TRƯỚC khi xoá JWT – fn_chat_push_huy cần JWT). */
export async function unregisterChatPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(TOKEN_KEY);
    if (await getValidSupabaseJwt()) await ChatService.pushUnregister(token);
  } catch (e) {
    console.log("[chatPush] huỷ lỗi:", e instanceof Error ? e.message : String(e));
  }
}
