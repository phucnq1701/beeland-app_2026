// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/policyScope.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Phạm vi của chính sách bán hàng trên form chứng từ (manual 121, chủ dự án 2026-11-11):
 *  - Bảng giá áp dụng (`bang_gia_ids`): chọn chính sách trước, ô Bảng giá chỉ hiện bảng giá trong danh sách; rỗng = mọi bảng giá của quỹ căn.
 *  - Tòa áp dụng (`toa_ids`): chính sách chỉ hiện với căn thuộc tòa trong danh sách; rỗng = mọi tòa.
 * Dòng chính sách: `bang_gia_ids` / `toa_ids` (fn_get_sales_policies) hoặc `BangGiaIds` / `ToaIds` (dòng đã lưu nạp lại).
 * Máy chủ cũ chưa trả cột ⇒ coi như không giới hạn.
 */
import { idList } from "../../../services/DaSalesPolicyService";
import {
  priceListsOfUnitFund,
  sameId,
  type UnitFundPriceListOption,
  type UnitFundPriceListRow,
} from "./unitFundPriceList";

type PolicyLike = Record<string, unknown> | null | undefined;

/** Bảng giá áp dụng của chính sách; [] = không giới hạn */
export const policyPriceListIds = (p: PolicyLike): string[] => idList(p?.bang_gia_ids ?? p?.BangGiaIds);

/** Tòa áp dụng của chính sách; [] = mọi tòa */
export const policyTowerIds = (p: PolicyLike): string[] => idList(p?.toa_ids ?? p?.ToaIds);

/**
 * Chính sách dùng được cho căn ở tòa `toaId`: chính sách không giới hạn tòa, hoặc có tòa đó. Chưa biết tòa của căn ⇒ không lọc.
 * Chính sách đang chọn luôn giữ (phiếu đã lưu).
 */
export const policiesOfTower = <T extends Record<string, unknown>>(policies: T[], toaId?: string | null, selectedId?: string | null): T[] => {
  const rows = policies || [];
  if (!toaId) return rows;
  return rows.filter((p) => {
    const ids = policyTowerIds(p);
    return ids.length === 0 || ids.some((id) => sameId(id, toaId)) || sameId(p?.ID ?? p?.id, selectedId);
  });
};

/** Ô Bảng giá sau khi chọn chính sách: chỉ bảng giá của chính sách (giữ bảng giá đang chọn); chính sách không giới hạn ⇒ như cũ */
export const priceListOptionsForPolicy = (
  options: UnitFundPriceListOption[],
  policy: PolicyLike,
  selectedId?: string | null,
): UnitFundPriceListOption[] => {
  const ids = policyPriceListIds(policy);
  if (ids.length === 0) return options;
  return options.filter((o) => ids.some((id) => sameId(id, o.value)) || sameId(o.value, selectedId));
};

/**
 * Bảng giá cần áp sau khi người dùng chọn chính sách. `undefined` = giữ bảng giá hiện tại (chính sách không giới hạn,
 * hoặc bảng giá hiện tại nằm trong danh sách); string = bảng giá đầu tiên (theo ưu tiên) của chính sách, cùng quỹ căn, có căn;
 * null = chính sách không có bảng giá nào dùng được ⇒ bỏ bảng giá (giá gốc của căn).
 */
export const pickPriceListForPolicy = (
  rows: UnitFundPriceListRow[],
  quyCanId: string | null | undefined,
  policy: PolicyLike,
  currentId: string | null | undefined,
): string | null | undefined => {
  const ids = policyPriceListIds(policy);
  if (ids.length === 0) return undefined;
  if (currentId && ids.some((id) => sameId(id, currentId))) return undefined;
  const allowed = priceListsOfUnitFund(rows || [], quyCanId).filter((r) => ids.some((id) => sameId(id, r.id)));
  const known = allowed.some((r) => typeof r.has_product === "boolean");
  const hit = known ? allowed.find((r) => r.has_product === true) : allowed[0];
  return hit?.id ?? null;
};
