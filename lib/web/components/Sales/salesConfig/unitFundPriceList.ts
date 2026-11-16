// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/unitFundPriceList.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Quỹ căn → Bảng giá ở form chứng từ (Phiếu tính giá, Đặt cọc / Hợp đồng, Booking).
 * Spec docs/superpowers/specs/2026-11-06-quy-can-bang-gia-form-design.md:
 * - Ô Bảng giá chỉ có bảng giá gắn đúng quỹ căn đang chọn; bảng giá chưa gắn quỹ căn không dùng ở form.
 * - Tự chọn bảng giá ưu tiên nhỏ nhất có chứa căn (has_product, fn_get_current_price_lists); không có ⇒ giá gốc.
 * - Phiếu mới mặc định Quỹ CĐT (mã QUY_CDT).
 */
import type { PriceListUnitFund } from "../../../services/products/price-list";

export const DEFAULT_UNIT_FUND_CODE = "QUY_CDT";
export const NO_PRODUCT_SUFFIX = " · không có căn này";

/** Dòng bảng giá rút gọn, đã sắp theo độ ưu tiên */
export interface UnitFundPriceListRow {
  id: string;
  label: string;
  ma_quy_can?: string | null;
  /** true/false = bảng giá có / không có căn; vắng = máy chủ chưa trả (SP cũ) */
  has_product?: boolean | null;
}

export interface UnitFundPriceListOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

/** So 2 uuid không phân biệt hoa thường (SQL Server trả chữ HOA); rỗng không bằng gì */
export const sameId = (a: unknown, b: unknown): boolean => {
  const x = norm(a);
  return x !== "" && x === norm(b);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Giá trị uuid đầu tiên trong danh sách (dò uuid căn từ nhiều khóa của sản phẩm / phiếu) */
export const firstUuid = (...vals: unknown[]): string | null => {
  for (const v of vals) {
    const t = String(v ?? "").trim();
    if (UUID_RE.test(t)) return t;
  }
  return null;
};

/** Máy chủ chưa trả ma_quy_can (SP cũ, FE lên trước): không dòng nào có khóa ⇒ không lọc theo quỹ căn */
const unitFundUnknown = (rows: UnitFundPriceListRow[]): boolean =>
  rows.length > 0 && rows.every((r) => r.ma_quy_can === undefined);

export const defaultUnitFundId = (funds: PriceListUnitFund[]): string | null =>
  (funds.find((f) => String(f.ma ?? "").toUpperCase() === DEFAULT_UNIT_FUND_CODE) ?? funds[0])?.id ?? null;

export const priceListsOfUnitFund = (
  rows: UnitFundPriceListRow[],
  quyCanId: string | null | undefined
): UnitFundPriceListRow[] => {
  if (unitFundUnknown(rows)) return rows;
  return quyCanId ? rows.filter((r) => sameId(r.ma_quy_can, quyCanId)) : [];
};

export const pickPriceListForUnitFund = (
  rows: UnitFundPriceListRow[],
  quyCanId: string | null | undefined
): string | null => {
  const inFund = priceListsOfUnitFund(rows, quyCanId);
  const known = inFund.some((r) => typeof r.has_product === "boolean");
  const hit = known ? inFund.find((r) => r.has_product === true) : inFund[0];
  return hit?.id ?? null;
};

export const unitFundOfPriceList = (
  rows: UnitFundPriceListRow[],
  priceListId: string | null | undefined
): string | null => {
  const q = rows.find((r) => sameId(r.id, priceListId))?.ma_quy_can;
  return q ? String(q) : null;
};

export const priceListOptionsForUnitFund = (
  rows: UnitFundPriceListRow[],
  quyCanId: string | null | undefined,
  selectedId?: string | null
): UnitFundPriceListOption[] => {
  const opts: UnitFundPriceListOption[] = priceListsOfUnitFund(rows, quyCanId).map((r) =>
    r.has_product === false
      ? { value: r.id, label: `${r.label}${NO_PRODUCT_SUFFIX}`, disabled: true }
      : { value: r.id, label: r.label }
  );
  if (selectedId && !opts.some((o) => sameId(o.value, selectedId))) {
    const saved = rows.find((r) => sameId(r.id, selectedId));
    if (saved) opts.push({ value: saved.id, label: saved.label });
  }
  return opts;
};

/**
 * Quỹ căn + bảng giá lấy từ bộ lọc lưới (màn Bảng giá, Sản phẩm cao tầng) khi mở form tạo phiếu mới
 * (spec 2026-11-09-quy-can-theo-bo-loc-luoi). Không truyền ⇒ Quỹ CĐT như cũ.
 */
export interface UnitFundPreset {
  quyCanId?: string | null;
  priceListId?: string | null;
}

/** Quỹ căn: bộ lọc Quỹ căn của lưới; trống thì quỹ căn của bảng giá đang chọn trên lưới; vẫn trống ⇒ null (form dùng Quỹ CĐT) */
export const presetFromGrid = (a: {
  quyCanFilter?: string | null;
  priceListId?: string | null;
  priceListQuyCanId?: string | null;
}): UnitFundPreset => ({
  quyCanId: a.quyCanFilter || a.priceListQuyCanId || null,
  priceListId: a.priceListId || null,
});

/** Quỹ căn ban đầu của phiếu mới: quỹ căn preset nếu có trong danh mục (id theo danh mục), không thì Quỹ CĐT */
export const resolveInitialUnitFund = (
  funds: PriceListUnitFund[],
  presetQuyCanId: string | null | undefined
): string | null => funds.find((f) => sameId(f.id, presetQuyCanId))?.id ?? defaultUnitFundId(funds);

/** Bảng giá ban đầu: bảng giá preset nếu thuộc quỹ căn và không bị biết là thiếu căn; không thì tự chọn như cũ */
export const pickInitialPriceList = (
  rows: UnitFundPriceListRow[],
  quyCanId: string | null | undefined,
  preferredId: string | null | undefined
): string | null => {
  const hit = priceListsOfUnitFund(rows, quyCanId).find((r) => sameId(r.id, preferredId));
  return hit && hit.has_product !== false ? hit.id : pickPriceListForUnitFund(rows, quyCanId);
};

/** Tooltip ô Quỹ căn bị khóa (Đặt cọc / Góp vốn / Hợp đồng / Booking) */
export const UNIT_FUND_LOCK_REASON_NEW = "Quỹ căn lấy theo bộ lọc ở màn danh sách. Đổi bộ lọc Quỹ căn ngoài lưới để chọn quỹ khác";
/** Phiếu mới không có quỹ căn từ lưới (thấp tầng, sơ đồ, trang giao dịch, lưới không lọc) ⇒ Quỹ CĐT */
export const UNIT_FUND_LOCK_REASON_DEFAULT = "Phiếu mới mặc định Quỹ CĐT, không đổi được trong form";
export const UNIT_FUND_LOCK_REASON_SAVED = "Quỹ căn đã lưu theo phiếu, không đổi được";

/** id quỹ căn đúng như trong danh mục (máy chủ có thể trả uuid khác hoa thường) — để ô chọn khớp option; không thấy ⇒ giữ nguyên */
export const unitFundIdOf = (funds: PriceListUnitFund[], id: string | null | undefined): string | null =>
  id ? funds.find((f) => sameId(f.id, id))?.id ?? String(id) : null;

/** Tên quỹ căn theo id; chưa gắn ⇒ null */
export const unitFundNameOf = (funds: PriceListUnitFund[], id: string | null | undefined): string | null =>
  id ? funds.find((f) => sameId(f.id, id))?.name ?? null : null;
