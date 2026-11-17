// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/caller-sales-company/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Công ty bán hàng của tài khoản đang gọi (spec phan-bo-ctbh-chi-tiet-ck, fix-wave F1): nhân viên CTBH / đại lý có CTBH liên kết bị khóa
 * vào các công ty đó (máy chủ chặn công ty khác bằng 42501). Lỗi (vd API chưa có RPC) ⇒ coi như không khóa; máy chủ vẫn chặn khi lưu.
 */
import { rpcRaw } from "../../_core/rpc";
import { NOT_FORCED, fromCallerSalesCompany } from "./mapper";
import type { CallerSalesCompany } from "./types";

export * from "./types";
export { NOT_FORCED } from "./mapper";

export async function loadCallerSalesCompany(): Promise<CallerSalesCompany> {
  try {
    return fromCallerSalesCompany(await rpcRaw<Record<string, unknown>>("fn_caller_sales_company", {}));
  } catch {
    return NOT_FORCED;
  }
}
