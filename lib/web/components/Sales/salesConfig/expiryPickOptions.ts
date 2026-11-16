// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/expiryPickOptions.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Options ô chọn Phiếu tính giá / Chính sách bán hàng của form chứng từ, ẩn mục hết hạn tại Ngày ký (`@/lib/expiryPick`).
 * Dùng chung ContractForm, PriceSheetForm, BookingFormDialog.
 */
import { displayName, type ConfigOption } from "./approvedConfig";
import { pickOptions, policyInEffect, sheetInEffect, type PickOption } from "../../../lib/expiryPick";
import { sameId } from "./unitFundPriceList";
import { policiesOfTower } from "./policyScope";

type PickCtx = { ngay: unknown; selectedId?: string | null; allowIds?: Set<string> };

/**
 * Quỹ căn của 1 chính sách (manual 120): `ma_quy_can` (fn_get_sales_policies) hoặc `MaQuyCan` (dòng đã lưu nạp lại qua getPolicyById).
 * undefined = máy chủ chưa trả cột (API cũ); null = chính sách chưa gắn quỹ căn.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const policyUnitFundOf = (p: any): string | null | undefined =>
  p?.ma_quy_can !== undefined ? p.ma_quy_can : p?.MaQuyCan;

/**
 * Chính sách của quỹ căn đang chọn ở form chứng từ (như lịch thanh toán, manual 108): chính sách chưa gắn quỹ căn không hiện.
 * Không lọc khi chưa có quỹ căn hoặc máy chủ chưa trả ma_quy_can. Chính sách đang chọn luôn giữ (phiếu đã lưu / vừa đổi quỹ căn).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const policiesOfUnitFund = <T extends Record<string, any>>(
  policies: T[],
  quyCanId?: string | null,
  selectedId?: string | null,
): T[] => {
  const rows = policies || [];
  if (!quyCanId || rows.every((p) => policyUnitFundOf(p) === undefined)) return rows;
  return rows.filter((p) => sameId(policyUnitFundOf(p), quyCanId) || sameId(p?.ID, selectedId));
};

/** Chính sách `policyId` (trong danh sách) thuộc quỹ căn khác / chưa gắn — biết chắc từ máy chủ ⇒ không tự chọn, nhắc chọn lại */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const policyOutOfUnitFund = (policies: any[], quyCanId?: string | null, policyId?: unknown): boolean => {
  if (!quyCanId || !policyId) return false;
  const row = (policies || []).find((p) => sameId(p?.ID ?? p?.id, policyId));
  const fund = policyUnitFundOf(row);
  return !!row && fund !== undefined && !sameId(fund, quyCanId);
};

export const POLICY_OUT_OF_UNIT_FUND_WARNING = "Chính sách bán hàng đang chọn không thuộc quỹ căn này, vui lòng chọn lại chính sách";

/**
 * Chính sách bán hàng (dạng mapPolicyRow) đúng loại hình (cao tầng / thấp tầng; không loại ⇒ giữ), đúng quỹ căn của chứng từ
 * (`quyCanId`, manual 120), đúng tòa của căn (`toaId`, manual 121) và còn hiệu lực
 */
export const policyPickOptions = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  policies: any[],
  o: PickCtx & { isLow: boolean; quyCanId?: string | null; toaId?: string | null },
): PickOption[] =>
  pickOptions(
    policiesOfTower(policiesOfUnitFund(policies || [], o.quyCanId, o.selectedId), o.toaId, o.selectedId).filter((p) => {
      const loai = String(p?.LoaiHinh ?? "").toUpperCase();
      return !loai || loai === (o.isLow ? "THAPTANG" : "CAOTANG");
    }),
    {
      getId: (p) => p.ID,
      getLabel: (p) => displayName(p, "TenChinhSach"),
      inEffect: (p) => policyInEffect(p, o.ngay),
      selectedId: o.selectedId,
      allowIds: o.allowIds,
    },
  );

/** Phiếu tính giá (fn_get_price_sheets) còn hạn; nhãn "Số phiếu · Mã căn · Khách hàng" */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const priceSheetPickOptions = (sheets: any[], o: PickCtx): PickOption[] =>
  pickOptions(sheets || [], {
    getId: (s) => s.id,
    getLabel: (s) => `${s.sheet_code || "PTG"}${s.product_code ? ` · ${s.product_code}` : ""}${s.customer_name ? ` · ${s.customer_name}` : ""}`,
    inEffect: (s) => sheetInEffect(s, o.ngay),
    selectedId: o.selectedId,
    allowIds: o.allowIds,
  });

/** Options chính sách dạng ConfigOption (form Booking; booking mới chưa có giao dịch ⇒ allowIds rỗng); `quyCanId` lọc theo quỹ căn như policyPickOptions */
export const policyConfigPickOptions = (
  options: ConfigOption[],
  ngay: unknown,
  selectedId?: string | null,
  allowIds?: Set<string>,
  quyCanId?: string | null,
  toaId?: string | null,
): PickOption[] => {
  // Quỹ căn / tòa nằm ở raw (dòng fn_get_sales_policies); id = value
  const rows = (options || []).map((c) => ({ ...(c.raw ?? {}), ID: c.value }));
  const keep = new Set(policiesOfTower(policiesOfUnitFund(rows, quyCanId, selectedId), toaId, selectedId).map((r) => String(r.ID)));
  return pickOptions((options || []).filter((c) => keep.has(String(c.value))), {
    getId: (c) => c.value,
    getLabel: (c) => c.label,
    inEffect: (c) => policyInEffect(c.raw, ngay),
    selectedId,
    allowIds,
  });
};
