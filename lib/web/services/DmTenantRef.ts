// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/DmTenantRef.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { sessionCompanyId, resetSessionCache } from "../_shims/lib/session";
import { applyCloudSession } from "./CloudAuthService";
import { hasRefreshableSession, refreshCloudJwt } from "../lib/cloudAuthClient";

/**
 * Khóa tenant dùng khi GHI dữ liệu danh mục nội bộ (dm_companies / dm_employees).
 *
 * Chuẩn: `ma_ctdk` = uuid công ty đăng ký (cloud_companies.id) lấy TỪ TOKEN
 * đăng nhập (claim `company_id`). Không truyền mã công ty qua header/param.
 * Nếu phiên cũ chưa có claim, làm mới token qua `cloud-auth` (verify).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let refreshing: Promise<string | null> | null = null;

/** Làm mới token để lấy claim company_id cho các phiên đăng nhập cũ */
const refreshSession = async (): Promise<string | null> => {
  if (!hasRefreshableSession()) return null;
  try {
    const res = await refreshCloudJwt();
    if (res?.status !== 200) return null;
    const accountType =
      String(localStorage.getItem("account_type") || "SYSTEM").toUpperCase() === "AGENCY"
        ? "AGENCY"
        : "SYSTEM";
    applyCloudSession(res, accountType as "SYSTEM" | "AGENCY");
    resetSessionCache();
    const id = sessionCompanyId();
    return UUID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
};

/** uuid công ty đăng ký hiện tại (lấy từ token đăng nhập) */
export const tenantCompanyId = async (): Promise<string | null> => {
  const fromToken = sessionCompanyId();
  if (UUID_RE.test(fromToken)) return fromToken;

  if (!refreshing) refreshing = refreshSession().finally(() => (refreshing = null));
  return await refreshing;
};

export const resetTenantCompanyIdCache = () => {
  resetSessionCache();
};
