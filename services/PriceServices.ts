import { errorMessage } from "@/services/nvApi";
import { DuAnApi, SanPhamApi } from "@/services/SanPhamApi";

import { loadProductDetail } from "./ProductService";

/**
 * 1 dòng bảng giá (bảng price_list_items) — các cột phục vụ hiển thị giá
 * ở màn chi tiết sản phẩm. RPC get_active_price_for_product trả
 * SETOF price_list_items nhưng thực chất tối đa 1 dòng (đã LIMIT 1 trong SQL).
 */
export interface ActivePriceListItem {
  id?: string;
  price_list_id?: string;
  product_code?: string | null;
  product_name?: string | null;
  product_type?: string | null;
  area?: number | null;
  unit_price?: number | null;
  vat_rate?: number | null;
  maintenance_rate?: number | null;
  status?: string | null;
  created_at?: string | null;
  bedroom_count?: string | null;
  direction?: string | null;
  ma_ctdk?: string | null;
  zone?: string | null;
  sub_zone?: string | null;
  floor?: string | null;
  position?: string | null;
  unit_no?: string | null;
  house_model?: string | null;
  balcony_direction?: string | null;
  area_tim_tuong?: number | null;
  area_xd?: number | null;
  land_alloc_price?: number | null;
  land_use_total?: number | null;
  total_before_vat?: number | null;
  vat_amount?: number | null;
  maintenance_amount?: number | null;
  unit_price_vat?: number | null;
  total_after_vat?: number | null;
  total_payment?: number | null;
  construction_unit_price?: number | null;
  construction_amount?: number | null;
  raw?: Record<string, any> | null;
  ma_ctdk_uid?: string | null;
  product_id?: string | null;
  land_unit_price?: number | null;
  land_before_vat?: number | null;
  land_vat_amount?: number | null;
  land_total?: number | null;
  land_use_amount?: number | null;
  construction_vat_rate?: number | null;
  construction_vat_amount?: number | null;
  construction_total_after_vat?: number | null;
  contract_total_value?: number | null;
  floor_count?: number | null;
  stt?: number | null;
  note?: string | null;
  extra?: Record<string, any> | null;
}

/**
 * Web tính các cột tổng ngay trên FE khi DB chưa lưu (null):
 *   Tổng giá chưa VAT  = DT thông thủy × Đơn giá chưa VAT
 *   Tiền VAT           = Tổng giá chưa VAT × vat_rate/100
 *   Tổng giá gồm VAT   = Tổng giá chưa VAT + Tiền VAT
 *   Phí bảo trì        = Tổng giá gồm VAT × maintenance_rate/100
 *   Tổng giá gồm PBT   = Tổng giá gồm VAT + Phí bảo trì
 * Chỉ fill khi cột DB đang null; giá trị DB đã có được giữ nguyên.
 */
export function computeActivePriceTotals(
  item: ActivePriceListItem | null
): ActivePriceListItem | null {
  if (!item) return null;

  const fin = (v: any): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const area = fin(item.area) ?? 0;
  const unitPrice = fin(item.unit_price) ?? 0;
  const vatRate = fin(item.vat_rate) ?? 0;
  const maintenanceRate = fin(item.maintenance_rate) ?? 0;

  const totalBefore =
    fin(item.total_before_vat) ??
    (area > 0 && unitPrice > 0 ? area * unitPrice : null);
  const vatAmount =
    fin(item.vat_amount) ??
    (totalBefore != null ? totalBefore * (vatRate / 100) : null);
  const totalAfter =
    fin(item.total_after_vat) ??
    (totalBefore != null ? totalBefore + (vatAmount ?? 0) : null);
  const maintenanceAmount =
    fin(item.maintenance_amount) ??
    (totalAfter != null ? totalAfter * (maintenanceRate / 100) : null);
  const totalPayment =
    fin(item.total_payment) ??
    (totalAfter != null ? totalAfter + (maintenanceAmount ?? 0) : null);

  return {
    ...item,
    total_before_vat: totalBefore,
    vat_amount: vatAmount,
    total_after_vat: totalAfter,
    maintenance_amount: maintenanceAmount,
    total_payment: totalPayment,
  };
}

/**
 * Sơ đồ căn + giá đang áp dụng — bộ API riêng app nhân viên (fn_nv_app_so_do / fn_nv_app_san_pham_chi_tiet).
 * Phạm vi do máy chủ áp (đại lý ⇒ căn trong giỏ hợp lệ; nội bộ ⇒ dự án được gán) — app không tự lọc nữa.
 */
export const PriceServices = {
  /** Lưới khu → tầng → căn của dự án. payload: { maDA } (mã dự án | uuid). Shape cũ: { data: [{ maKhu, tenKhu, location, floor }] } */
  getBlock: async (payload: any = {}) => {
    try {
      const projectId = await DuAnApi.resolveId(payload?.maDA ?? payload?.MaDA);
      if (!projectId) return { data: [] };
      return { data: await SanPhamApi.grid(projectId) };
    } catch (e) {
      console.log("ERROR getBlock (fn_nv_app_so_do):", errorMessage(e));
      return { data: [], error: errorMessage(e) };
    }
  },

  /**
   * Dòng bảng giá đang áp dụng của căn (lõi chung get_active_price_for_product: ưu tiên nhỏ nhất, hiệu lực hôm nay theo giờ VN),
   * cột tổng còn trống thì tính như web (computeActivePriceTotals). payload: { productId (uuid) | maSP }.
   */
  getActivePriceForProduct: async (
    payload: { productId?: any; maSP?: any; MaSP?: any } = {}
  ): Promise<{ data: ActivePriceListItem | null }> => {
    const key = String(payload?.productId ?? payload?.maSP ?? payload?.MaSP ?? "").trim();
    if (!key) return { data: null };
    try {
      const d = await loadProductDetail(key);
      return { data: computeActivePriceTotals((d?.activePrice ?? null) as ActivePriceListItem | null) };
    } catch (e) {
      console.log("ERROR getActivePriceForProduct (fn_nv_app_san_pham_chi_tiet):", errorMessage(e));
      return { data: null };
    }
  },
};
