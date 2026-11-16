import { pageIndexFromOffset } from "../lib/projectScope";
import { errorMessage } from "@/services/nvApi";
import { DuAnApi, SanPhamApi } from "@/services/SanPhamApi";

import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Detail = NonNullable<Awaited<ReturnType<typeof SanPhamApi.detail>>>;

/**
 * Chi tiết căn — 1 lời gọi fn_nv_app_san_pham_chi_tiet cho cả căn + ảnh + giá + khoá + quyền. Màn chi tiết gọi
 * getDetailProducts / getBannerProduct / giá song song ⇒ dùng chung 1 request (đệm 1,5 giây theo khoá; tải lại sau đó là request mới).
 */
const detailCache = new Map<string, { at: number; p: Promise<Detail | null> }>();
const DETAIL_TTL_MS = 1500;

export function loadProductDetail(key: string, fresh = false): Promise<Detail | null> {
  const k = String(key ?? "").trim();
  if (!k) return Promise.resolve(null);
  const hit = detailCache.get(k);
  if (!fresh && hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.p;
  const p = SanPhamApi.detail(k);
  detailCache.set(k, { at: Date.now(), p });
  p.catch(() => detailCache.delete(k));
  return p;
}

export const ProductService = {
  /**
   * Danh sách căn (fn_nv_app_san_pham_list — phạm vi máy chủ như web fn_bds_product_list).
   * payload cũ: { MaDA (mã dự án | uuid | -1 = tất cả), MaKhu, MaTT, FormCode, InputSearch|KyHieu, Limit, offSet }.
   */
  getProducts: async (payload: any = {}) => {
    try {
      const rawDA = payload?.MaDA ?? payload?.maDA;
      let projectId: string | null = null;
      if (rawDA != null && rawDA !== "" && rawDA !== -1) {
        projectId = await DuAnApi.resolveId(rawDA);
        if (!projectId) return { data: [], total: 0 };
      }
      const size = Math.max(1, Number(payload?.Limit ?? payload?.limit ?? 50) || 50);
      return await SanPhamApi.list({
        projectId,
        zoneId: payload?.MaKhu ?? payload?.maKhu ?? null,
        statusId: payload?.MaTT ?? payload?.maTT ?? null,
        formCode: String(payload?.FormCode ?? payload?.formCode ?? "").trim() || null,
        keyword: String(payload?.InputSearch ?? payload?.KyHieu ?? payload?.kyHieu ?? payload?.keyword ?? "").trim() || null,
        page: pageIndexFromOffset(payload?.offSet ?? payload?.offset ?? 1, size),
        size,
      });
    } catch (e) {
      console.log("ERROR getProducts (fn_nv_app_san_pham_list):", errorMessage(e));
      return { data: [], total: 0, error: errorMessage(e) };
    }
  },

  /** Khu của dự án (ô lọc màn Sản phẩm). payload: { maDA } — mã dự án hoặc uuid. */
  getKhuVuc: async (payload: any = {}) => {
    try {
      const projectId = await DuAnApi.resolveId(payload?.MaDA ?? payload?.maDA);
      if (!projectId) return { data: [] };
      return { data: (await SanPhamApi.filters(projectId)).khu };
    } catch (e) {
      console.log("ERROR getKhuVuc (fn_nv_app_san_pham_bo_loc):", errorMessage(e));
      return { data: [], error: errorMessage(e) };
    }
  },

  /** Chi tiết căn theo { maSP } (uuid / mã SP / ký hiệu). ThoiGianConLai = số giây lock còn lại (giờ máy chủ). */
  getDetailProducts: async (payload: any = {}) => {
    try {
      const d = await loadProductDetail(payload?.MaSP ?? payload?.maSP ?? payload?.id, payload?.fresh === true);
      return { data: d ? d.product : null, perms: d?.perms ?? null };
    } catch (e) {
      console.log("ERROR getDetailProducts (fn_nv_app_san_pham_chi_tiet):", errorMessage(e));
      return { data: null, error: errorMessage(e) };
    }
  },

  /** Ảnh căn (ảnh căn → mẫu căn → ảnh dự án → mặc định) dạng cũ [{ HinhAnh }]. */
  getBannerProduct: async (payload: any = {}) => {
    try {
      const d = await loadProductDetail(payload?.MaSP ?? payload?.maSP ?? payload?.id);
      return { data: (d?.images ?? []).map((u) => ({ HinhAnh: u })) };
    } catch (e) {
      console.log("ERROR getBannerProduct (fn_nv_app_san_pham_chi_tiet):", errorMessage(e));
      return { data: [] };
    }
  },

  /**
   * Danh sách sàn giao dịch — cloud (dm_companies is_san=true).
   * Chuẩn hoá về { ID, MaSan, MaCT, TenSan, TenCT } khớp với normalizeSanGiaoDich trên web.
   * TODO(phần 3 — Booking): chuyển sang API riêng cùng luồng chọn sàn của web (useAgencySan).
   */
  getSanGiaoDichAPI: async () => {
    try {
      const companyId = await getCompanyId();
      const validJwt = await getValidSupabaseJwt();
      if (!validJwt) return { data: [] };

      const params: Record<string, string> = {
        select:
          "id,ten_ct,ten_ct_vt,dia_chi,dien_thoai,fax,email,ma_so_thue,ma_dl,is_san,ap_dung,parent_id",
        is_san: "eq.true",
        order: "ten_ct_vt.asc",
      };

      if (companyId && UUID_RE.test(companyId)) {
        params.tenant_company_id = `eq.${companyId}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/dm_companies", {
        params,
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.map((r: any) => ({
        ID: r.id,
        MaSan: r.ma_dl || r.id,
        MaCT: r.ma_dl || r.id,
        TenSan: r.ten_ct_vt || r.ten_ct || "",
        TenCT: r.ten_ct_vt || r.ten_ct || "",
        DiaChi: r.dia_chi || "",
        DienThoai: r.dien_thoai || "",
        Email: r.email || "",
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getSanGiaoDichAPI:", error);
      return { data: [] };
    }
  },
};
