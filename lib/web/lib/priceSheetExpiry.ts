// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/priceSheetExpiry.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Ngày hết hạn Phiếu tính giá (price_sheets.ngay_het_han): mặc định = hạn chính sách bán hàng (hieu_luc_den),
 * sửa được nhưng không muộn hơn hạn đó. Trống khi lưu ⇒ máy chủ điền theo chính sách.
 */
import { toIsoDate } from "./tdttHieuLuc";

/** Hạn của chính sách bán hàng ('YYYY-MM-DD'); không có hạn / không có chính sách ⇒ null */
export const policyExpiryDate = (policy: { hieu_luc_den?: unknown } | null | undefined): string | null =>
  toIsoDate(policy?.hieu_luc_den);

/** Ngày hết hạn phiếu hợp lệ: ≤ hạn CSBH; trống ⇒ hạn CSBH; CSBH không có hạn ⇒ giữ nguyên */
export const clampSheetExpiry = (value: unknown, policyDen: unknown): string | null => {
  const v = toIsoDate(value);
  const den = toIsoDate(policyDen);
  if (!v) return den;
  if (den && v > den) return den;
  return v;
};

export type SheetExpiryTag = { text: "Còn hạn" | "Hết hạn"; color: "green" | "red"; den: string };

/** Tag cột "Hạn phiếu": chỉ phiếu đã duyệt có hạn; null ⇒ không hiện */
export const sheetExpiryTag = (row: {
  status?: string;
  con_han?: boolean | number | null;
  ngay_het_han?: string | null;
}): SheetExpiryTag | null => {
  if (row?.status !== "approved") return null;
  const den = toIsoDate(row.ngay_het_han);
  if (!den) return null;
  if (row.con_han == null) return null;
  const con = row.con_han === true || row.con_han === 1;
  return con ? { text: "Còn hạn", color: "green", den } : { text: "Hết hạn", color: "red", den };
};
