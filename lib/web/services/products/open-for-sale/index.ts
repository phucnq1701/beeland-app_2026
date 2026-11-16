// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/products/open-for-sale/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Sản phẩm đang mở bán dùng cho nghiệp vụ đổi sản phẩm (đặt cọc / booking).
 * Đọc trực tiếp từ hàm trên máy chủ, lọc theo công ty đăng ký lấy từ phiên.
 */
import { supabase } from "../../../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../../../_shims/lib/session";

export interface OpenForSaleProduct {
  id: string;
  ma_da?: string | null;
  ten_du_an?: string | null;
  ky_hieu?: string | null;
  trang_thai?: string | null;
  trang_thai_mau?: string | null;
  khu?: string | null;
  phan_khu?: string | null;
  tang?: string | null;
  dien_tich_thong_thuy?: number | string | null;
  dt_tim_tuong?: number | string | null;
  dien_tich_xd?: number | string | null;
  dien_tich_dat?: number | string | null;
  tong_gom_pbt?: number | string | null;
  tong_gia_tri_hdmb?: number | string | null;
  total_count?: number | string | null;
  form_code?: string | null;
  [k: string]: any;
}

export interface OpenForSaleResult {
  rows: OpenForSaleProduct[];
  total: number;
}

export const listOpenForSaleProducts = async (params: {
  keyword?: string;
  pageIndex?: number;
  pageSize?: number;
  /** uuid dự án (da_projects.id) — chỉ lấy sản phẩm của dự án này */
  projectId?: string | null;
}): Promise<OpenForSaleResult> => {
  const tenant = sessionCompanyId() || "";
  if (!tenant) return { rows: [], total: 0 };
  const { data, error } = await (supabase as any).rpc(
    "fn_get_products_open_for_sale",
    {
      p_ma_ctdk: tenant,
      p_input_search: params.keyword ?? "",
      p_page_index: params.pageIndex ?? 1,
      p_page_size: params.pageSize ?? 20,
      p_ma_da: params.projectId || null,
    }
  );
  if (error) {
    console.error("fn_get_products_open_for_sale failed", error);
    return { rows: [], total: 0 };
  }
  const rows: OpenForSaleProduct[] = Array.isArray(data) ? data : [];
  return { rows, total: Number(rows[0]?.total_count ?? rows.length) || 0 };
};

/** Chi tiết 1 sản phẩm (dùng khi dự án chưa có bảng giá) */
export const getProductDetailById = async (
  id: string
): Promise<any | null> => {
  const tenant = sessionCompanyId() || "";
  if (!tenant || !id) return null;
  const { data, error } = await (supabase as any).rpc("fn_get_product_by_id", {
    p_id: id,
    p_ma_ctdk: tenant,
  });
  if (error) {
    console.error("fn_get_product_by_id failed", error);
    return null;
  }
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
};

export default listOpenForSaleProducts;
