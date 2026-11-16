// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/caller-sales-company/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Nguồn khóa công ty: nhân viên CTBH, đại lý; null = tài khoản không bị khóa */
export type CallerSalesSource = "ctbh_staff" | "agency" | null;

/**
 * Công ty bán hàng của tài khoản đang gọi (fn_caller_sales_company). `forced` = tài khoản chỉ được dùng các công ty trong `companies`
 * (id chữ thường). Đại lý chưa liên kết CTBH: `source` "agency", `forced` false, `companies` [].
 */
export type CallerSalesCompany = {
  forced: boolean;
  source: CallerSalesSource;
  companies: { id: string; ten: string | null }[];
};
