import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

import { setMenuGate } from "@/lib/featureConfig";
import { jwtPayload, jwtSecondsLeft } from "@/lib/jwt";
import { menuFormGate, moduleAllowed } from "@/lib/permissions";
import { SESSION_KEYS } from "@/lib/sessionKeys";

import { NV_API_BASE } from "./config";

/**
 * Phiên đăng nhập của app nhân viên (bộ API riêng `fn_nv_app_dang_nhap` / `fn_nv_app_lam_moi_phien` / `fn_nv_app_dang_xuat`).
 *
 * - JWT (7 ngày) gửi kèm mọi lời gọi API; token phiên (xoay mỗi lần làm mới, tối đa 30 ngày) chỉ dùng để làm mới / đăng xuất.
 * - Tự làm mới khi JWT còn < 1 ngày hoặc máy chủ trả 401; một lần làm mới dùng chung cho mọi lời gọi đang chờ.
 * - Làm mới bị từ chối (401/403: hết phiên, bị khoá…) ⇒ xoá phiên + báo `onSessionExpired` để giao diện về màn đăng nhập.
 *
 * Khoá lưu: GIỮ tên `@supabase_jwt` / `@token` / `@nv_user` (đổi tên ⇒ bản cập nhật đăng xuất mọi người). Các khoá cũ khác của lớp
 * Supabase (@tenant_id, @type_account…) không còn ghi / đọc — màn dùng `getSessionInfo()`; saveSession dọn phần còn sót.
 */
export const JWT_KEY = "@supabase_jwt";
export const TOKEN_KEY = "@token";
export const USER_KEY = "@nv_user";
/** Khoá lưu cũ của lớp Supabase / cloudTenant (bỏ 2026-11-17) — chỉ để dọn. */
const LEGACY_KEYS = [
  "@cloud_profile", "@company_id", "@tenant_id", "@cloud_company_id", "@employee_id", "@user_company_id", "@branch_id",
  "@ma_nv", "@type_account", "@company_code", "maCTDK_UUID", "maCTDK",
];

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
  /** Đường dẫn form được cấp / form công ty đăng ký (như localStorage menu / menu_congty của web). Phiên cũ: không có. */
  menu?: string[] | null;
  menu_cong_ty?: string[] | null;
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

export interface SessionInfo {
  companyId: string;
  employeeId: string;
  maNv: string;
  /** "SYSTEM" | "AGENCY" | "" */
  typeAccount: string;
  isAgency: boolean;
  /** mã chữ công ty (vd brg) */
  companyCode: string;
}

/**
 * Thông tin phiên cho màn hình (thay các khoá lưu cũ @type_account / @company_id / @ma_nv / @employee_id … của lớp Supabase):
 * người dùng của phiên (fn_nv_app_dang_nhap), thiếu thì đọc claim JWT phiên (cùng nguồn). Máy chủ vẫn là nơi kiểm quyền.
 */
export async function getSessionInfo(): Promise<SessionInfo> {
  const u = await getUser();
  const c = jwtPayload(await getJwt());
  const pick = (a: unknown, b: unknown) => String(a ?? "").trim() || String(b ?? "").trim();
  const typeAccount = pick(u?.loai_tk, c.type_account).toUpperCase();
  // Menu theo nhóm quyền như web — đặt cho lib/featureConfig (Trang chủ, Tất cả quản lý, tab menu, Tài khoản đều đọc phiên trước)
  const formGate = menuFormGate({ menu: u?.menu, menuCongTy: u?.menu_cong_ty, fullAccess: u?.toan_quyen === true });
  setMenuGate((id) => moduleAllowed(id, formGate));
  return {
    companyId: pick(u?.company_id, c.company_id),
    employeeId: pick(u?.employee_id, c.employee_id),
    maNv: pick(u?.ma_nv, c.ma_nv),
    typeAccount,
    isAgency: typeAccount === "AGENCY",
    companyCode: pick(u?.ma_ctdk, c.company_code ?? c.ma_ctdk).toLowerCase(),
  };
}

/** Lưu phiên vừa cấp. `companyCodeTyped` = mã công ty người dùng gõ (hiển thị). */
export async function saveSession(s: NvSession, companyCodeTyped?: string): Promise<void> {
  const u = s.nguoi_dung || ({} as NvUser);
  const set: [string, string][] = [
    [JWT_KEY, s.jwt],
    [TOKEN_KEY, s.token],
    [USER_KEY, JSON.stringify(u)],
  ];
  // Mã công ty người dùng gõ lúc đăng nhập (hiển thị). Các khoá cũ của lớp Supabase (@tenant_id, @type_account, @ma_nv…) không
  // còn ghi — màn đọc getSessionInfo(); vẫn nằm trong SESSION_KEYS để đăng xuất dọn phần còn sót từ bản cũ.
  if (companyCodeTyped && companyCodeTyped.trim()) set.push(["tenCTDKVT", companyCodeTyped.trim()]);
  await AsyncStorage.multiSet(set);
  // Khoá cũ của lớp Supabase còn sót từ bản trước (đã không màn nào đọc) ⇒ dọn luôn
  const keep = new Set(set.map(([k]) => k));
  await AsyncStorage.multiRemove(LEGACY_KEYS.filter((k) => !keep.has(k))).catch(() => undefined);
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
