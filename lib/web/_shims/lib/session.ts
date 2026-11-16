/**
 * SHIM VIẾT TAY — thay `@/lib/session` của web (web đọc phiên đồng bộ: JWT trong localStorage) cho module web chép ở lib/web.
 * JWT app mang đúng bộ claim như web (cùng CloudAuthService.ClaimsFor) ⇒ giải mã JWT hiện tại, giữ bản sao trong bộ nhớ.
 * Gọi `await primeWebSession()` trước khi dùng module web (màn phiếu tính giá gọi khi mở; đăng nhập tài khoản khác ⇒ gọi lại).
 * Các hàm cùng tên / cùng ý nghĩa với web src/lib/session.ts.
 */
import { jwtPayload } from "@/lib/jwt";
import { getJwt, getUser } from "@/services/session";

export interface SessionClaims {
  sub?: string;
  email?: string | null;
  company_id?: string | null;
  company_code?: string | null;
  ma_ctdk?: string | null;
  ma_nv?: string | null;
  ma_ct?: string | null;
  per_id?: number | string | null;
  per_name?: string | null;
  package_code?: string | null;
  branch_id?: string | null;
  employee_id?: string | null;
  is_full_access?: boolean | null;
  type_account?: string | null;
  app_role?: string | null;
  exp?: number;
}

let claims: SessionClaims = {};

/** Nạp claim của phiên hiện tại (JWT app; thiếu ⇒ hồ sơ người dùng đã lưu) */
export async function primeWebSession(): Promise<void> {
  const fromJwt = (jwtPayload(await getJwt()) || {}) as SessionClaims;
  const u = await getUser();
  claims = {
    ...fromJwt,
    company_id: fromJwt.company_id ?? u?.company_id ?? null,
    ma_ctdk: fromJwt.ma_ctdk ?? u?.ma_ctdk ?? null,
    ma_nv: fromJwt.ma_nv ?? u?.ma_nv ?? null,
    branch_id: fromJwt.branch_id ?? u?.branch_id ?? null,
    employee_id: fromJwt.employee_id ?? u?.employee_id ?? null,
    type_account: fromJwt.type_account ?? u?.loai_tk ?? null,
    is_full_access: fromJwt.is_full_access ?? u?.toan_quyen ?? null,
  };
  // Web lưu thân phiên đăng nhập ở localStorage "authUser" (maCTDK / maNV / typeAccount / họ tên) và nhiều module đọc từ đó
  // (cloudTenant.readCloudTenant, CatalogSettingsService, booking nguoi_nhap…) ⇒ dựng bản tương đương trên localStorage trong bộ nhớ
  // (installWebRuntime) theo phiên app. Không có localStorage (chưa cài runtime) ⇒ bỏ qua.
  try {
    const ls = (globalThis as any).localStorage;
    if (ls)
      ls.setItem(
        "authUser",
        JSON.stringify({
          maCTDK: claims.ma_ctdk ?? null,
          maNV: claims.ma_nv ?? null,
          maCT: claims.ma_ct ?? null,
          email: claims.email ?? null,
          typeAccount: claims.type_account ?? null,
          fullName: u?.ho_ten ?? null,
          hoTen: u?.ho_ten ?? null,
          employeeId: claims.employee_id ?? null,
          branchId: claims.branch_id ?? null,
        })
      );
  } catch {
    // bỏ qua: chỉ là bộ nhớ phụ cho module web
  }
}

export const resetSessionCache = () => {
  claims = {};
};

const UUID_RE_SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sessionClaims = (): SessionClaims => claims;
export const sessionCompanyId = (): string => String(claims.company_id ?? "").trim();
/** Như web: mã chữ thường */
export const sessionCompanyCode = (): string => String(claims.company_code ?? claims.ma_ctdk ?? "").trim().toLowerCase();
export const sessionMaNV = (): string => String(claims.ma_nv ?? "").trim();
export const sessionPerId = (): number => {
  const n = Number(claims.per_id);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
export const sessionBranchId = (): string => String(claims.branch_id ?? "").trim();
export const sessionPermGroupUid = (): string => {
  const v = String(claims.per_id ?? "").trim();
  return UUID_RE_SESSION.test(v) ? v : "";
};
export const sessionEmployeeId = (): string => String(claims.employee_id ?? "").trim();
export const sessionIsFullAccess = (): boolean => claims.is_full_access === true;
export const sessionPackageCode = (): string => String(claims.package_code ?? "").trim();
export const sessionAccountType = (): "SYSTEM" | "AGENCY" =>
  String(claims.type_account ?? "SYSTEM").toUpperCase() === "AGENCY" ? "AGENCY" : "SYSTEM";
export const tenantScope = () => ({
  companyId: sessionCompanyId(),
  companyCode: sessionCompanyCode(),
  maNV: sessionMaNV(),
  perId: sessionPerId(),
  packageCode: sessionPackageCode(),
  branchId: sessionBranchId(),
  isFullAccess: sessionIsFullAccess(),
  accountType: sessionAccountType(),
});
