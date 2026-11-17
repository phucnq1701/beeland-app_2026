// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/shared/salesCompany.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { getCompanyAgencyMap } from "../../services/system/company";
import type { CompanyAgencyMap } from "../../services/system/company";

export interface SalesCompanyOption {
  value: string;
  label: string;
  /** Chỉ hiện, không chọn được (công ty đang lưu nhưng không thuộc tài khoản) */
  disabled?: boolean;
}

/**
 * Options "Công ty bán hàng" từ `fn_company_agency_map` — chỉ loại `cty_ban_hang`, đang hoạt động
 * (`State: true` = Ngừng, theo mapper). Công ty đang gán (`currentId`) luôn hiện: nếu đã ngừng thì kèm
 * "(ngừng hoạt động)", nếu không còn là CTBH thì thêm option "(không còn là Công ty bán hàng)".
 */
export function toSalesCompanyOptions(
  companies: CompanyAgencyMap["companies"],
  currentId?: string | null,
  currentName?: string | null
): SalesCompanyOption[] {
  const opts = companies
    .filter((c) => c.LoaiCT === "cty_ban_hang" && (!c.State || c.Id === currentId))
    .map((c) => ({ value: c.Id, label: c.TenCTVT + (c.State ? " (ngừng hoạt động)" : "") }));
  if (currentId && !opts.some((o) => o.value === currentId))
    opts.push({ value: currentId, label: `${currentName || currentId} (không còn là Công ty bán hàng)` });
  return opts;
}

/** Options ô LỌC "Công ty bán hàng" trên danh sách: mọi công ty loại `cty_ban_hang`, kể cả đã ngừng (để lọc chứng từ cũ), sắp theo tên */
export function toSalesCompanyFilterOptions(companies: CompanyAgencyMap["companies"]): SalesCompanyOption[] {
  return companies
    .filter((c) => c.LoaiCT === "cty_ban_hang")
    .map((c) => ({ value: c.Id, label: c.TenCTVT + (c.State ? " (ngừng hoạt động)" : "") }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

/** Tên thuần `TenCTVT` (không hậu tố) để lưu vào `TenCongTyBanHang`: tra trong danh sách đã nạp, rồi `currentName`, rồi null. */
export function salesCompanyNameOf(
  companies: CompanyAgencyMap["companies"],
  id?: string | null,
  currentName?: string | null
): string | null {
  if (!id) return null;
  return companies.find((c) => c.Id === id)?.TenCTVT || currentName || null;
}

/**
 * Hook: nạp `getCompanyAgencyMap()` một lần, trả options + tra tên theo id. `failed`: máy chủ lỗi (`supported: false` hoặc promise bị từ chối),
 * khác với danh sách rỗng hợp lệ; khi đó chỉ còn công ty đang lưu (tên như đã lưu, không gắn hậu tố "không còn là Công ty bán hàng").
 */
export function useSalesCompanyOptions(currentId?: string | null, currentName?: string | null) {
  const [companies, setCompanies] = useState<CompanyAgencyMap["companies"]>([]);
  /** id CTBH → id đại lý liên kết; null khi đang tải hoặc máy chủ lỗi (ô Đại lý phân phối không lọc) */
  const [agenciesOf, setAgenciesOf] = useState<CompanyAgencyMap["agenciesOf"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getCompanyAgencyMap()
      .then((m) => {
        if (!alive) return;
        setCompanies(m.companies);
        setFailed(m.supported === false);
        setAgenciesOf(m.supported === false ? null : m.agenciesOf ?? null);
      })
      .catch((e) => {
        console.warn("[useSalesCompanyOptions] không nạp được danh sách công ty", e);
        if (alive) setFailed(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(
    () =>
      failed
        ? currentId ? [{ value: currentId, label: currentName || currentId }] : []
        : toSalesCompanyOptions(companies, currentId, currentName),
    [companies, currentId, currentName, failed],
  );
  const nameOf = (id?: string | null): string | null => salesCompanyNameOf(companies, id, currentName);
  return { options, nameOf, loading, failed, agenciesOf };
}
