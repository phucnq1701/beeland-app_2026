// ⚠️ TỰ SINH — trích nguyên văn logic từ web src/pages/products/gia-gio-hang/phieu-tinh-gia/index.tsx (scripts/sync-web-pricing.cjs): webPriceSheetSaveRow.
// KHÔNG SỬA TAY. Biến của component (state / props / hàm khác) truyền qua ctx.
// Web biên dịch với strict: false; trích ra khỏi component thì state mất kiểu suy luận ⇒ bỏ kiểm kiểu (hành vi kiểm bằng test so web).
// @ts-nocheck
/* eslint-disable */

export interface WebPriceSheetSaveRowCtx {
  editingSheet: any;
  formProduct: any;
  formType: any;
  payload: any;
}

export function webPriceSheetSaveRow(__ctx: WebPriceSheetSaveRowCtx): any {
  const { editingSheet, formProduct, formType, payload } = __ctx;
  const tt = payload?.TTHopDong || {};
  const snap = payload?._snapshot || {};
  const t = snap.totals || {};
  const area = Number(
        snap.area ?? formProduct?.DienTichThongThuy ?? formProduct?.area ?? 0
      );
  const row: any = {
        id: editingSheet?.id,
        sheet_code: tt.SoPhieu || (editingSheet as any)?.sheet_code || "",
        product_code: snap.productCode || tt.MaCan || formProduct?.KyHieu || "",
        product_name: snap.productType || formProduct?.TenLoaiBDS || null,
        product_type:
          snap.isLowRise ?? formType === "low" ? "Thấp tầng" : "Cao tầng",
        area,
        unit_price: Number(t.unitPriceVAT || 0),
        base_price: Number(
          t.totalContractValue ?? tt.GiaTriHopDongSauCK ?? tt.GiaTriHopDong ?? 0
        ),
        vat_rate: 10,
        maintenance_rate: 2,
        policy_name: snap.policyName || null,
        payload,
        snapshot: snap,
      };
  return { row };
}
