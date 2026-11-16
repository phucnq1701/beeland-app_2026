/**
 * SHIM VIẾT TAY — thay web src/services/Product.js (service cũ, đọc thẳng bảng) cho module web chép ở lib/web.
 * Chỉ hàm luồng phiếu tính giá app dùng; còn lại ⇒ lỗi "App không hỗ trợ".
 *  - getSPByBG: như web (dòng giá của căn trong bảng giá ⇒ mapPriceListItem), đọc qua fn_nv_app_gia_trong_bang_gia (= cùng luật
 *    web: ưu tiên product_id, bảng giá cũ khớp mã căn; mọi cột như select *).
 */
import { callNv } from "@/services/nvApi";
import { mapPriceListItem } from "../../services/priceListItem";
import { resolveBdsProductId } from "../../services/BdsProductService";

const unsupported = (name: string) => async () => {
  console.log(`[lib/web shim] app không hỗ trợ ProductService.${name}`);
  throw new Error(`App không hỗ trợ ProductService.${name}`);
};

export const ProductService: any = new Proxy(
  {
    /** Danh mục "Sàn giao dịch" (usePriceSheetCatalogs) — ô app không hiện (MaSan theo phiếu) ⇒ rỗng đúng dạng web */
    getSanGiaoDichAPI: async () => ({ status: 2000, data: [] }),
    /** web Product.js getSPByBG — cùng tham số / kết quả { status, data } */
    getSPByBG: async (payload: any) => {
      const maSP = payload?.MaSP ?? payload?.maSP;
      const maDot = payload?.MaDot ?? payload?.MaDotGia;
      const rawProductKey = payload?.ProductId ?? payload?.productId ?? maSP ?? null;
      if ((!maSP && !rawProductKey) || !maDot) return { status: 2000, data: null };
      try {
        const productId = await resolveBdsProductId(rawProductKey, payload?.MaDA ?? payload?.maDA);
        const row = await callNv<any>("fn_nv_app_gia_trong_bang_gia", {
          p_bang_gia_id: String(maDot),
          p_san_pham_id: productId || null,
          p_ma_sp: maSP ? String(maSP) : null,
        });
        if (!row) return { status: 2000, data: null };
        return { status: 2000, data: mapPriceListItem(row) };
      } catch (e: any) {
        return { status: 5000, message: e?.message || "Không tải được giá theo bảng giá" };
      }
    },
  },
  { get: (t: any, k) => (k in t ? t[k] : typeof k === "string" ? unsupported(k) : undefined) }
);

export default ProductService;
