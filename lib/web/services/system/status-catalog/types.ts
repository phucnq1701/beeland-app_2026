// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/status-catalog/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Loại danh mục trạng thái 2 cấp */
export type StatusType = "bds_trang_thai" | "pgc_trang_thai";

/** Dòng máy chủ trả (fn_status_catalog_list / _save / _company_color_set — dbo._status_items) */
export interface StatusItemRaw {
  id: string;
  item_code: string;
  item_name: string | null;
  group_code: string | null;
  group_name: string | null;
  /** Màu hiệu lực = màu công ty nếu đã cài, không thì màu gốc */
  color_code: string | null;
  color_goc: string | null;
  color_cty: string | null;
  ap_dung: boolean | null;
}

/**
 * Trạng thái cho màn hình. Giữ các trường cũ của StatusCatalogCloudService
 * (ID, Uid, Ten, Mau, ApDung, MaTT, TenTT, MauNen, ColorWeb) — Mau/MauNen/ColorWeb = màu hiệu lực.
 */
export interface StatusItem {
  ID: number;
  /** Mã nguyên văn (item_code) */
  Ma: string;
  /** uuid dòng danh mục cấp 1 — bds_products.ma_tt / cloud_pgc_phieu_giucho.trang_thai_id trỏ vào */
  Uid: string;
  Ten: string;
  Mau: string | null;
  ApDung: boolean;
  MaTT: number;
  TenTT: string;
  MauNen: string | null;
  ColorWeb: string | null;
  MauGoc: string | null;
  MauCty: string | null;
  NhomMa: string | null;
  NhomTen: string | null;
}

/** Tạo / sửa trạng thái cấp 1 (chỉ Beesky). Trường undefined = giữ nguyên; color/group_code null = bỏ. */
export interface StatusItemInput {
  id?: string | null;
  item_code?: string | null;
  item_name?: string | null;
  color?: string | null;
  ap_dung?: boolean | null;
  group_code?: string | null;
}

export interface StatusGroup {
  code: string;
  name: string;
  thu_tu: number | null;
}

export interface StatusOverride {
  company_id: string;
  company_code: string | null;
  company_name: string | null;
  color_code: string;
}

export interface StatusConfigItem {
  id: string;
  item_code: string;
  item_name: string;
  group_code: string | null;
  group_name: string | null;
  /** Màu gốc (cấp 1) */
  color_code: string | null;
  ap_dung: boolean;
  overrides: StatusOverride[];
}

export interface StatusCompany {
  id: string;
  code: string | null;
  name: string | null;
}

/** fn_status_config_get */
export interface StatusConfig {
  groups: StatusGroup[];
  items: StatusConfigItem[];
  companies: StatusCompany[];
}
