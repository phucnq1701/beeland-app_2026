// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/cloudTenant.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
export const readCloudTenant = (): string => {
  try {
    const user = JSON.parse(localStorage.getItem("authUser") || "{}");
    return String(user?.data?.maCTDK ?? user?.maCTDK ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
};