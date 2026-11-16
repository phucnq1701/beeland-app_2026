import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

import { jwtSecondsLeft } from "@/lib/jwt";
import { SESSION_KEYS } from "@/lib/sessionKeys";

import { NV_API_BASE } from "./config";

/**
 * Phiên đăng nhập của app nhân viên (bộ API riêng `fn_nv_app_dang_nhap` / `fn_nv_app_lam_moi_phien` / `fn_nv_app_dang_xuat`).
 *
 * - JWT (7 ngày) gửi kèm mọi lời gọi API; token phiên (xoay mỗi lần làm mới, tối đa 30 ngày) chỉ dùng để làm mới / đăng xuất.
 * - Tự làm mới khi JWT còn < 1 ngày hoặc máy chủ trả 401; một lần làm mới dùng chung cho mọi lời gọi đang chờ.
 * - Làm mới bị từ chối (401/403: hết phiên, bị khoá…) ⇒ xoá phiên + báo `onSessionExpired` để giao diện về màn đăng nhập.
 *
 * Khoá lưu: giữ tên cũ (`@supabase_jwt`, `@token`, `@tenant_id`…) trong giai đoạn chuyển đổi vì các màn chưa chuyển còn đọc;
 * đổi tên ở bước dọn cuối (docs/app-api-rieng.md phần 8).
 */
export const JWT_KEY = "@supabase_jwt";
export const TOKEN_KEY = "@token";
export const USER_KEY = "@nv_user";
const PROFILE_KEY = "@cloud_profile";

/** Làm mới sớm khi JWT còn dưới 1 ngày (JWT app 7 ngày). */
export const REFRESH_BEFORE_SEC = 24 * 60 * 60;

export interface NvUser {
  id: string | null;
  email: string | null;
  ho_ten: string | null;
  dien_thoai: string | null;
  ma_nv: string | null;
  loai_tk: "SYSTEM" | "AGENCY" | string | null;
  ma_ctdk: string | null;
  company_id: string | null;
  employee_id: string | null;
  branch_id: string | null;
  nhom_quyen_id: string | null;
  nhom_quyen: string | null;
  toan_quyen: boolean;
}

export interface NvSession {
  jwt: string;
  jwt_het_han?: string | null;
  token: string;
  phien_het_han?: string | null;
  nguoi_dung: NvUser;
}

type Listener = (reason: string) => void;
const listeners = new Set<Listener>();

/** Đăng ký nghe "phiên đã hết" (layout gốc đưa về màn đăng nhập). Trả hàm huỷ. */
export function onSessionExpired(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitExpired(reason: string) {
  for (const fn of Array.from(listeners)) {
    try {
      fn(reason);
    } catch {
      // một listener lỗi không chặn listener khác
    }
  }
}

export async function getJwt(): Promise<string> {
  return (await AsyncStorage.getItem(JWT_KEY).catch(() => null)) || "";
}

export async function getSessionToken(): Promise<string> {
  return (await AsyncStorage.getItem(TOKEN_KEY).catch(() => null)) || "";
}

export async function getUser(): Promise<NvUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as NvUser) : null;
  } catch {
    return null;
  }
}

/** Lưu phiên vừa cấp. `companyCodeTyped` = mã công ty người dùng gõ (hiển thị). */
export async function saveSession(s: NvSession, companyCodeTyped?: string): Promise<void> {
  const u = s.nguoi_dung || ({} as NvUser);
  const set: [string, string][] = [
    [JWT_KEY, s.jwt],
    [TOKEN_KEY, s.token],
    [USER_KEY, JSON.stringify(u)],
  ];
  // Khoá cũ các màn chưa chuyển còn đọc (cloudTenant.ts / CloudProfileService.ts) — cùng nghĩa như persistTenantFromJwt.
  const put = (k: string, v: string | null | undefined) => {
    if (v != null && String(v).trim() !== "") set.push([k, String(v)]);
  };
  put("@tenant_id", u.company_id);
  put("@company_id", u.company_id);
  put("maCTDK_UUID", u.company_id);
  put("@cloud_company_id", u.company_id);
  put("@employee_id", u.employee_id);
  put("@branch_id", u.branch_id);
  put("@user_company_id", u.branch_id);
  put("@ma_nv", u.ma_nv);
  put("@type_account", u.loai_tk ? String(u.loai_tk).toUpperCase() : null);
  put("@company_code", u.ma_ctdk);
  put("maCTDK", u.ma_ctdk);
  put("tenCTDKVT", companyCodeTyped);
  if (u.id && u.company_id) {
    set.push([PROFILE_KEY, JSON.stringify({
      id: u.id, companyId: u.company_id, HoTen: u.ho_ten || u.email || "", Email: u.email || "", DiDong: u.dien_thoai || null,
    })]);
  }
  await AsyncStorage.multiSet(set);
}

/** Xoá phiên trên máy (giữ @last_login, Face ID, cấu hình trang chủ — xem lib/sessionKeys.ts). */
export async function clearSession(): Promise<void> {
  const keys = Array.from(new Set([...SESSION_KEYS, USER_KEY]));
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {
    for (const k of keys) await AsyncStorage.removeItem(k).catch(() => undefined);
  }
}

let inflight: Promise<string> | null = null;

/**
 * Làm mới phiên (xoay token). Trả JWT mới; "" nếu không làm mới được.
 * 401/403 từ máy chủ ⇒ xoá phiên + báo hết phiên. Lỗi mạng ⇒ giữ phiên (thử lại lần sau).
 */
export function refreshSession(): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    const token = await getSessionToken();
    if (!token) return "";
    try {
      const res = await axios.post(`${NV_API_BASE}/fn_nv_app_lam_moi_phien`, { p_token: token }, {
        timeout: 20000, headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const s = res.data as NvSession;
      if (!s?.jwt || !s?.token) return "";
      // Người dùng vừa đăng xuất / đổi tài khoản trong lúc chờ ⇒ không ghi đè phiên mới.
      if ((await getSessionToken()) !== token) return await getJwt();
      await saveSession(s);
      return s.jwt;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        if ((await getSessionToken()) === token) {
          await clearSession();
          emitExpired(String(e?.response?.data?.message || "Phiên đăng nhập hết hạn"));
        }
      }
      return "";
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** JWT dùng được ngay (tự làm mới khi sắp / đã hết hạn). "" = chưa đăng nhập hoặc không làm mới được. */
export async function getFreshJwt(): Promise<string> {
  const jwt = await getJwt();
  if (!jwt) return "";
  const left = jwtSecondsLeft(jwt);
  if (left != null && left < REFRESH_BEFORE_SEC) {
    const next = await refreshSession();
    if (next) return next;
    return left > 30 ? jwt : ""; // làm mới lỗi mạng: JWT còn hạn thì vẫn dùng
  }
  return jwt;
}

/** Máy chủ báo 401 với JWT đang dùng ⇒ làm mới 1 lần. */
export async function recoverFrom401(): Promise<string> {
  return refreshSession();
}
