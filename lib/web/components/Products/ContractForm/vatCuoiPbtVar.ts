// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/vatCuoiPbtVar.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Biến "5%VAT cuối + PBT" của công thức tiến độ thanh toán cao tầng: `VATCuoiPBT`
 * = cột Q "5%VAT đợt cuối + PBT" (price_list_items.tong_gia_vat_chua_tt) của sản phẩm trong bảng giá.
 * Danh mục biến: sys_pricing_fields_default TDTTCAOTANG / THEOLAN (database/manual/111_bien_vat_cuoi_pbt.sql).
 * Lưu kèm phiếu ở GiaTriHopDong.VATCuoiPBT để mở lại dùng đúng số lúc lập phiếu.
 */
export const VAT_CUOI_PBT_CODE = "VATCuoiPBT";
export const VAT_CUOI_PBT_LABEL = "5%VAT cuối + PBT";

/** Số của bảng giá / phiếu: trống hoặc không phải số ⇒ null (khác 0) */
const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

/** Cột Q của dòng bảng giá (kết quả getSPByBG) */
export function vatCuoiPbtFromPriceList(bg: Record<string, unknown> | null | undefined): number | null {
  return num(bg?.tong_gia_vat_chua_tt);
}

/** Số đã lưu kèm phiếu (có thể null); phiếu lưu trước khi có khoá ⇒ undefined để rơi về bảng giá */
export function vatCuoiPbtFromSaved(gt: Record<string, unknown> | null | undefined): number | null | undefined {
  if (!gt || !(VAT_CUOI_PBT_CODE in gt)) return undefined;
  return num(gt[VAT_CUOI_PBT_CODE]);
}

/**
 * Số đã lưu nếu phiếu có khoá (kể cả null), không thì `fallback`.
 * Không dùng `??`: số đã lưu là null (bảng giá lúc lập phiếu trống) vẫn phải giữ.
 */
export function vatCuoiPbtSavedOr<T>(gt: Record<string, unknown> | null | undefined, fallback: T): number | null | T {
  const saved = vatCuoiPbtFromSaved(gt);
  return saved === undefined ? fallback : saved;
}

/** Khoá lưu trong GiaTriHopDong. Chưa có số (chưa chọn bảng giá / phiếu cũ: undefined) ⇒ không ghi khoá */
export function vatCuoiPbtPayload(value: number | null | undefined): Record<string, number | null> {
  return value === undefined ? {} : { [VAT_CUOI_PBT_CODE]: num(value) };
}
