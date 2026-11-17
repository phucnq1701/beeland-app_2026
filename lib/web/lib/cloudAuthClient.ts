// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/cloudAuthClient.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Phiên đăng nhập ứng dụng (S-M2, docs-claude/10-security.md):
 * - Refresh token nằm trong cookie HttpOnly `__Host-bl_rt` do edge function cloud-auth đặt —
 *   JavaScript không đọc được, nên XSS không lấy được phiên dài hạn. Có VITE_DOTNET_API_URL ⇒ gọi
 *   `<api>/api/fn/cloud-auth` (cookie gắn với host API .NET — đổi host thì đăng nhập lại một lần; API phải liệt kê
 *   origin web trong `Cors:Origins`, xem docs/CUTOVER.md của api_beeland).
 * - Cookie là session cookie (không Max-Age): trình duyệt xoá khi đóng. Phiên web trên máy chủ hết khi
 *   không refresh 2 giờ / tối đa 12 giờ từ lúc đăng nhập. Trình duyệt khôi phục phiên (giữ cả cookie) thì
 *   src/lib/browserSession.ts + authSessionReset.ts kết thúc phiên lúc khởi động.
 * - Access JWT (15 phút) lưu ở localStorage `cloud_jwt`, tự làm mới trước khi hết hạn.
 * - `cloud_session = "cookie"` đánh dấu phiên kiểu mới. Phiên cũ còn `cloud_auth_token`
 *   (token trong localStorage) được chuyển sang cookie ở lần làm mới đầu tiên.
 *
 * Không import supabase client (tránh vòng: selfhostClient → module này).
 */
import { SELFHOST_ANON_KEY } from "../_stubs/integrations/supabase/selfhostConfig";
import { edgeFunctionUrl } from "../_stubs/integrations/dotnet/edgeUrl";

export const JWT_EVENT = "beeland:cloud-jwt";
/** Máy chủ từ chối refresh (401 hết phiên / 403 bị khoá) — layout bắt để đưa về trang đăng nhập */
export const SESSION_EXPIRED_EVENT = "beeland:session-expired";
const SESSION_KEY = "cloud_session";
const LEGACY_TOKEN_KEY = "cloud_auth_token";
const JWT_KEY = "cloud_jwt";

/** Báo cho chatStore & Realtime: JWT đã bị xoá (đăng xuất / hết phiên). */
export function notifyJwtCleared() {
  try {
    window.dispatchEvent(new CustomEvent(JWT_EVENT, { detail: "" }));
  } catch {
    /* bỏ qua */
  }
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) || "";
    } catch {
      return "";
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* bỏ qua */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* bỏ qua */
    }
  },
};

/** Giây còn lại của JWT (âm/0 nếu hết hạn hoặc không đọc được) */
export const jwtSecondsLeft = (jwt: string): number => {
  try {
    const body = jwt.split(".")[1] || "";
    const claims = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return Number(claims?.exp ?? 0) - Date.now() / 1000;
  } catch {
    return 0;
  }
};

export const isCookieSession = () => ls.get(SESSION_KEY) === "cookie";
export const hasRefreshableSession = () => isCookieSession() || !!ls.get(LEGACY_TOKEN_KEY);

// Gateway chưa cho phép gửi cookie (preflight thiếu Allow-Credentials) ⇒ fetch kèm cookie
// bị trình duyệt chặn. Khi đó lùi về kiểu cũ: token phiên trong body (vẫn xoay vòng + băm ở máy chủ).
const NO_COOKIE_KEY = "cloud_auth_no_cookie";
const cookieBlocked = () => {
  try {
    return sessionStorage.getItem(NO_COOKIE_KEY) === "1";
  } catch {
    return false;
  }
};

async function postCloudAuth(payload: Record<string, unknown>, withCookie: boolean) {
  const jwt = ls.get(JWT_KEY);
  const res = await fetch(edgeFunctionUrl("cloud-auth"), {
    method: "POST",
    credentials: withCookie ? "include" : "omit",
    headers: {
      "Content-Type": "application/json",
      apikey: SELFHOST_ANON_KEY,
      Authorization: `Bearer ${jwt && jwtSecondsLeft(jwt) > 5 ? jwt : SELFHOST_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { status: res.status };
  } catch {
    return { status: res.status || 500, message: text.slice(0, 200) };
  }
}

/** Gọi edge function cloud-auth, gửi kèm cookie (credentials) và JWT hiện tại */
export async function callCloudAuth(payload: Record<string, unknown>): Promise<any> {
  if (!cookieBlocked()) {
    try {
      return await postCloudAuth(payload, true);
    } catch {
      // Lỗi mạng hoặc CORS chặn credentials — thử lại không cookie bên dưới
    }
  }
  try {
    const { cookie: _cookie, ...legacyPayload } = payload;
    const res = await postCloudAuth(legacyPayload, false);
    try {
      sessionStorage.setItem(NO_COOKIE_KEY, "1");
    } catch {
      /* bỏ qua */
    }
    return res;
  } catch (e: any) {
    return { status: 500, message: e?.message || "Không kết nối được dịch vụ xác thực" };
  }
}

/** Ghi kết quả phiên (login/refresh/verify) vào localStorage */
export function storeSessionTokens(res: any) {
  if (res?.session === "cookie") {
    ls.set(SESSION_KEY, "cookie");
    ls.del(LEGACY_TOKEN_KEY);
  } else if (res?.token) {
    ls.set(LEGACY_TOKEN_KEY, String(res.token));
  }
  if (res?.jwt) {
    ls.set(JWT_KEY, String(res.jwt));
    if (res.companyId) ls.set("cloud_company_id", String(res.companyId));
    try {
      window.dispatchEvent(new CustomEvent(JWT_EVENT, { detail: String(res.jwt) }));
    } catch {
      /* bỏ qua */
    }
  }
}

let inflight: Promise<any> | null = null;

/**
 * Lấy JWT mới bằng refresh token (cookie) — một lời gọi duy nhất dù nhiều nơi cùng cần.
 * Phiên cũ (token trong localStorage) được chuyển sang cookie ở lần này.
 * Trả về payload phiên (status 200) hoặc lỗi (status 401/403 ⇒ cần đăng nhập lại).
 */
export function refreshCloudJwt(): Promise<any> {
  if (inflight) return inflight;
  inflight = (async () => {
    const legacy = ls.get(LEGACY_TOKEN_KEY);
    if (!isCookieSession() && !legacy) return { status: 401, message: "Chưa đăng nhập" };
    const res = await callCloudAuth(
      legacy && !isCookieSession() ? { action: "refresh", token: legacy, cookie: true } : { action: "refresh" },
    );
    if (res?.status === 200 && res?.jwt) storeSessionTokens(res);
    else if (res?.status === 401) {
      ls.del(SESSION_KEY);
      ls.del(LEGACY_TOKEN_KEY);
    }
    if (res?.status === 401 || res?.status === 403) {
      try {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: res.status }));
      } catch {
        /* bỏ qua */
      }
    }
    return res;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Đảm bảo JWT còn ít nhất `minSeconds` giây trước khi gửi request dữ liệu */
export async function ensureFreshJwt(minSeconds = 30): Promise<string> {
  const jwt = ls.get(JWT_KEY);
  if (jwt && jwtSecondsLeft(jwt) > minSeconds) return jwt;
  if (!hasRefreshableSession()) return jwt;
  const res = await refreshCloudJwt();
  return res?.status === 200 ? String(res.jwt) : ls.get(JWT_KEY);
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Làm mới JWT trước khi hết hạn (giữ Realtime không bị ngắt khi tab để lâu) */
export function startJwtAutoRefresh() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => {
    if (!isCookieSession()) return;
    const jwt = ls.get(JWT_KEY);
    if (!jwt || jwtSecondsLeft(jwt) < 120) void refreshCloudJwt();
  }, 60_000);
  // Tab khác vừa làm mới JWT ⇒ báo cho Realtime của tab này
  window.addEventListener("storage", (e) => {
    if (e.key === JWT_KEY && e.newValue) {
      window.dispatchEvent(new CustomEvent(JWT_EVENT, { detail: e.newValue }));
    }
  });
}

/** Đăng xuất phía máy chủ (thu hồi phiên + xoá cookie) rồi dọn token cục bộ */
export async function signOutCloudSession() {
  // Refresh đang chạy sẽ xoay cookie: chờ xong để logout gửi đúng token mới nhất (máy chủ chỉ xoá theo token hiện tại)
  if (inflight) await inflight.catch(() => null);
  const legacy = ls.get(LEGACY_TOKEN_KEY);
  await callCloudAuth(legacy ? { action: "logout", token: legacy } : { action: "logout" }).catch(() => null);
  ls.del(SESSION_KEY);
  ls.del(LEGACY_TOKEN_KEY);
  ls.del(JWT_KEY);
  notifyJwtCleared();
}
