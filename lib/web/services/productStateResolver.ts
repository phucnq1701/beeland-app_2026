// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/productStateResolver.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import {
  ProductStatusConfigService,
  ProductStatusConfig,
  DEFAULT_PRODUCT_STATUSES,
} from "./ProductStatusConfigService";

/**
 * Resolver trạng thái sản phẩm theo "Cấu hình cập nhật trạng thái sản phẩm"
 * (Bán hàng → Cài đặt). Các service không hard-code tên trạng thái nữa mà hỏi:
 * "hành động X thì sản phẩm chuyển sang trạng thái nào?".
 */

let cache: ProductStatusConfig[] | null = null;
let inflight: Promise<ProductStatusConfig[]> | null = null;
/** Cache phải gắn với công ty đăng ký đang đăng nhập (multi-tenant) */
let cacheTenant: string | null = null;

export const invalidateProductStateResolver = () => {
  cache = null;
  inflight = null;
  cacheTenant = null;
};

const load = (): Promise<ProductStatusConfig[]> => {
  const tenant = ProductStatusConfigService.maCTDK();
  if (cacheTenant !== tenant) {
    cache = null;
    inflight = null;
    cacheTenant = tenant;
  }
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = ProductStatusConfigService.list()
      .then((rows) => {
        cache = rows?.length ? rows : DEFAULT_PRODUCT_STATUSES;
        return cache;
      })
      .catch(() => {
        inflight = null;
        return DEFAULT_PRODUCT_STATUSES;
      });
  }
  return inflight;
};

/** Cấu hình trạng thái sản phẩm ứng với một hành động (nếu có). */
export const productStatusConfigFor = async (
  action: string
): Promise<ProductStatusConfig | undefined> => {
  try {
    return ProductStatusConfigService.statusForAction(await load(), action);
  } catch {
    return ProductStatusConfigService.statusForAction(
      DEFAULT_PRODUCT_STATUSES,
      action
    );
  }
};

/**
 * TÊN trạng thái sản phẩm áp dụng cho `action`; nếu chưa cấu hình thì dùng
 * `fallback` (tên trạng thái mặc định của luồng hiện tại).
 */
export const productStatusFor = async (
  action: string,
  fallback: string
): Promise<string> => {
  const found = await productStatusConfigFor(action);
  return found?.name || fallback;
};

/** Trạng thái sản phẩm có cho phép phát sinh giao dịch mới hay không. */
export const productStatusAllowsTransaction = async (
  statusName: string
): Promise<boolean> => {
  const norm = (v: any) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim();
  try {
    const items = await load();
    const found = items.find(
      (s) => norm(s.name) === norm(statusName) || norm(s.code) === norm(statusName)
    );
    return found ? found.allowTransaction !== false : true;
  } catch {
    return true;
  }
};

export default productStatusFor;
