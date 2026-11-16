// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/caller-sales-company/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { CallerSalesCompany, CallerSalesSource } from "./types";

type Raw = Record<string, unknown>;

export const NOT_FORCED: CallerSalesCompany = Object.freeze({ forced: false, source: null, companies: [] }) as CallerSalesCompany;

/** JSON máy chủ → CallerSalesCompany; id chữ thường (cùng kiểu với danh sách fn_company_agency_map); thiếu công ty ⇒ không khóa */
export function fromCallerSalesCompany(d: Raw | null | undefined): CallerSalesCompany {
  const list = Array.isArray(d?.companies) ? (d.companies as Raw[]) : [];
  const companies = list
    .filter((c) => c?.id != null && String(c.id).trim() !== "")
    .map((c) => ({ id: String(c.id).trim().toLowerCase(), ten: c.ten == null || c.ten === "" ? null : String(c.ten) }));
  const source: CallerSalesSource = d?.source === "ctbh_staff" || d?.source === "agency" ? d.source : null;
  return { forced: (d?.forced === true || Number(d?.forced) === 1) && companies.length > 0, source, companies };
}
