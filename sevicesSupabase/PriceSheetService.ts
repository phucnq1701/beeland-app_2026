/**
 * Phiếu tính giá – gọi máy chủ như web:
 *  - đọc/ghi phiếu: beeland/src/services/products/price-sheet/index.ts (RPC fn_price_sheet_*, migration
 *    20261014130000_price_sheet_rpc – công ty/nhân viên lấy từ JWT, phạm vi dự án ở máy chủ)
 *  - cấu hình bán hàng: components/Sales/salesConfig/useSalesConfigOptions.ts (fn_get_current_price_lists,
 *    fn_get_sales_policies, fn_get_payment_schedules, fn_get_promotions) + PricingConfigCloudService
 *    (cloud_pricing_configs / cloud_pricing_config_rounds)
 *  - chi tiết: DaSalesPolicyService.getPolicyById (fn_get_byid_sales_policy), DaPaymentScheduleService.getScheduleById
 *    (fn_get_byid_payment_schedule), BdsProductService.getBdsProductById (fn_get_product_by_id),
 *    Product.getSPByBG (price_list_items)
 * Lỗi máy chủ (RAISE EXCEPTION: thiếu quyền, ngoài phạm vi…) → Error mang thông điệp của máy chủ.
 * 2026-11-16: gọi bộ API riêng app (fn_nv_app_ptg_* / cấu hình bán hàng — bọc đúng các hàm web trên, công ty lấy từ phiên).
 * Duyệt / từ chối phiếu làm trên web.
 */
import { callNv, errorMessage as nvError } from "@/services/nvApi";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = (v: any): string | null => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : null;
};

/** Gọi API riêng app (fn_nv_app_*) — lỗi máy chủ ⇒ Error mang thông điệp nghiệp vụ (thiếu quyền, ngoài phạm vi, đang duyệt…). */
async function nv<T = any>(fn: string, body: Record<string, any>, fallback: string): Promise<T> {
  try {
    return await callNv<T>(fn, body);
  } catch (e) {
    throw new Error(nvError(e, fallback));
  }
}

export type PriceSheetFeature = "ADD" | "EDIT" | "DELETE" | "APPROVE";
const PRICE_SHEET_FORM = "/products/price-sheet";

export type PriceSheetStatus = "draft" | "sent" | "approved" | "rejected";

export interface PriceSheetRow {
  id: string;
  sheet_code: string;
  so_phieu?: string | null;
  product_code: string;
  product_name: string | null;
  product_type: string | null;
  area: number | null;
  base_price: number;
  status: PriceSheetStatus | string;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  pgc_id?: string | null;
  da_project_id?: string | null;
  san_pham_id?: string | null;
  deleted_at?: string | null;
  project_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_by?: string | null;
  ten_chinh_sach?: string | null;
  ten_lich_tt?: string | null;
  gia_tri_hd?: number | null;
  gia_tri_hd_sau_ck?: number | null;
  tien_coc?: number | null;
  payload?: any;
  snapshot?: any;
  [k: string]: any;
}

export interface PriceSheetVersion {
  id: string;
  version: number;
  sheet_code: string | null;
  summary: any;
  changed_by: string | null;
  note: string | null;
  created_at: string;
  snapshot?: any;
}

export interface PriceSheetListParams {
  /** uuid dự án */
  projectId?: string | null;
  keyword?: string;
  status?: string | null;
  /** "Cao tầng" | "Thấp tầng" */
  productType?: string | null;
  page?: number;
  pageSize?: number;
}

export const PriceSheetService = {
  async list(p: PriceSheetListParams = {}) {
    const res: any =
      (await nv(
        "fn_nv_app_ptg_list",
        {
          p: {
            project_id: uid(p.projectId),
            keyword: String(p.keyword || "").trim() || null,
            status: p.status && p.status !== "all" ? p.status : null,
            product_type: p.productType && p.productType !== "all" ? p.productType : null,
            deleted: false,
            page_index: p.page && p.page > 0 ? p.page : 1,
            page_size: p.pageSize && p.pageSize > 0 ? p.pageSize : 20,
          },
        },
        "Không thể tải danh sách phiếu tính giá"
      )) || {};
    return {
      rows: (Array.isArray(res.rows) ? res.rows : []) as PriceSheetRow[],
      total: Number(res.total ?? 0),
      stats: { draft: 0, sent: 0, approved: 0, rejected: 0, ...(res.stats || {}) },
    };
  },

  /** Bản đầy đủ (payload / snapshot) */
  async get(id: string): Promise<PriceSheetRow | null> {
    if (!uid(id)) return null;
    return (await nv("fn_nv_app_ptg_chi_tiet", { p_id: id }, "Không tải được phiếu tính giá")) || null;
  },

  /** Xoá phiếu (quyền DELETE). Lập / sửa: form web chép (lib/web, components/priceSheet/useWebPriceSheet) */
  async remove(ids: string[]) {
    await nv("fn_nv_app_ptg_xoa", { p_ids: ids }, "Không thể xóa phiếu tính giá");
  },

  async versions(sheetId: string): Promise<PriceSheetVersion[]> {
    if (!uid(sheetId)) return [];
    const rows = await nv<any[]>("fn_nv_app_ptg_phien_ban", { p_sheet_id: sheetId }, "Không tải được lịch sử phiên bản");
    return Array.isArray(rows) ? rows : [];
  },

  /**
   * Quyền chức năng ở form Phiếu tính giá (/products/price-sheet) theo nhóm quyền — fn_nv_app_quyen (1 lần cho mọi chức năng,
   * lõi app_has_perm như web usePerm). Lỗi / chưa tải ⇒ không có quyền (fail-closed như web; máy chủ vẫn chặn khi thao tác).
   */
  async perms(): Promise<Record<PriceSheetFeature, boolean>> {
    try {
      const r = await callNv<Record<string, boolean>>("fn_nv_app_quyen", {
        p_form: PRICE_SHEET_FORM, p_chuc_nang: ["ADD", "EDIT", "DELETE", "APPROVE"],
      });
      return { ADD: r?.ADD === true, EDIT: r?.EDIT === true, DELETE: r?.DELETE === true, APPROVE: r?.APPROVE === true };
    } catch {
      return { ADD: false, EDIT: false, DELETE: false, APPROVE: false };
    }
  },

  async hasPerm(feature: PriceSheetFeature): Promise<boolean> {
    return (await PriceSheetService.perms())[feature];
  },
};
