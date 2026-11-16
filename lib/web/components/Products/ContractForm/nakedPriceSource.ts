// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/nakedPriceSource.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Nạp Giá Naked gốc cho phiếu cũ chưa có giá đã chốt. Tách khỏi `roundVars.ts` vì
 * tệp này gọi service, còn `roundVars.ts` chỉ gồm hàm thuần.
 */
import { resolveBdsProductId } from "../../../services/BdsProductService";
import { ProductService } from "../../../_shims/services/Product";
import { getProductDetailById } from "../../../services/products/open-for-sale";
import { isLowRiseProduct } from "../../../utils/productType";
import { parseNaked, resolveSavedNakedGoc } from "./roundVars";

/** Đọc từ máy chủ, không dùng `snap.product` vì đó là ảnh chụp lúc tạo phiếu. */
function loadSheetNakedGoc(tt: any, savedProduct: any): Promise<number | null> {
  const productKey =
    tt?.SanPhamId ??
    tt?.san_pham_id ??
    savedProduct?.id ??
    savedProduct?.SanPhamId ??
    savedProduct?.san_pham_id ??
    tt?.MaSP ??
    savedProduct?.MaSP ??
    null;
  const maDA = tt?.MaDA ?? savedProduct?.MaDA;

  return resolveSavedNakedGoc(tt?.GiaTriHopDong?.GiaNaked, {
    readPriceList: async () => {
      if (productKey == null || tt?.MaDotGia == null) return null;
      const res: any = await ProductService.getSPByBG({
        MaSP: tt?.MaSP ?? savedProduct?.MaSP ?? productKey,
        ProductId: productKey,
        MaDA: maDA,
        MaDot: tt.MaDotGia,
      });
      return res?.data?.naked_price;
    },
    readProduct: async () => {
      if (productKey == null) return null;
      const id = await resolveBdsProductId(productKey, maDA);
      if (!id) return null;
      const product = await getProductDetailById(id);
      return product?.gia_naked;
    },
  });
}

/**
 * Phiếu cao tầng chưa có giá đã chốt: đọc giá rồi gọi `apply`, kể cả khi ra `null`.
 * Phiếu đã có giá thì không gọi API. Trả về hàm hủy cho cleanup của effect.
 */
export function applySheetNakedGoc(
  tt: any,
  snap: any,
  apply: (giaNaked: number | null) => void
): () => void {
  let alive = true;
  const isLowRise =
    !!snap?.isLowRise ||
    isLowRiseProduct({
      loaiSP: snap?.productType,
      product: snap?.product,
      maSP: tt?.MaCan,
    });
  if (!isLowRise && parseNaked(tt?.GiaTriHopDong?.GiaNaked) === null) {
    void loadSheetNakedGoc(tt, snap?.product).then((giaNaked) => {
      if (alive) apply(giaNaked);
    });
  }
  return () => {
    alive = false;
  };
}
