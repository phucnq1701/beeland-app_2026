import axiosApiSupabase from "./axiosApiSupabase";

export const FilterService = {
  /**
   * Trạng thái sản phẩm — cloud_catalogs (catalog_type = bds_trang_thai, danh mục dùng chung ma_ctdk='global').
   * Không còn fallback API .NET cũ (trả mã số không khớp bds_products.ma_tt uuid) → lỗi/rỗng trả danh sách rỗng.
   * Trả shape: { data: [{ MaTT, TenTT, ColorWeb, _raw }] }
   */
  getStatusSP: async (_payload: any = {}) => {
    try {
      // Web: order created_at asc, KHÔNG có cột thu_tu.
      const params: Record<string, string> = {
        select: "id,item_code,item_name,color_code,is_ap_dung",
        catalog_type: "eq.bds_trang_thai",
        ma_ctdk: "eq.global",
        order: "created_at.asc",
        limit: "100",
      };

      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params,
      });

      const rows = (Array.isArray(res.data) ? res.data : []).filter(
        (r: any) => r?.is_ap_dung !== false
      );

      // Key filter = id (uuid) — bds_products.ma_tt là FK uuid tới cloud_catalogs
      const data = rows.map((r: any) => ({
        MaTT: r.id,
        TenTT: r.item_name || "",
        ColorWeb: r.color_code || "#9CA3AF",
        _raw: r,
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getStatusSP (cloud_catalogs):", error);
      return { data: [] };
    }
  },
};
