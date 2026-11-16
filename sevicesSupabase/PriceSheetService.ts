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
import { sortPriceLists } from "@/lib/bookingPrice";
import { mapProductRow } from "@/lib/priceSheetPayload";
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

/** Danh sách cấu hình bán hàng — lỗi thì rỗng (như web fetchSalesConfigOptions) */
async function nvList(fn: string, body: Record<string, any>): Promise<any[]> {
  try {
    const res = await callNv<any>(fn, body);
    return Array.isArray(res) ? res : [];
  } catch (e) {
    console.log(`[PriceSheet] ${fn} lỗi`, nvError(e, ""));
    return [];
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

  /** Tạo (row không id) / sửa phiếu – 1 RPC, máy chủ ghi phiên bản + giá gốc căn */
  async save(row: any): Promise<PriceSheetRow> {
    const { created_at, ...rest } = row || {};
    return nv("fn_nv_app_ptg_luu", { p_row: rest }, "Không thể lưu phiếu tính giá");
  },

  /** Xoá mềm (khôi phục / xoá vĩnh viễn làm trên web) */
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

  /* ----------------------------- Sản phẩm ----------------------------- */

  /** Chi tiết căn (hình dạng mapBdsProduct của web, dùng cho form + snapshot.product) */
  async getProduct(id: string): Promise<any | null> {
    const data = await nv("fn_nv_app_san_pham_tinh_gia", { p_id: String(id) }, "Không tải được sản phẩm");
    return data ? mapProductRow(data) : null;
  },

  /** Dòng bảng giá của căn (theo product_id, dữ liệu cũ dò theo mã căn) – Product.getSPByBG */
  async getPriceListItem(priceListId: string, product: any): Promise<any | null> {
    if (!uid(priceListId)) return null;
    try {
      return await nv("fn_nv_app_gia_trong_bang_gia", {
        p_bang_gia_id: priceListId,
        p_san_pham_id: uid(product?.id ?? product?.ID),
        p_ma_sp: String(product?.MaSP ?? "").trim() || null,
      }, "Không tải được giá trong bảng giá");
    } catch {
      return null;
    }
  },

  /* -------------------------- Cấu hình bán hàng -------------------------- */

  /** Bảng giá (sắp priority), chính sách, tiến độ, quà tặng, cấu hình CSBH theo dự án + loại – fetchSalesConfigOptions */
  async getSalesConfig(projectId: string, isLow: boolean) {
    const pid = uid(projectId);
    const empty = { priceLists: [] as any[], policies: [] as any[], schedules: [] as any[], promotions: [] as any[], policyConfigs: [] as any[] };
    if (!pid) return empty;
    const formCode = isLow ? "THAPTANG" : "CAOTANG";
    const [lists, policies, schedules, promotions, policyConfigs] = await Promise.all([
      nvList("fn_nv_app_bang_gia_hien_hanh", { p_du_an_id: pid, p_loai: isLow ? "Thấp tầng" : "Chung cư" }),
      nvList("fn_nv_app_chinh_sach_list", { p_du_an_id: pid, p_form_code: formCode }),
      nvList("fn_nv_app_lich_tt_list", { p_du_an_id: pid, p_form_code: formCode }),
      nvList("fn_nv_app_khuyen_mai_list", { p_du_an_id: pid }),
      PriceSheetService.listPricingConfigs(pid, isLow ? "CSTHAPTANG" : "CSCAOTANG"),
    ]);
    return {
      priceLists: sortPriceLists(lists),
      policies: policies.map((c: any) => ({
        id: String(c.id),
        name: c.ten_cs || String(c.id),
        pricingConfigId: c.pricing_config_id ?? null,
        scheduleId: c.payment_schedule_id ?? null,
      })),
      schedules: schedules.map((c: any) => ({ id: String(c.id), name: c.name || String(c.id) })),
      promotions: promotions.map((c: any) => ({
        ID: String(c.id),
        TenQuaTang: c.ten_qua_tang || c.ten_khuyen_mai || "",
        SoLuong: Number(c.so_luong ?? 1),
        GiaTri: Number(c.gia_tri ?? 0),
      })),
      policyConfigs,
    };
  },

  /** cloud_pricing_configs của dự án theo biểu mẫu (PricingConfigCloudService.list) */
  async listPricingConfigs(projectId: string, formCode: string): Promise<any[]> {
    if (!uid(projectId)) return [];
    const rows = await nvList("fn_nv_app_cau_hinh_tinh_gia_list", { p_du_an_id: projectId, p_form_codes: [formCode] });
    return rows.map((r) => ({
      ID: r.id,
      Name: r.ten ?? "",
      Status: !!r.status,
      Detail: Array.isArray(r.detail) ? r.detail : [],
    }));
  },

  /**
   * Cấu hình tính giá SẢN PHẨM (CAOTANG/THAPTANG) – useProductPriceConfig: của dự án, không có thì kèm mẫu chung
   * (mẫu chung của công ty khác bị RLS chặn như web).
   */
  async getProductPricingConfigs(projectId: string, isLow: boolean): Promise<any[]> {
    return PriceSheetService.listPricingConfigs(projectId, isLow ? "THAPTANG" : "CAOTANG");
  },

  /** Các vòng chiết khấu của cấu hình CSBH (cloud_pricing_config_rounds, sắp order_by) */
  async getConfigRounds(configId: string): Promise<any[]> {
    if (!uid(configId)) return [];
    const rows = await nvList("fn_nv_app_cau_hinh_tinh_gia_dot", { p_cau_hinh_id: configId });
    return rows.map((r) => ({
      ID: r.id,
      Name: r.ten ?? "",
      Details: Array.isArray(r.details) ? r.details : [],
    }));
  },

  /** Chi tiết chính sách – fn_get_byid_sales_policy (dòng chiết khấu + cấu hình tính giá + tiến độ liên kết) */
  async getPolicy(id: string) {
    if (!uid(id)) return null;
    const data = await nv<any>("fn_nv_app_chinh_sach_chi_tiet", { p_id: id }, "Không tải được chính sách bán hàng");
    const raw = Array.isArray(data) ? data[0] : data?.row ?? (data?.ok === false ? null : data);
    if (!raw?.id) return null;
    return {
      id: String(raw.id),
      name: raw.ten_cs || "",
      pricingConfigId: raw.pricing_config_id ?? null,
      scheduleId: raw.payment_schedule_id ?? null,
      detail: Array.isArray(raw.detail) ? raw.detail : [],
    };
  },

  /** Chi tiết tiến độ thanh toán – fn_get_byid_payment_schedule (details đã chuẩn hoá như normalizeDetails) */
  async getSchedule(id: string) {
    if (!uid(id)) return null;
    const data = await nv<any>("fn_nv_app_lich_tt_chi_tiet", { p_id: id }, "Không tải được tiến độ thanh toán");
    const row = Array.isArray(data) ? data[0] ?? null : data?.row ?? (data?.ok === false ? null : data ?? null);
    if (!row?.id) return null;
    const isLow = String(row.form_code || "").toUpperCase().includes("THAP");
    const details = (Array.isArray(row.details) ? row.details : []).map((d: any, i: number) => {
      const base: any = {
        DotTT: d?.DotTT ?? i + 1,
        TenDot: d?.TenDot ?? `Đợt ${i + 1}`,
        SoNgay: Number(d?.SoNgay ?? 0),
        MaLoai: d?.MaLoai ?? 1,
        TyLeTT: Number(d?.TyLeTT ?? 0),
        TyLeVAT: Number(d?.TyLeVAT ?? 0),
        TuongUng: d?.TuongUng ?? "",
        TienVAT: d?.TienVAT ?? "",
        TongCong: d?.TongCong ?? "",
      };
      if (isLow) {
        base.TyLeXD = Number(d?.TyLeXD ?? 0);
        base.TienXayDung = d?.TienXayDung ?? "";
        base.VATDat = d?.VATDat ?? "";
        base.VATXayDung = d?.VATXayDung ?? "";
      } else {
        base.TyLePBT = Number(d?.TyLePBT ?? 0);
        base.PhiBaoTri = d?.PhiBaoTri ?? "";
      }
      return base;
    });
    return { id: String(row.id), name: row.name || "", details };
  },
};
