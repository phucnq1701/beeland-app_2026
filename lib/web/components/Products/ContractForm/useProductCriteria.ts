// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/useProductCriteria.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Loại căn (tên), tòa (uuid khu), phòng ngủ (uuid phong_ngu), vị trí (uuid vi_tri) và tầng (uuid tang) của sản phẩm, dùng làm bối cảnh so điều kiện của chi tiết chiết khấu.
 * Lưới rút gọn, phiếu mở lại và hợp đồng mở từ danh sách thường không mang `MaKhu` / `MaLCH`, nên thiếu thì đọc
 * lại sản phẩm theo mã một lần (cache trong module). Đọc lỗi thì để trống: dòng điều kiện tương ứng không đạt.
 */
import { useEffect, useState } from "react";
import { getBdsProductById, resolveBdsProductId } from "../../../services/BdsProductService";
import { apartmentTypeName } from "../../../_extract/components/Products/ContractForm/ApartmentTypeField";

type Criteria = { loaiCan?: string; toaId?: string; phongNguId?: string; viTriId?: string; tangId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache = new Map<string, Promise<Criteria>>();

/** Chỉ dùng trong test */
export const __resetProductCriteriaCache = () => cache.clear();

const uuidOf = (v: unknown) => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : undefined;
};

const fromProduct = (p: unknown): Criteria => {
  const r = (p ?? {}) as Record<string, unknown>;
  return {
    loaiCan: apartmentTypeName(p) || undefined,
    toaId: uuidOf(r.MaKhu),
    phongNguId: uuidOf(r.MaSoPN),
    viTriId: uuidOf(r.ViTri),
    tangId: uuidOf(r.MaTang),
  };
};

/** Sản phẩm đầy đủ (đọc từ bds_products) luôn có khóa MaSoPN / ViTri / MaTang, kể cả khi trống; dòng rút gọn thì không ⇒ phải đọc lại */
const hasFullKeys = (p: unknown) => {
  const r = (p ?? {}) as Record<string, unknown>;
  return "MaSoPN" in r && "ViTri" in r && "MaTang" in r;
};

/** Ký hiệu căn có thể trùng giữa các dự án: tra uuid trong đúng dự án trước, rồi mới đọc sản phẩm */
const load = (id: string, maDA?: any): Promise<Criteria> => {
  const cacheKey = `${maDA ?? ""}|${id}`;
  let p = cache.get(cacheKey);
  if (!p) {
    p = resolveBdsProductId(id, maDA)
      .then((uid) => (uid ? getBdsProductById(uid) : null))
      .then(fromProduct)
      .catch(() => {
        cache.delete(cacheKey);
        return {};
      });
    cache.set(cacheKey, p);
  }
  return p;
};

export function useProductCriteria(product: unknown, maSP?: string | null, maDA?: any): Criteria & { loading: boolean } {
  const own = fromProduct(product);
  const complete = !!own.loaiCan && !!own.toaId && hasFullKeys(product);
  const id = String(maSP ?? (product as any)?.ID ?? "").trim();
  const need = !complete && !!id;
  const [state, setState] = useState<{ id: string; value: Criteria } | null>(null);

  useEffect(() => {
    if (!need) return;
    let alive = true;
    load(id, maDA).then((value) => alive && setState({ id, value }));
    return () => {
      alive = false;
    };
  }, [need, id, maDA]);

  if (!need) return { ...own, loading: false };
  const fetched = state?.id === id ? state.value : undefined;
  return {
    loaiCan: own.loaiCan ?? fetched?.loaiCan,
    toaId: own.toaId ?? fetched?.toaId,
    phongNguId: own.phongNguId ?? fetched?.phongNguId,
    viTriId: own.viTriId ?? fetched?.viTriId,
    tangId: own.tangId ?? fetched?.tangId,
    loading: !fetched,
  };
}
