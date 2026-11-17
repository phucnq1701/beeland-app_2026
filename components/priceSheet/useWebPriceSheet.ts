import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui";
import { useWebPriceSheetForm } from "@/lib/web/components/PriceSheet/PriceSheetForm.hook";
import { webHandleEdit, webHandlePriceSheetSaved } from "@/lib/web/pages/products/gia-gio-hang/phieu-tinh-gia/saveRow";
import { getBdsProductById } from "@/lib/web/services/BdsProductService";
import { isLowRiseProduct } from "@/lib/web/utils/productType";
import { primeWebSession } from "@/lib/web/_shims/lib/session";
import { installWebRuntime } from "@/lib/web/_shims/runtime";
import { onWebToast } from "@/lib/web/_shims/sonner";

/**
 * Form phiếu tính giá trên app = ĐÚNG logic form web (lib/web: thân PriceSheetForm chép nguyên văn thành useWebPriceSheetForm,
 * trang danh sách web: handleEdit / handlePriceSheetSaved). Lớp này chỉ làm phần "trang" của web:
 *  - Lập mới: căn = getBdsProductById (như PriceSheetProductPicker web), loại cao / thấp tầng theo căn.
 *  - Sửa: handleEdit web (nạp bản mới nhất, dựng lại sản phẩm từ ảnh chụp + giá đã lưu).
 *  - Lưu: handlePriceSheetSaved web (fn_price_sheet_save qua fn_nv_app_ptg_luu; máy chủ cấp số khi trống); duyệt vẫn trên web.
 * Toast của module web ⇒ toast app. Đóng form (sau lưu) ⇒ `closed` = phiếu vừa lưu (hoặc null).
 */
export function useWebPriceSheet({ productId, sheetId }: { productId?: string | null; sheetId?: string | null }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formProduct, setFormProduct] = useState<any>(null);
  const [formType, setFormType] = useState<"high" | "low">("high");
  const [editingSheet, setEditingSheet] = useState<any>(null);
  const [fromTemplate, setFromTemplate] = useState<any>(null);
  const [closed, setClosed] = useState<{ saved: any } | null>(null);
  const savedRef = useRef<any>(null);

  // Toast của module web (sonner shim) ⇒ toast app (cảnh báo hiện như lỗi để người dùng chú ý)
  useEffect(
    () =>
      onWebToast((t) => {
        if (t.message) toast.show({ type: t.type === "success" ? "success" : t.type === "info" ? "info" : "error", message: t.message });
      }),
    [toast]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      installWebRuntime();
      await primeWebSession();
      if (sheetId) {
        await webHandleEdit({ setEditingSheet, setFormProduct, setFormType, setFromTemplate, setIsFormOpen })({ id: sheetId });
      } else if (productId) {
        const p = await getBdsProductById(productId);
        if (!p) throw new Error("Không tìm thấy sản phẩm");
        if (!alive) return;
        setEditingSheet(null);
        setFromTemplate(null);
        setFormProduct(p);
        setFormType(isLowRiseProduct({ product: p }) ? "low" : "high");
        setIsFormOpen(true);
      }
      if (alive) setReady(true);
    })().catch((e: any) => {
      if (alive) setError(e?.message || "Không tải được dữ liệu");
    });
    return () => {
      alive = false;
    };
  }, [productId, sheetId]);

  const onSaveSuccess = webHandlePriceSheetSaved({
    editingSheet,
    formProduct,
    formType,
    setEditingSheet: (s: any) => {
      savedRef.current = s;
      setEditingSheet(s);
    },
    fetchSheets: () => {},
    patchRows: () => {},
  });

  const form = useWebPriceSheetForm({
    open: isFormOpen,
    onOpenChange: (v: boolean) => {
      setIsFormOpen(v);
      if (!v) setClosed({ saved: savedRef.current });
    },
    product: formProduct,
    type: "pricesheet",
    type2: formType === "low" ? "pricesheet-low" : "pricesheet-high",
    filterCondition: formProduct?.MaDA != null ? { MaDA: Number(formProduct.MaDA) } : {},
    initialSheet: fromTemplate ? null : editingSheet,
    fromTemplate,
    onSaveSuccess,
  });

  return { ready: ready && isFormOpen, error, form, formType, editingSheet, closed };
}
