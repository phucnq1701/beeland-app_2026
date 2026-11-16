// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CatalogSettingsService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * CatalogSettingsService — danh mục tự cấu hình (Cài đặt danh mục).
 *
 * Lưu trên Cloud trong bảng dùng chung `public.cloud_catalogs`
 * theo (ma_ctdk, catalog_type, item_code) → mỗi công ty đăng ký có danh mục riêng.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { bookingMaCTDK } from "./PreBookingCloudService";

export interface CatalogItem {
  code: string;
  name: string;
  note?: string;
  order: number;
  active: boolean;
}

export interface CatalogDef {
  /** catalog_type lưu trong cloud_catalogs */
  type: string;
  label: string;
  description?: string;
}

/** Danh sách các danh mục nhỏ trong "Cài đặt danh mục" */
export const CATALOG_DEFS: CatalogDef[] = [
  {
    type: "phuong_an_tt_ky",
    label: "Phương án thanh toán (đặt lịch ký)",
    description:
      "Danh mục phương án thanh toán dùng khi tạo phiếu đặt lịch ký hợp đồng.",
  },
];

const maCTDK = () => bookingMaCTDK() || "";

export const genCatalogCode = (name: string, existing: string[]) => {
  const base =
    (name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 24) || "MUC";
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
};

export const CatalogSettingsService = {
  list: async (type: string): Promise<CatalogItem[]> => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk) return [];
    const { data, error } = await supabase
      .from("cloud_catalogs" as any)
      .select("*")
      .eq("ma_ctdk", ma_ctdk)
      .eq("catalog_type", type);
    if (error) throw error;
    return ((data as any[]) || [])
      .map((r) => ({
        code: String(r.item_code),
        name: r.item_name || String(r.item_code),
        note: r.raw?.note || "",
        order: Number(r.raw?.order) || 0,
        active: r.ap_dung !== false,
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  },

  save: async (type: string, items: CatalogItem[]) => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk) throw new Error("Thiếu mã công ty đăng ký");
    if (items.length) {
      const payload = items.map((i) => ({
        ma_ctdk,
        catalog_type: type,
        item_code: i.code,
        item_name: i.name,
        parent_code: null,
        ap_dung: i.active,
        raw: { order: i.order, note: i.note || "" },
      }));
      const { error } = await supabase
        .from("cloud_catalogs" as any)
        .upsert(payload as any, {
          onConflict: "ma_ctdk,catalog_type,item_code",
        });
      if (error) throw error;
    }
    let del = supabase
      .from("cloud_catalogs" as any)
      .delete()
      .eq("ma_ctdk", ma_ctdk)
      .eq("catalog_type", type);
    const codes = items.map((i) => i.code);
    if (codes.length) del = del.not("item_code", "in", `(${codes.join(",")})`);
    const { error: delErr } = await del;
    if (delErr) throw delErr;
  },

  /** Danh mục đang hoạt động — dùng cho các form chọn */
  listActive: async (type: string): Promise<CatalogItem[]> => {
    const rows = await CatalogSettingsService.list(type).catch(() => []);
    return rows.filter((r) => r.active);
  },
};
