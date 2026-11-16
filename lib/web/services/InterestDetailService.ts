// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/InterestDetailService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { sessionCompanyCode } from "../_shims/lib/session";


/**
 * Mã công ty đăng nhập (multi-tenant).
 * Nguồn chuẩn: claim trong token đăng nhập; localStorage chỉ là dự phòng.
 */
export const currentMaCTDK = (): string => {
  const fromToken = sessionCompanyCode();
  if (fromToken) return fromToken;
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    return String(
      u?.data?.maCTDK ??
        u?.data?.MaCTDK ??
        u?.maCTDK ??
        u?.MaCTDK ??
        localStorage.getItem("maCTDK") ??
        localStorage.getItem("MaCTDK") ??
        ""
    ).trim();
  } catch {
    return (
      localStorage.getItem("maCTDK") ??
      localStorage.getItem("MaCTDK") ??
      ""
    ).trim();
  }
};


export { RECONCILE_STATUS_META } from "./finance/interest-details/types";
export type { ReconcileStatus, InterestDetail } from "./finance/interest-details/types";
