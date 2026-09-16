import axiosApiSupabase from "./axiosApiSupabase";
import axiosApi from "./axiosApi";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const FilterService = {
  /**
   * Trạng thái sản phẩm — cloud (cloud_catalogs, catalog_type = product_status).
   * Fallback legacy nếu cloud không có dữ liệu.
   * Trả shape: { data: [{ MaTT, TenTT, ColorWeb, ... }] }
   */
  getStatusSP: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      // Fallback legacy API
      return await axiosApi
        .post("api/admin/san-pham/trang-thai", payload)
        .then((res) => res.data);
    }

    try {
      const companyId = await getCompanyId();

      // Web AI: catalog_type=bds_trang_thai, danh mục DÙNG CHUNG với ma_ctdk='global',
      // order created_at asc, KHÔNG có cột thu_tu.
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

      if (rows.length === 0) {
        // Cloud chưa có data → fallback legacy
        console.log(
          "[Filter] cloud_catalogs chưa có product_status, fallback legacy"
        );
        return await axiosApi
          .post("api/admin/san-pham/trang-thai", payload)
          .then((res) => res.data);
      }

      // Key filter = id (uuid) — bds_products.ma_tt là FK uuid tới cloud_catalogs
      const data = rows.map((r: any) => ({
        MaTT: r.id,
        TenTT: r.item_name || "",
        ColorWeb: r.color_code || "#9CA3AF",
        _raw: r,
      }));

      return { data };
    } catch (error) {
      console.log(
        "ERROR getStatusSP (cloud_catalogs), fallback legacy:",
        error
      );
      return await axiosApi
        .post("api/admin/san-pham/trang-thai", payload)
        .then((res) => res.data);
    }
  },

  /**
   * Trạng thái giao dịch — giữ legacy API (phức tạp, chưa migrate).
   */
  getStatusTransaction: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
      Type: 1,
    };
    return await axiosApi
      .post("api/admin/hop-dong/trang-thai", dataInit)
      .then((res) => res.data);
  },
};