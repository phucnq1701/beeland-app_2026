import { errorMessage } from "@/services/nvApi";
import { SanPhamApi } from "@/services/SanPhamApi";

export const FilterService = {
  /**
   * Trạng thái sản phẩm (danh mục bds_trang_thai đang áp dụng, màu theo cấu hình công ty như lưới web) —
   * fn_nv_app_san_pham_bo_loc. Trả shape: { data: [{ MaTT, TenTT, ColorWeb, _raw: { item_code… } }] }.
   */
  getStatusSP: async (_payload: any = {}) => {
    try {
      // Trạng thái chưa đặt màu ⇒ xám trung tính (như bản cũ)
      const data = (await SanPhamApi.filters(null)).trangThai.map((t: any) => ({ ...t, ColorWeb: t.ColorWeb || "#9CA3AF" }));
      return { data };
    } catch (e) {
      console.log("ERROR getStatusSP (fn_nv_app_san_pham_bo_loc):", errorMessage(e));
      return { data: [], error: errorMessage(e) };
    }
  },
};
