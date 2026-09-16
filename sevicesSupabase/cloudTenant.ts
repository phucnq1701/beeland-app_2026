import AsyncStorage from "@react-native-async-storage/async-storage";

function base64UrlDecodeToString(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "=".repeat(4 - pad);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let i = 0;
  // manual base64 decode (RN Hermes không có sẵn atob/Buffer)
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  while (i < clean.length) {
    const enc1 = chars.indexOf(clean.charAt(i++));
    const enc2 = chars.indexOf(clean.charAt(i++));
    const enc3 = chars.indexOf(clean.charAt(i++));
    const enc4 = chars.indexOf(clean.charAt(i++));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }
  // base64 bytes -> utf8 string
  try {
    // bytes are latin1, convert to utf8
    const bytes = Uint8Array.from(output.split("").map((c) => c.charCodeAt(0)));
    // TextDecoder có sẵn trên Hermes hiện đại, fallback nếu không có
    const TD: any = (globalThis as any).TextDecoder;
    if (TD) return new TD("utf-8").decode(bytes);
    // fallback: decodeURIComponent escape
    let s = "";
    for (let k = 0; k < bytes.length; k++) {
      s += "%" + ("00" + bytes[k].toString(16)).slice(-2);
    }
    return decodeURIComponent(s);
  } catch {
    return output;
  }
}

export function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const json = base64UrlDecodeToString(parts[1]);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidLike(v: any): boolean {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

/** JWT có dạng 3 phần base64url ngăn bởi dấu chấm */
export function looksLikeJwt(v: any): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s.length < 20 || s.split(".").length !== 3) return false;
  return /^[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]+$/.test(s);
}

function pickFirst(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && v) return String(v);
  }
  return "";
}

/**
 * Lấy giá trị UUID đầu tiên theo danh sách key.
 * QUAN TRỌNG (theo backend cloud-auth): `ma_ctdk`/`maCTDK` là MÃ TEXT (vd "msr"),
 * tenant UUID nằm ở `company_id`/`companyId`. Hàm này bỏ qua mọi giá trị không
 * phải UUID nên thứ tự key không còn gây sai tenant.
 */
function pickFirstUuid(obj: any, keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && UUID_RE.test(v.trim())) return v.trim();
  }
  return "";
}

/**
 * Tên claim/khóa có thể chứa tenant UUID.
 * Theo cloud-auth: tenant UUID = `company_id` (JWT) / `companyId` (response).
 * `ma_ctdk`/`maCTDK` là mã text — vẫn giữ trong list nhưng pickFirstUuid
 * sẽ tự bỏ qua vì không phải UUID.
 */
export const TENANT_KEYS = [
  "company_id",
  "companyId",
  "ma_ctdk_id",
  "ma_ctdk_uid",
  "maCtdkId",
  "maCtdkUid",
  "tenant_id",
  "tenantId",
  "tenant_uid",
  "ctdk_id",
  "ctdkId",
  "cid",
  "ma_ctdk",
  "maCtdk",
  "maCTDK",
];

/** UUID nhân viên (dm_employees.id). KHÔNG dùng `sub` (đó là auth user id). */
export const EMPLOYEE_KEYS = [
  "employee_id",
  "employeeId",
  "nhan_vien_id",
  "nhanVienId",
  "staff_id",
  "staffId",
];

/** UUID công ty/chi nhánh của nhân viên (dm_companies.id): branch trước, tenant sau. */
export const USER_COMPANY_KEYS = [
  "user_company_id",
  "userCompanyId",
  "dm_company_id",
  "dmCompanyId",
  "branch_id",
  "branchId",
  "ma_cty",
  "company_id",
  "companyId",
];

/**
 * Quét đệ quy object response để tìm chuỗi JWT (phòng backend đổi tên key).
 * Ưu tiên key có tên gợi ý jwt/token trước, sau đó quét toàn bộ.
 */
export function findJwtInObject(root: any, maxDepth = 4): string {
  if (!root || maxDepth < 0) return "";
  if (looksLikeJwt(root)) return String(root).trim();
  if (typeof root !== "object") return "";
  const entries = Array.isArray(root)
    ? root.map((v, i) => [String(i), v] as const)
    : Object.entries(root);
  // lượt 1: key gợi ý jwt/token
  for (const [k, v] of entries) {
    if (/jwt|token/i.test(k) && looksLikeJwt(v)) return String(v).trim();
  }
  // lượt 2: đệ quy (bỏ qua key nhiễu)
  for (const [k, v] of entries) {
    if (/^(avatar|image|icon|url|link|html|message|msg)$/i.test(k)) continue;
    if (v && typeof v === "object") {
      const found = findJwtInObject(v, maxDepth - 1);
      if (found) return found;
    }
  }
  return "";
}

/**
 * Quét đệ quy object để tìm UUID tenant theo key gợi ý.
 * Chỉ nhận giá trị UUID (bỏ qua mã text như maCTDK="msr"). Trả "" nếu không thấy.
 */
export function findTenantUuidInObject(root: any, maxDepth = 4): string {
  if (!root || maxDepth < 0) return "";
  if (typeof root !== "object") return "";
  const obj: any = root;
  const direct = pickFirstUuid(obj, TENANT_KEYS);
  if (direct) return direct;
  // metadata lồng nhau (supabase style)
  for (const nestKey of ["user_metadata", "app_metadata", "user", "data", "profile", "employee", "staff", "employeeRow"]) {
    const nested = obj?.[nestKey];
    if (nested && typeof nested === "object") {
      const v = pickFirstUuid(nested, TENANT_KEYS);
      if (v) return v;
    }
  }
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findTenantUuidInObject(item, maxDepth - 1);
      if (found) return found;
    }
    return "";
  }
  for (const [k, v] of Object.entries(obj)) {
    if (/^(avatar|image|icon|url|link|html|message|msg|password)$/i.test(k)) continue;
    if (v && typeof v === "object") {
      const found = findTenantUuidInObject(v, maxDepth - 1);
      if (found) return found;
    }
  }
  return "";
}

export function isJwtExpired(token: string, leewaySec = 30): boolean {
  if (!token) return true;
  try {
    const payload = decodeJwtPayload(token);
    const exp = Number(payload?.exp || 0);
    if (!exp) return false; // JWT không có exp (anon key) -> coi như không hết hạn
    const now = Math.floor(Date.now() / 1000);
    return exp <= now + leewaySec;
  } catch {
    return true;
  }
}

/** JWT còn hạn mới dùng được cho rest/v1, hết hạn thì trả null để caller fallback anon-key */
export async function getValidSupabaseJwt(): Promise<string | null> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (!jwt) return null;
  if (isJwtExpired(jwt)) {
    console.log("[Auth] @supabase_jwt expired, cần đăng nhập lại");
    return null;
  }
  return jwt;
}

/**
 * Lấy Tenant UUID (p_ma_ctdk cho RPC — chuẩn web = claim `company_id` trong JWT,
 * dự phòng `companyId` trong response login đã lưu).
 * Tuyệt đối KHÔNG dùng `ma_ctdk`/`maCTDK` (mã text). Trả "" nếu không có UUID hợp lệ.
 */
export async function getTenantId(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const id = pickFirstUuid(payload, TENANT_KEYS);
    if (id) return id;
    const nested = pickFirstUuid(
      { ...(payload?.user_metadata || {}), ...(payload?.app_metadata || {}) },
      TENANT_KEYS
    );
    if (nested) return nested;
  }
  const persisted =
    (await AsyncStorage.getItem("@tenant_id")) ||
    (await AsyncStorage.getItem("@company_id")) ||
    (await AsyncStorage.getItem("maCTDK_UUID")) ||
    "";
  if (persisted && UUID_RE.test(persisted.trim())) return persisted.trim();
  const stored = (await AsyncStorage.getItem("maCTDK")) || "";
  if (stored && UUID_RE.test(stored.trim())) return stored.trim();
  // KHÔNG trả về mã công ty dạng text (vd BRGHN-1) vì caller yêu cầu UUID;
  // trả "" để caller báo "hết phiên/đăng nhập lại" thay vì gọi API sai tenant.
  return "";
}

/** alias getCompanyId -> Tenant UUID */
export const getCompanyId = getTenantId;

/** Lấy Employee ID (UUID dm_employees — claim `employee_id` trong JWT). */
export async function getEmployeeId(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const id = pickFirstUuid(payload, EMPLOYEE_KEYS);
    if (id) return id;
    const nested = pickFirstUuid(
      { ...(payload?.user_metadata || {}), ...(payload?.app_metadata || {}) },
      EMPLOYEE_KEYS
    );
    if (nested) return nested;
  }
  const stored = (await AsyncStorage.getItem("@employee_id")) || "";
  return stored.trim();
}

/** UUID chi nhánh của nhân viên (claim `branch_id` trong JWT / `branchId` response). */
export async function getBranchId(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const id = pickFirstUuid(payload, ["branch_id", "branchId"]);
    if (id) return id;
  }
  const stored = (await AsyncStorage.getItem("@branch_id")) || "";
  if (stored && UUID_RE.test(stored.trim())) return stored.trim();
  return "";
}

/** Loại tài khoản: SYSTEM | AGENCY (claim `type_account` trong JWT). */
export async function getTypeAccount(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const t = pickFirst(payload, ["type_account", "typeAccount"]);
    if (t) return String(t).trim().toUpperCase();
  }
  const stored = (await AsyncStorage.getItem("@type_account")) || "";
  return stored.trim().toUpperCase();
}

/** Mã nhân viên (claim `ma_nv` trong JWT) — dùng để tra dm_employees khi thiếu employee_id. */
export async function getMaNv(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const t = pickFirst(payload, ["ma_nv", "maNV"]);
    if (t) return String(t).trim();
  }
  const stored = (await AsyncStorage.getItem("@ma_nv")) || "";
  return stored.trim();
}

/** Lấy Company ID của chi nhánh/đại lý (dm_companies) mà user trực thuộc */
export async function getUserCompanyId(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const id = pickFirstUuid(payload, USER_COMPANY_KEYS);
    if (id) return id;
    const nested = pickFirstUuid(
      { ...(payload?.user_metadata || {}), ...(payload?.app_metadata || {}) },
      USER_COMPANY_KEYS
    );
    if (nested) return nested;
  }
  const stored = (await AsyncStorage.getItem("@user_company_id")) || "";
  if (stored && UUID_RE.test(stored.trim())) return stored.trim();
  // fallback sang tenant id nếu không có công ty con riêng
  return getTenantId();
}

/**
 * Chuỗi company_ids cho RPC (chuẩn web):
 * - Tài khoản đại lý (AGENCY): branch_id của nhân viên.
 * - Tài khoản hệ thống (SYSTEM): "" = toàn bộ phạm vi quyền của nhân viên
 *   (JWT không có claim company_ids; server tự tính từ p_employee_id).
 */
export async function getUserCompanyIds(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const ids = payload?.company_ids || payload?.allowed_company_ids || payload?.user_metadata?.company_ids;
    if (Array.isArray(ids) && ids.length > 0) return ids.join(",");
    if (typeof ids === "string" && ids.trim()) return ids.trim();
  }
  const type = await getTypeAccount();
  if (type === "AGENCY") {
    const branchId = await getBranchId();
    if (branchId) return branchId;
  }
  return "";
}

/** company_code (text, vd msr) */
export async function getCompanyCode(): Promise<string> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const code = pickFirst(payload, [
      "company_code",
      "companyCode",
      "ma_ctdk_code",
      "tenant_code",
      "tenCTDKVT",
    ]);
    if (code && !UUID_RE.test(code)) return code;
    const nested = pickFirst(
      { ...(payload?.user_metadata || {}), ...(payload?.app_metadata || {}) },
      ["company_code", "companyCode", "tenCTDKVT"]
    );
    if (nested) return nested;
  }
  const codeStored =
    (await AsyncStorage.getItem("@company_code")) ||
    (await AsyncStorage.getItem("tenCTDKVT")) ||
    (await AsyncStorage.getItem("maCTDK")) ||
    "";
  return codeStored.trim();
}

/**
 * Lưu tenant_id, employee_id, company_id, code ngay lúc login — theo đúng
 * contract cloud-auth: tenant UUID = `companyId` (response) / `company_id` (JWT),
 * employee = `employeeId`/`employee.id`, branch = `branchId`/`employee.companyId`.
 * @param jwt cloud_jwt từ response login
 * @param fallbackCode mã công ty người dùng nhập (vd msr)
 * @param extraData toàn bộ response login
 */
export async function persistTenantFromJwt(
  jwt: string,
  fallbackCode = "",
  extraData?: any
): Promise<void> {
  try {
    const payload = decodeJwtPayload(jwt || "");
    const dataObj =
      extraData?.data && typeof extraData.data === "object" ? extraData.data : {};

    // 1. Tenant UUID: ưu tiên claim company_id trong JWT, sau đó companyId response
    let tenantId =
      pickFirstUuid(payload, TENANT_KEYS) ||
      pickFirstUuid(
        { ...(payload?.user_metadata || {}), ...(payload?.app_metadata || {}) },
        TENANT_KEYS
      );
    if (!tenantId && extraData) {
      tenantId =
        pickFirstUuid(extraData, TENANT_KEYS) ||
        pickFirstUuid(dataObj, TENANT_KEYS) ||
        findTenantUuidInObject(extraData);
    }
    if (tenantId) {
      await AsyncStorage.setItem("@tenant_id", tenantId);
      await AsyncStorage.setItem("@company_id", tenantId);
      await AsyncStorage.setItem("maCTDK_UUID", tenantId);
      // web dùng localStorage.cloud_company_id làm dự phòng — app lưu tương đương
      await AsyncStorage.setItem("@cloud_company_id", tenantId);
    } else {
      console.log("[Auth] WARN persistTenantFromJwt: không tìm thấy tenant UUID trong JWT/response");
    }

    // 2. Employee UUID: claim employee_id -> response employeeId / employee.id
    const empFromRes =
      pickFirstUuid(extraData || {}, EMPLOYEE_KEYS) ||
      pickFirstUuid(dataObj, EMPLOYEE_KEYS) ||
      pickFirstUuid((extraData as any)?.employee || {}, ["id", ...EMPLOYEE_KEYS]) ||
      pickFirstUuid(dataObj?.employee || {}, ["id", ...EMPLOYEE_KEYS]);
    const empId = pickFirstUuid(payload, EMPLOYEE_KEYS) || empFromRes;
    if (empId) {
      await AsyncStorage.setItem("@employee_id", empId);
    }

    // 3. Branch (dm_companies của nhân viên): claim branch_id -> response branchId / employee.companyId
    const branchFromRes =
      pickFirstUuid(extraData || {}, ["branch_id", "branchId"]) ||
      pickFirstUuid(dataObj, ["branch_id", "branchId"]) ||
      pickFirstUuid((extraData as any)?.employee || {}, ["companyId", "company_id"]) ||
      pickFirstUuid(dataObj?.employee || {}, ["companyId", "company_id"]);
    const branchId = pickFirstUuid(payload, ["branch_id", "branchId"]) || branchFromRes;
    if (branchId) {
      await AsyncStorage.setItem("@branch_id", branchId);
      await AsyncStorage.setItem("@user_company_id", branchId);
    } else {
      const userCid =
        pickFirstUuid(payload, USER_COMPANY_KEYS) ||
        pickFirstUuid(extraData || {}, USER_COMPANY_KEYS);
      if (userCid) await AsyncStorage.setItem("@user_company_id", userCid);
    }

    // 4. Mã NV + loại tài khoản (để tra dm_employees / phân biệt AGENCY)
    const maNv =
      pickFirst(payload, ["ma_nv", "maNV"]) ||
      pickFirst(dataObj, ["ma_nv", "maNV"]) ||
      pickFirst(extraData || {}, ["ma_nv", "maNV"]);
    if (maNv) await AsyncStorage.setItem("@ma_nv", maNv);
    const typeAcc =
      pickFirst(payload, ["type_account", "typeAccount"]) ||
      pickFirst(dataObj, ["type_account", "typeAccount"]) ||
      pickFirst(extraData || {}, ["type_account", "typeAccount"]);
    if (typeAcc) await AsyncStorage.setItem("@type_account", String(typeAcc).toUpperCase());

    const code =
      pickFirst(payload, [
        "company_code",
        "companyCode",
        "ma_ctdk_code",
        "tenant_code",
        "tenCTDKVT",
      ]) ||
      pickFirst(dataObj, ["maCTDK", "company_code", "companyCode"]) ||
      pickFirst(extraData || {}, ["maCTDK"]) ||
      fallbackCode;
    if (code) await AsyncStorage.setItem("@company_code", code);
    // maCTDK text (vd "msr") vẫn lưu riêng để hiển thị, KHÔNG dùng làm tenant
    const maCTDKText =
      pickFirst(dataObj, ["maCTDK"]) || pickFirst(extraData || {}, ["maCTDK"]);
    if (maCTDKText) await AsyncStorage.setItem("maCTDK", maCTDKText);
  } catch {}
}

/** Chẩn đoán nhanh phiên đăng nhập cho UI (để hiện nút "Đăng nhập lại" đúng lúc) */
export async function getSessionStatus(): Promise<{
  hasToken: boolean;
  hasJwt: boolean;
  jwtExpired: boolean;
  tenantId: string;
  hasTenant: boolean;
  ok: boolean;
  reason: string;
}> {
  const token = (await AsyncStorage.getItem("@token")) || "";
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  const tenantId = await getTenantId();
  const jwtExpired = jwt ? isJwtExpired(jwt) : true;
  const hasTenant = !!tenantId && UUID_RE.test(tenantId);
  let reason = "";
  if (!token && !jwt) reason = "missing_token";
  else if (!jwt) reason = "missing_jwt";
  else if (jwtExpired) reason = "jwt_expired";
  else if (!hasTenant) reason = "missing_tenant";
  return {
    hasToken: !!token,
    hasJwt: !!jwt,
    jwtExpired,
    tenantId,
    hasTenant,
    ok: !!jwt && !jwtExpired && hasTenant,
    reason,
  };
}
