/**
 * Đăng nhập bằng Face ID / vân tay (người dùng chốt 2026-11-02) – phần logic thuần, không import để test nạp được.
 * Phần gọi Keychain / Keystore + LocalAuthentication ở `lib/biometric.ts`; luồng ở `docs/auth.md`.
 */

export type LoginType = "INTERNAL" | "AGENCY";

/** Tài khoản đăng nhập (không có mật khẩu) – lưu thường để điền sẵn màn Đăng nhập / hiện nút Face ID. */
export type LoginAccount = { loginType: LoginType; companyCode: string; username: string };

/** Thông tin đăng nhập đầy đủ – CHỈ lưu trong Keychain / Keystore, khoá bằng sinh trắc học. */
export type BiometricCredential = LoginAccount & { password: string };

export type BiometricKind = "face" | "fingerprint" | "iris";

/** cancel: người dùng huỷ (im lặng); lockout: sai quá nhiều lần, hệ điều hành tạm khoá; other: lỗi khác. */
export type BiometricErrorKind = "cancel" | "lockout" | "other";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function toAccount(v: unknown): LoginAccount | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const companyCode = str(o.companyCode);
  const username = str(o.username);
  if (!companyCode || !username) return null;
  return { loginType: o.loginType === "AGENCY" ? "AGENCY" : "INTERNAL", companyCode, username };
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseAccount(raw: string | null | undefined): LoginAccount | null {
  return toAccount(parseJson(raw));
}

/** Mật khẩu giữ nguyên (không trim) – phải gửi đúng như người dùng đã nhập. */
export function parseCredential(raw: string | null | undefined): BiometricCredential | null {
  const v = parseJson(raw);
  const account = toAccount(v);
  const password = (v as { password?: unknown } | null)?.password;
  if (!account || typeof password !== "string" || !password) return null;
  return { ...account, password };
}

/** `@remember_login` của bản cũ (có mật khẩu dạng chữ) → chỉ giữ tài khoản để điền sẵn. */
export function legacyRememberedAccount(raw: string | null | undefined): LoginAccount | null {
  return parseAccount(raw);
}

/**
 * Máy đang đăng nhập từ bản cũ chưa có `@last_login` → dựng lại từ `@account_scope`
 * (`loginType:mã công ty:username`, chữ thường – `components/utils/accountScope.ts`), `tenCTDKVT`, `@type_account`.
 */
export function accountFromScope(
  scope: string | null | undefined,
  companyCode: string | null | undefined,
  typeAccount: string | null | undefined
): LoginAccount | null {
  if (!scope) return null;
  const [type, scopeCompany, ...rest] = scope.split(":");
  return toAccount({
    loginType: typeAccount === "AGENCY" || type === "agency" ? "AGENCY" : "INTERNAL",
    companyCode: str(companyCode) || scopeCompany,
    username: rest.join(":"),
  });
}

/** Khoá so sánh tài khoản – cùng quy ước `buildAccountScope` (trim + chữ thường). */
export function accountKey(a: LoginAccount): string {
  return [a.loginType, a.companyCode, a.username].map((p) => String(p || "").trim().toLowerCase()).join(":");
}

export function sameAccount(a: LoginAccount, b: LoginAccount): boolean {
  return accountKey(a) === accountKey(b);
}

/** Che bớt tài khoản để hiện dưới nút Face ID: `ngu***@abc.com`, `adm***`. */
export function maskUsername(username: string): string {
  const u = username.trim();
  const at = u.indexOf("@");
  const local = at > 0 ? u.slice(0, at) : u;
  const domain = at > 0 ? u.slice(at) : "";
  const keep = local.length > 3 ? 3 : local.length > 0 ? 1 : 0;
  return `${local.slice(0, keep)}***${domain}`;
}

/**
 * `types` = `LocalAuthentication.AuthenticationType` (1 vân tay, 2 khuôn mặt, 3 mống mắt).
 * iOS chỉ có một loại (Face ID hoặc Touch ID). Android có thể báo cả mở khoá khuôn mặt (thường là loại yếu, không
 * dùng được cho Keystore) → ưu tiên vân tay.
 */
export function pickBiometricKind(types: number[], isIOS: boolean): BiometricKind | null {
  const has = (t: number) => types.includes(t);
  const order: [number, BiometricKind][] = isIOS
    ? [[2, "face"], [1, "fingerprint"], [3, "iris"]]
    : [[1, "fingerprint"], [2, "face"], [3, "iris"]];
  return order.find(([t]) => has(t))?.[1] ?? null;
}

/** Dùng sau "bằng …": "Đăng nhập bằng Face ID", "Đăng nhập bằng vân tay". */
export function biometricLabel(kind: BiometricKind, isIOS: boolean): string {
  if (isIOS) return kind === "face" ? "Face ID" : "Touch ID";
  return kind === "fingerprint" ? "vân tay" : kind === "face" ? "khuôn mặt" : "mống mắt";
}

/** Thông điệp lỗi của expo-secure-store (iOS Keychain / Android BiometricPrompt) và mã lỗi expo-local-authentication. */
export function classifyBiometricError(message: string | null | undefined): BiometricErrorKind {
  const m = String(message ?? "").toLowerCase();
  if (/cancel/.test(m)) return "cancel";
  if (/lockout|locked out/.test(m)) return "lockout";
  return "other";
}

/** Tài khoản đã chọn "Không" khi được hỏi bật Face ID – không hỏi lại. */
export function parseDeclined(raw: string | null | undefined): string[] {
  const v = parseJson(raw);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function addDeclined(list: string[], key: string, max = 20): string[] {
  return [...list.filter((k) => k !== key), key].slice(-max);
}
