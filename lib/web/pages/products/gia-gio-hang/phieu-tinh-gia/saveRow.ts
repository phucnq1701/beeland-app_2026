// ⚠️ TỰ SINH — trích nguyên văn logic từ web src/pages/products/gia-gio-hang/phieu-tinh-gia/index.tsx (scripts/sync-web-pricing.cjs): webPriceSheetSaveRow, webHandleEdit, webHandlePriceSheetSaved.
// KHÔNG SỬA TAY. Biến của component (state / props / hàm khác) truyền qua ctx.
// Web biên dịch với strict: false; trích ra khỏi component thì state mất kiểu suy luận ⇒ bỏ kiểm kiểu (hành vi kiểm bằng test so web).
// @ts-nocheck
/* eslint-disable */
import { priceSheetService } from "../../../../services/products/price-sheet";
import { submitPriceSheetAfterSave, takeSubmitApprovalFlag } from "../../../../components/PriceSheet/submitAfterSave";
import { toast } from "../../../../_shims/sonner";

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
type PriceSheet = any;

export interface WebHandleEditCtx {
  setEditingSheet: any;
  setFormProduct: any;
  setFormType: any;
  setFromTemplate: any;
  setIsFormOpen: any;
}

export function webHandleEdit(__ctx: WebHandleEditCtx): any {
  const { setEditingSheet, setFormProduct, setFormType, setFromTemplate, setIsFormOpen } = __ctx;
  return async (sheet: PriceSheet) => {
    // Luôn nạp lại bản ghi mới nhất từ cloud để có payload/snapshot đầy đủ
    let full: any = sheet;
    try {
      const fresh = await priceSheetService.get((sheet as any).id);
      if (fresh) full = fresh;
    } catch {
      /* dùng dữ liệu đang có nếu không tải được */
    }
    setEditingSheet(full);
    const snap = full.snapshot || {};
    const tt = full.payload?.TTHopDong || {};
    setFormType(
      full.product_type === "Thấp tầng" ||
        full.product_type === "low-rise" ||
        snap.isLowRise
        ? "low"
        : "high"
    );
    const savedProduct = snap.product || {};
    const gtv = tt?.GiaTriHopDong || {};
    const areaEdit =
      Number(savedProduct.DienTichThongThuy) ||
      Number(savedProduct.DienTichTT) ||
      Number(gtv.DienTichThongThuy) ||
      Number(snap.area) ||
      Number(full.area) ||
      0;
    const div = (a: any, b: any) =>
      Number(a) && Number(b) ? Number(a) / Number(b) : null;
    setFormProduct({
      // Ưu tiên toàn bộ sản phẩm đã lưu lúc tạo phiếu (giá, diện tích, VAT...)
      ...savedProduct,
      MaSP: savedProduct.MaSP ?? tt.MaSP ?? null,
      MaDA: savedProduct.MaDA ?? tt.MaDA ?? null,
      code: savedProduct.code || full.product_code,
      KyHieu: savedProduct.KyHieu || full.product_code || snap.productCode,
      TenDA: savedProduct.TenDA || snap.projectName,
      project_name:
        savedProduct.project_name || full.projects?.name || snap.projectName,
      TenLoaiBDS:
        savedProduct.TenLoaiBDS || snap.productType || full.product_name,
      product_type: savedProduct.product_type || full.product_type,
      TenView: savedProduct.TenView || snap.view,
      area: savedProduct.area ?? full.area ?? areaEdit,
      DienTichThongThuy: areaEdit || undefined,
      DTTimDuong:
        savedProduct.DTTimDuong ?? savedProduct.DTTimTuong ?? undefined,
      // Khôi phục giá gốc (trước CK) đã lưu trong phiếu để form không tính về 0
      TyLeVAT: savedProduct.TyLeVAT ?? gtv.TyLeVAT ?? undefined,
      TyLePhiBaoTri:
        savedProduct.TyLePhiBaoTri ?? gtv.TyLePhiBaoTri ?? undefined,
      DonGiaChuaVAT:
        savedProduct.DonGiaChuaVAT ??
        gtv.DonGiaChuaVAT ??
        div(gtv.TongChuaVAT, areaEdit) ??
        undefined,
      DonGiaDaVAT:
        savedProduct.DonGiaDaVAT ??
        gtv.DonGiaGomVAT ??
        div(gtv.TongGomVAT, areaEdit) ??
        undefined,
      TongGiaChuaVAT: savedProduct.TongGiaChuaVAT ?? gtv.TongChuaVAT ?? undefined,
      TongGiaDaVAT: savedProduct.TongGiaDaVAT ?? gtv.TongGomVAT ?? undefined,
      TienVAT: savedProduct.TienVAT ?? gtv.TienVAT ?? undefined,
      TienPhiBaoTri:
        savedProduct.TienPhiBaoTri ?? gtv.TienPhiBaoTri ?? undefined,
      TongGomPBT:
        savedProduct.TongGomPBT ?? gtv.TongGiaGomVATPBT ?? undefined,
      DGDatPB: savedProduct.DGDatPB ?? gtv.DGDatPB ?? undefined,
      DonGiaDat: savedProduct.DonGiaDat ?? gtv.DonGiaDat ?? undefined,
      DonGiaXD:
        savedProduct.DonGiaXD ?? savedProduct.DonGiaXayDung ?? gtv.DonGiaXD ?? undefined,
    });

    setFromTemplate(null);
    setIsFormOpen(true);
  };
}

export interface WebHandlePriceSheetSavedCtx {
  editingSheet: any;
  fetchSheets: any;
  formProduct: any;
  formType: any;
  patchRows: any;
  setEditingSheet: any;
}

export function webHandlePriceSheetSaved(__ctx: WebHandlePriceSheetSavedCtx): any {
  const { editingSheet, fetchSheets, formProduct, formType, patchRows, setEditingSheet } = __ctx;
  return async (payload: any) => {
    const submitApproval = takeSubmitApprovalFlag(payload);
    try {
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
      const isUpdate = !!editingSheet?.id;
      // 1 lời gọi: máy chủ suy căn / dự án / khách, ghi phiên bản + giá gốc căn, trả bản đầy đủ
      const saved = await priceSheetService.upsert(row);
      setEditingSheet(saved as any);
      // Số xem trước lúc mở form đã bị phiếu khác dùng ⇒ máy chủ cấp số mới
      const savedCode = saved?.sheet_code;
      const renumbered = !isUpdate && row.sheet_code && savedCode && savedCode !== row.sheet_code;
      if (submitApproval) {
        if (renumbered) toast.info(`Số phiếu ${row.sheet_code} đã được dùng, phiếu được cấp số ${savedCode}`);
        // gửi xong trạng thái + bước đang duyệt đổi ⇒ tải lại danh sách
        await submitPriceSheetAfterSave(saved as any);
        fetchSheets();
        return;
      }
      toast.success("Đã lưu nháp phiếu tính giá");
      if (renumbered) toast.info(`Số phiếu ${row.sheet_code} đã được dùng, phiếu được cấp số ${savedCode}`);
      if (isUpdate) patchRows([saved]);
      else fetchSheets();

    } catch (e: any) {
      toast.error(e?.message || "Không thể lưu phiếu tính giá");
    }
  };
}
