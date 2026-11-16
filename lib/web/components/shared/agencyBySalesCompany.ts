// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/shared/agencyBySalesCompany.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Ô "Đại lý phân phối" theo Công ty bán hàng (spec booking-ctbh-dai-ly): chỉ đại lý đã liên kết với CTBH đang chọn
 * (`fn_company_agency_map().links` → `CompanyAgencyMap.agenciesOf`, id chữ thường). Chưa chọn CTBH hoặc chưa tải được liên kết ⇒ không lọc
 * (máy chủ vẫn chặn đại lý không thuộc CTBH bằng trigger trg_cloud_pgc_phieu_giucho_ctbh).
 */
type AgencyMap = Map<string, Set<string>> | null | undefined;

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function filterAgenciesBySalesCompany<T extends { ID?: unknown }>(list: T[], agenciesOf: AgencyMap, congTyBanHangId: string | null | undefined): T[] {
  const ctbh = lc(congTyBanHangId);
  if (!agenciesOf || !ctbh) return list;
  const allowed = agenciesOf.get(ctbh);
  return allowed ? list.filter((s) => allowed.has(lc(s.ID))) : [];
}

/** Đổi CTBH: đại lý đang chọn không thuộc CTBH mới ⇒ true (form bỏ đại lý). Bỏ chọn CTBH / chưa có đại lý / chưa có liên kết ⇒ false */
export function agencyToClear(maSan: string | null | undefined, newCongTyId: string | null | undefined, agenciesOf: AgencyMap): boolean {
  const san = lc(maSan);
  const ctbh = lc(newCongTyId);
  if (!san || !ctbh || !agenciesOf) return false;
  return !(agenciesOf.get(ctbh)?.has(san) ?? false);
}
