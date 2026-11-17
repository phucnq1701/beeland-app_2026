// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/products/price-list/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import { cleanCompanyIds } from "../../../_extract/services/system/permitted-company";

/**
 * BẢNG GIÁ — bảng public.price_lists / price_list_items, chỉ đọc/ghi qua hàm máy chủ
 * (migration 20261014120000_price_list_rpc). Công ty + nhân viên máy chủ lấy từ JWT; phạm vi = dự án được gán;
 * trạng thái bảng giá tính ở máy chủ theo ngày hôm nay; ghi chặn quyền form /products/price-list.
 * Luồng bán hàng (Booking, đổi căn, cấu hình bán hàng) đọc giá qua fn_get_* riêng — không qua service này.
 */

export interface CloudPriceList {
  id: string;
  /** uuid dự án (da_projects.id) */
  da_project_id: string | null;
  ten_da?: string | null;
  sales_policy_id?: string | null;
  ten_chinh_sach?: string | null;
  /** uuid quỹ căn (bảng dùng chung dm_quy_can, không theo dự án) */
  ma_quy_can?: string | null;
  ten_quy_can?: string | null;
  name: string;
  description: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
  /** applying | pending | expired | inactive — máy chủ tính */
  status: string;
  property_type: string;
  so_sp?: number;
  /** Màn Bảng giá (BG-CAN): bảng giá công ty khác hiện vì có căn của mình ⇒ chỉ xem, so_sp = số căn của mình */
  chi_xem?: boolean;
  [k: string]: any;
}

export interface CloudPriceListItem {
  id: string;
  /** uuid sản phẩm (bds_products.id) */
  product_id?: string | null;
  price_list_id: string;
  product_code: string;
  product_name: string | null;
  product_type: string | null;
  area: number | null;
  unit_price: number;
  vat_rate: number;
  maintenance_rate: number;
  status: string;
  bedroom_count?: string | null;
  direction?: string | null;
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
  naked_price?: number | null;
  tong_gia_vat_chua_tt?: number | null;
  gia_hdmb_chua_tt_lan_1?: number | null;
  gia_hdmb_chua_tt_lan_2?: number | null;
  gia_hdmb_chua_tt_lan_3?: number | null;
  gia_hdmb_chua_tt_lan_4?: number | null;
  gia_hdmb_chua_tt_lan_5?: number | null;
  gia_hdmb_chua_tt_lan_6?: number | null;
  construction_unit_price?: number | null;
  construction_amount?: number | null;
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
  /** Các cột trong file Excel chưa có trường hệ thống — giữ nguyên tên cột gốc */
  extra?: Record<string, any> | null;
}

const isUuid = (v: any) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v ?? "").trim());
const uuidOrNull = (v: any) => (isUuid(v) ? String(v).trim() : null);
const allOrNull = (v?: string | null) => (v && v !== "all" ? v : null);

/** Lỗi PostgREST → Error mang thông điệp nghiệp vụ của máy chủ (thiếu quyền, ngoài phạm vi…) */
const call = <T = any>(fn: string, args: Record<string, any>, fallback: string): Promise<T> =>
  rpcRaw<T>(fn, args, { fallback });

/** Danh sách bảng giá (hàm đọc dùng chung). Lọc ngày = bảng giá có hiệu lực giao với khoảng [from, to]. */
export const listPriceLists = async (filter: {
  maDA?: string | null;
  status?: string;
  propertyType?: string;
  from?: string | null;
  to?: string | null;
  /** Chỉ màn quản lý Bảng giá đặt true ⇒ gửi p_form + p_company_ids (phạm vi dữ liệu); ô chọn ở màn khác để trống = y như cũ */
  scopeForm?: boolean;
  /** Ô lọc Công ty (uuid) — chỉ có tác dụng khi scopeForm */
  companyIds?: string[] | null;
  /** Ô lọc Quỹ căn (uuid); trống / "all" = không lọc, không gửi khóa */
  quyCanId?: string | null;
}): Promise<CloudPriceList[]> => {
  const rows = await call(
    "fn_price_list_list",
    {
      p_project_id: uuidOrNull(filter.maDA),
      p_property_type: allOrNull(filter.propertyType),
      p_status: allOrNull(filter.status),
      p_from: filter.from || null,
      p_to: filter.to || null,
      ...(filter.scopeForm
        ? { p_form: "/products/price-list", p_company_ids: cleanCompanyIds(filter.companyIds) }
        : {}),
      ...(isUuid(filter.quyCanId) ? { p_quy_can_id: String(filter.quyCanId).trim() } : {}),
    },
    "Không tải được danh sách bảng giá"
  );
  // MASTER: company_id / ten_cong_ty của bảng giá ⇒ CompanyId / TenCongTy (giữ khoá snake cũ)
  return (Array.isArray(rows) ? rows : []).map((r: any) => ({
    ...r,
    CompanyId: r?.company_id ?? null,
    TenCongTy: r?.ten_cong_ty ?? "",
  }));
};

/** Dòng giá của 1 bảng giá */
export const listPriceListItems = async (priceListId: string): Promise<CloudPriceListItem[]> => {
  if (!isUuid(priceListId)) return [];
  const rows = await call("fn_price_list_item_list", { p_price_list_id: priceListId }, "Không tải được bảng giá");
  return Array.isArray(rows) ? rows : [];
};

/**
 * Độ ưu tiên tối thiểu khi ngày bắt đầu rơi vào khoảng hiệu lực của N bảng giá cũ (cùng dự án + loại hình): N + 1.
 * Máy chủ cũng tự nâng khi lưu — hàm này chỉ để form gợi ý trước.
 */
export const getMinPriceListPriority = async (params: {
  da_project_id?: string | null;
  property_type?: string | null;
  valid_from: string;
  excludeId?: string;
}): Promise<number> => {
  if (!params.valid_from) return 1;
  const n = await call(
    "fn_price_list_min_priority",
    {
      p_project_id: uuidOrNull(params.da_project_id),
      p_property_type: params.property_type || null,
      p_valid_from: params.valid_from,
      p_exclude_id: uuidOrNull(params.excludeId),
    },
    "Không kiểm tra được độ ưu tiên"
  );
  return Number(n) || 1;
};

/** Lưu (tạo/cập nhật) bảng giá; trả dòng đã lưu (cùng dạng danh sách) + cờ độ ưu tiên đã bị nâng */
export const savePriceList = async (
  payload: {
    name: string;
    description?: string | null;
    da_project_id?: string | null;
    sales_policy_id?: string | null;
    property_type: string;
    valid_from: string;
    valid_to?: string | null;
    is_active: boolean;
    priority: number;
    /** uuid quỹ căn; "" / null = xoá; không truyền = máy chủ giữ giá trị cũ */
    ma_quy_can?: string | null;
  },
  id?: string
): Promise<CloudPriceList & { priority_raised?: boolean; priority_min?: number }> =>
  call(
    "fn_price_list_save",
    {
      p_row: {
        id: uuidOrNull(id),
        name: payload.name,
        description: payload.description || null,
        da_project_id: uuidOrNull(payload.da_project_id),
        sales_policy_id: uuidOrNull(payload.sales_policy_id),
        property_type: payload.property_type,
        valid_from: payload.valid_from,
        valid_to: payload.valid_to || null,
        is_active: payload.is_active,
        priority: payload.priority,
        ...(payload.ma_quy_can !== undefined ? { ma_quy_can: uuidOrNull(payload.ma_quy_can) } : {}),
      },
    },
    "Không thể lưu bảng giá"
  );

export interface PriceListUnitFund {
  id: string;
  ma: string | null;
  name: string;
}

/**
 * Quỹ căn đang áp dụng — ô chọn ở modal + bộ lọc màn Bảng giá.
 * Danh mục dùng chung (bảng dm_quy_can: Quỹ CĐT, Chuyển nhượng), không theo dự án.
 * Máy chủ chưa có hàm (bản cũ) / lỗi ⇒ mảng rỗng để màn vẫn dùng được.
 */
export const listPriceListUnitFunds = async (): Promise<PriceListUnitFund[]> => {
  try {
    const rows = await call<Partial<PriceListUnitFund>[]>("fn_price_list_quy_can_options", {}, "Không tải được danh sách quỹ căn");
    return (Array.isArray(rows) ? rows : [])
      .filter((r) => isUuid(r?.id))
      .map((r) => ({
        id: String(r.id),
        ma: r.ma ?? null,
        name: String(r.name ?? ""),
      }));
  } catch {
    return [];
  }
};

/** Xoá bảng giá; bảng giá đang được phiếu giữ chỗ / hợp đồng dùng bị máy chủ chặn */
export const deletePriceList = async (id: string) => {
  await call("fn_price_list_delete", { p_id: id }, "Không thể xoá bảng giá");
};

/** Xoá nhiều dòng giá của 1 bảng giá */
export const deletePriceListItems = async (priceListId: string, ids: string[]): Promise<number> => {
  if (!ids?.length) return 0;
  const res = await call(
    "fn_price_list_item_delete",
    { p_price_list_id: priceListId, p_ids: ids },
    "Không thể xoá sản phẩm khỏi bảng giá"
  );
  return Number(res?.deleted ?? 0);
};

/** Thêm căn từ kho: máy chủ lấy diện tích / đơn giá từ căn, bỏ căn đã có; trả các dòng vừa thêm */
export const addPriceListItems = async (
  priceListId: string,
  productIds: string[]
): Promise<{ added: number; skipped: number; rows: CloudPriceListItem[] }> => {
  if (!productIds.length) return { added: 0, skipped: 0, rows: [] };
  const res = await call(
    "fn_price_list_item_add",
    { p_price_list_id: priceListId, p_product_ids: productIds },
    "Không thể thêm sản phẩm"
  );
  return {
    added: Number(res?.added ?? 0),
    skipped: Number(res?.skipped ?? 0),
    rows: Array.isArray(res?.rows) ? res.rows : [],
  };
};

/** Báo cáo biến động giá: 10 bảng giá mới nhất của loại hình (+ dự án) và dòng giá của chúng — 1 lời gọi */
export const getPriceListReport = async (
  propertyType: string,
  maDA?: string | null,
  status?: string | null
): Promise<{ lists: { id: string; name: string; valid_from: string }[]; items: CloudPriceListItem[] }> => {
  const res = await call(
    "fn_price_list_report",
    { p_property_type: propertyType, p_project_id: uuidOrNull(maDA), p_status: allOrNull(status) },
    "Không tải được báo cáo biến động giá"
  );
  return {
    lists: Array.isArray(res?.lists) ? res.lists : [],
    items: Array.isArray(res?.items) ? res.items : [],
  };
};

/** Lịch sử thay đổi giá của 1 căn (uuid sản phẩm; dữ liệu cũ theo mã căn) — tab giá ở chi tiết căn */
export const listPriceHistoryByProduct = async (productKey: string, _maDA?: any): Promise<any[]> => {
  const key = String(productKey || "").trim();
  if (!key) return [];
  const rows: any[] =
    (await call(
      "fn_price_list_history",
      { p_product_id: uuidOrNull(key), p_product_code: isUuid(key) ? null : key },
      "Không tải được lịch sử giá"
    )) || [];

  const history = rows
    .map((r) => {
      const unit = Number(r.unit_price) || 0;
      return {
        ID: r.id,
        NgayApDung: r.valid_from || r.created_at,
        TenBangGia: r.name || "-",
        MaBG: r.price_list_id,
        DonGia: unit,
        ThanhTien: (Number(r.area) || 0) * unit,
        NguoiCapNhat: "-",
        GhiChu:
          r.description ||
          [r.property_type, r.status === "applying" ? "Đang áp dụng" : r.status].filter(Boolean).join(" · "),
      };
    })
    .sort((a, b) => new Date(a.NgayApDung || 0).getTime() - new Date(b.NgayApDung || 0).getTime());

  let prev: number | null = null;
  for (const h of history) {
    (h as any).ChenhLech = prev == null ? null : h.DonGia - prev;
    prev = h.DonGia;
  }
  return history.reverse();
};

/** Import dòng giá theo mapping Excel (1 lời gọi). mode 0: chỉ thêm mới; 1: cập nhật mã đã có (bỏ ô trống) + thêm mới. */
export const importPriceListItems = async (
  priceListId: string,
  rows: Array<Partial<CloudPriceListItem> & { product_code: string }>,
  mode: number
): Promise<{ status: number; message?: string; data: any[] }> => {
  if (!priceListId) return { status: 5000, message: "Chưa chọn bảng giá", data: [] };
  try {
    const res = await call(
      "fn_price_list_item_import",
      { p_price_list_id: priceListId, p_rows: rows, p_mode: Number(mode) || 0 },
      "Import thất bại"
    );
    const notes = Array.isArray(res?.notes) ? res.notes : [];
    return {
      status: 2000,
      message: `Import thành công: thêm ${Number(res?.inserted ?? 0)}, cập nhật ${Number(res?.updated ?? 0)}${
        notes.length ? `, ${notes.length} dòng bỏ qua` : ""
      }`,
      data: notes,
    };
  } catch (e: any) {
    return { status: 5000, message: e?.message || "Import thất bại", data: [] };
  }
};
