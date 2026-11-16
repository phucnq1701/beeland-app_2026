// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CloudAuthService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import {
  callCloudAuth,
  hasRefreshableSession,
  notifyJwtCleared,
  jwtSecondsLeft,
  refreshCloudJwt,
  signOutCloudSession,
  storeSessionTokens,
} from "../lib/cloudAuthClient";

export type CloudAuthResult = {
  status: number;
  message?: string;
  token?: string;
  menu?: any[];
  menuCongTy?: any[];
  [key: string]: any;
};

// Action quản trị: máy chủ xác định người thao tác qua JWT (web) hoặc token phiên cũ (nếu còn)
const withSession = (payload: Record<string, unknown>) => {
  const legacy = localStorage.getItem("cloud_auth_token") || "";
  return legacy ? { ...payload, token: legacy } : payload;
};

// Gọi qua fetch kèm cookie (refresh token HttpOnly) — xem src/lib/cloudAuthClient.ts
async function call(payload: Record<string, unknown>): Promise<CloudAuthResult> {
  const res = await callCloudAuth(payload);
  return (res as CloudAuthResult) ?? { status: 500, message: "Không có phản hồi từ Cloud" };
}

export const CloudAuthService = {
  login: (maCTDK: string, email: string, password: string, typeAccount: "SYSTEM" | "AGENCY") =>
    // cookie: true ⇒ máy chủ đặt refresh token vào cookie HttpOnly, JWT 15 phút (S-M2)
    call({ action: "login", maCTDK, email, password, typeAccount, cookie: true }),

  verify: (token: string) => call({ action: "verify", token }),

  /** Lấy lại quyền (menu / toàn quyền) mới nhất mà không đổi phiên */
  permissions: (token?: string) => call(token ? { action: "permissions", token } : { action: "permissions" }),

  /** Đăng xuất phía máy chủ (thu hồi phiên, xoá cookie) */
  logout: () => signOutCloudSession(),

  /** Mirror tài khoản + quyền menu từ API cũ lên Cloud sau khi đăng nhập thành công */
  mirror: (payload: {
    maCTDK: string;
    email: string;
    password: string;
    typeAccount: "SYSTEM" | "AGENCY";
    maNV?: any;
    maCT?: any;
    fullName?: string;
    phone?: string;
    role?: string;
    menu?: any[];
    menuCongTy?: any[];
    profile?: Record<string, unknown>;
  }) => call(withSession({ action: "mirror", ...payload })),

  /** Mirror hàng loạt tài khoản lên Cloud (tài khoản mới nhận mật khẩu mặc định) */
  mirrorBulk: (payload: {
    maCTDK: string;
    defaultPassword: string;
    users: Array<Record<string, unknown>>;
  }) => call(withSession({ action: "mirror-bulk", ...payload })),

  /** Gán nhóm quyền (vai trò) cho tài khoản Cloud */
  syncPerm: (payload: {
    maCTDK?: string;
    aliases?: string[];
    email?: string;
    maNV?: any;
    perID?: any;
    perName?: string | null;
    menu?: any[];
  }) => call(withSession({ action: "sync-perm", ...payload })),

  setPassword: (
    maCTDK: string,
    email: string,
    password: string,
    extra?: {
      aliases?: string[];
      maNV?: any;
      maCT?: any;
      fullName?: string;
      typeAccount?: "SYSTEM" | "AGENCY";
      /** Chỉ tạo khi chưa có tài khoản — đã có thì giữ nguyên mật khẩu */
      onlyCreate?: boolean;
    },
  ) => call(withSession({ action: "set-password", maCTDK, email, password, ...(extra ?? {}) })),

  /**
   * Tự đổi mật khẩu: máy chủ so mật khẩu hiện tại, thu hồi các phiên khác, không cấp phiên mới.
   * (`set-password` tự đổi không kèm mật khẩu cũ bị từ chối với người không phải quản trị.)
   */
  changePassword: (payload: { maCTDK?: string; email?: string; oldPassword: string; newPassword: string }) =>
    call(withSession({ action: "change-password", ...payload })),

  /** Danh sách tài khoản nhân viên Cloud theo công ty */
  listUsers: (payload: { maCTDK?: string; aliases?: string[]; maCT?: string }) =>
    call(withSession({ action: "list-users", ...payload })),
};


/** Áp session Cloud vào localStorage theo đúng format hệ thống đang dùng */
export function applyCloudSession(res: CloudAuthResult, accountType: "SYSTEM" | "AGENCY") {
  const { menu, menuCongTy, token, jwt, session, ...user } = res;
  localStorage.setItem("authUser", JSON.stringify({ ...user, typeAccount: accountType, source: "cloud" }));
  if (user.maNV) localStorage.setItem("maNV", String(user.maNV));
  localStorage.setItem("account_type", accountType);
  // Phiên web: refresh token nằm trong cookie HttpOnly; phiên cũ: token trong localStorage.
  // storeSessionTokens cũng phát sự kiện để Realtime nhận JWT mới.
  if (jwt) {
    storeSessionTokens({ session, token, jwt, companyId: user.companyId });
  } else {
    localStorage.removeItem("cloud_jwt");
    notifyJwtCleared();
    void supabase.realtime.setAuth();
  }
  // uuid công ty đăng ký lấy từ phiên đăng nhập (dự phòng khi token cũ chưa có claim)
  if (user.companyId) localStorage.setItem("cloud_company_id", String(user.companyId));
  else localStorage.removeItem("cloud_company_id");
  if (user.isFullAccess) localStorage.setItem("full_access", "1");
  else localStorage.removeItem("full_access");
  localStorage.setItem("menu", JSON.stringify(menu ?? []));
  localStorage.setItem("menu_congty", JSON.stringify(menuCongTy ?? []));
  try {
    window.dispatchEvent(new Event("beeland:full-access-changed"));
  } catch {
    /* ignore */
  }
}

/**
 * Nạp lại quyền của phiên hiện tại từ Cloud (dùng sau khi quản trị chỉnh quyền).
 * Trả về true nếu cập nhật thành công.
 */
export async function refreshSessionPermissions(): Promise<boolean> {
  if (!hasRefreshableSession()) return false;
  const token = localStorage.getItem("cloud_auth_token") || undefined;
  const accountType =
    (localStorage.getItem("account_type") || "SYSTEM").toUpperCase() === "AGENCY"
      ? "AGENCY"
      : "SYSTEM";
  const res = await CloudAuthService.permissions(token);
  if (res?.status !== 200) return false;
  applyCloudSession(token ? { ...res, token } : res, accountType);
  const { resetSessionCache } = await import("../_shims/lib/session");
  resetSessionCache();
  const { resetMenuPermissionCache } = await import("../_stubs/lib/menuPermissions");
  resetMenuPermissionCache();
  return true;
}

// Coi như hết hạn nếu còn dưới 60s
const jwtExpired = (jwt: string): boolean => jwtSecondsLeft(jwt) < 60;

/** Phiên hiện tại có JWT Cloud còn hiệu lực hay không */
export const hasValidCloudJwt = (): boolean => {
  const jwt = localStorage.getItem("cloud_jwt") || "";
  return !!jwt && !jwtExpired(jwt);
};

/**
 * Đảm bảo phiên đang có JWT Cloud hợp lệ (mọi truy vấn dữ liệu self-host
 * đều cần JWT này; thiếu nó thì PostgREST chạy với role anon → 42501 và
 * mọi danh mục/danh sách hiển thị rỗng).
 * - "ok": JWT còn hiệu lực
 * - "restored": phiên cũ (token localStorage) vừa được cấp lại JWT — màn hình nên tải lại
 * Phiên cookie (S-M2) làm mới im lặng và trả "ok" (request dữ liệu tự chờ JWT mới).
 * - "missing": không khôi phục được → cần đăng nhập lại
 */
export async function ensureCloudJwt(): Promise<"ok" | "restored" | "missing"> {
  if (hasValidCloudJwt()) return "ok";
  if (!hasRefreshableSession()) return "missing";
  const wasLegacy = !!localStorage.getItem("cloud_auth_token");
  try {
    const res = await refreshCloudJwt();
    if (res?.status !== 200 || !res?.jwt) return "missing";
    const { resetSessionCache } = await import("../_shims/lib/session");
    resetSessionCache();
    return wasLegacy ? "restored" : "ok";
  } catch {
    return "missing";
  }
}

/** Đăng nhập lại Cloud chỉ để lấy JWT (không đụng authUser/menu của phiên hiện tại) */
export async function acquireCloudJwt(
  maCTDK: string,
  email: string,
  password: string,
  typeAccount: "SYSTEM" | "AGENCY",
): Promise<boolean> {
  try {
    const res = await CloudAuthService.login(maCTDK, email, password, typeAccount);
    const jwt = res?.status === 200 ? String((res as any)?.jwt ?? "") : "";
    if (!jwt) return false;
    storeSessionTokens(res);
    const { resetSessionCache } = await import("../_shims/lib/session");
    resetSessionCache();
    return true;
  } catch {
    return false;
  }
}
