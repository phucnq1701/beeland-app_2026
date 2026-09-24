import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map ma_da_code (text, vd "148") -> da_projects.id (uuid).
 */
async function resolveProjectUuid(maDA: any): Promise<string | null> {
  if (maDA == null || maDA === "" || maDA === -1) return null;
  const value = String(maDA).trim();
  if (UUID_RE.test(value)) return value;

  try {
    const res = await axiosApiSupabase.get("rest/v1/da_projects", {
      params: { select: "id", ma_da_code: `eq.${value}`, limit: "1" },
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.log("ERROR resolveProjectUuid (da_projects):", error);
    return null;
  }
}

/**
 * 1 dòng bảng giá (bảng price_list_items) — các cột phục vụ hiển thị giá
 * ở màn chi tiết sản phẩm. RPC get_active_price_for_product trả
 * SETOF price_list_items nhưng thực chất tối đa 1 dòng (đã LIMIT 1 trong SQL).
 */
export interface ActivePriceListItem {
  id?: string;
  price_list_id?: string;
  product_code?: string | null;
  product_name?: string | null;
  product_type?: string | null;
  area?: number | null;
  unit_price?: number | null;
  vat_rate?: number | null;
  maintenance_rate?: number | null;
  status?: string | null;
  created_at?: string | null;
  bedroom_count?: string | null;
  direction?: string | null;
  ma_ctdk?: string | null;
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
  construction_unit_price?: number | null;
  construction_amount?: number | null;
  raw?: Record<string, any> | null;
  ma_ctdk_uid?: string | null;
  product_id?: string | null;
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
  extra?: Record<string, any> | null;
}

/**
 * Web tính các cột tổng ngay trên FE khi DB chưa lưu (null):
 *   Tổng giá chưa VAT  = DT thông thủy × Đơn giá chưa VAT
 *   Tiền VAT           = Tổng giá chưa VAT × vat_rate/100
 *   Tổng giá gồm VAT   = Tổng giá chưa VAT + Tiền VAT
 *   Phí bảo trì        = Tổng giá gồm VAT × maintenance_rate/100
 *   Tổng giá gồm PBT   = Tổng giá gồm VAT + Phí bảo trì
 * Chỉ fill khi cột DB đang null; giá trị DB đã có được giữ nguyên.
 */
export function computeActivePriceTotals(
  item: ActivePriceListItem | null
): ActivePriceListItem | null {
  if (!item) return null;

  const fin = (v: any): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const area = fin(item.area) ?? 0;
  const unitPrice = fin(item.unit_price) ?? 0;
  const vatRate = fin(item.vat_rate) ?? 0;
  const maintenanceRate = fin(item.maintenance_rate) ?? 0;

  const totalBefore =
    fin(item.total_before_vat) ??
    (area > 0 && unitPrice > 0 ? area * unitPrice : null);
  const vatAmount =
    fin(item.vat_amount) ??
    (totalBefore != null ? totalBefore * (vatRate / 100) : null);
  const totalAfter =
    fin(item.total_after_vat) ??
    (totalBefore != null ? totalBefore + (vatAmount ?? 0) : null);
  const maintenanceAmount =
    fin(item.maintenance_amount) ??
    (totalAfter != null ? totalAfter * (maintenanceRate / 100) : null);
  const totalPayment =
    fin(item.total_payment) ??
    (totalAfter != null ? totalAfter + (maintenanceAmount ?? 0) : null);

  return {
    ...item,
    total_before_vat: totalBefore,
    vat_amount: vatAmount,
    total_after_vat: totalAfter,
    maintenance_amount: maintenanceAmount,
    total_payment: totalPayment,
  };
}

/**
 * Resolve UUID sản phẩm (bds_products.id): nhận sẵn uuid hoặc tra theo
 * ma_sp / ky_hieu — giống cách checkBooking đã làm (or= bắt buộc bọc ngoặc).
 */
async function resolveProductUuid(
  productId: any,
  maSP: any
): Promise<string | null> {
  const direct = String(productId ?? "").trim();
  if (UUID_RE.test(direct)) return direct;

  const code = String(maSP ?? "").trim();
  if (!code) return null;
  try {
    const safe = code.replace(/[,()]/g, "");
    const r = await axiosApiSupabase.get("rest/v1/bds_products", {
      params: {
        select: "id",
        or: `(ma_sp.eq.${safe},ky_hieu.eq.${safe})`,
        limit: "1",
      },
    });
    const rows = Array.isArray(r.data) ? r.data : [];
    return rows[0]?.id || null;
  } catch (error) {
    console.log("ERROR resolveProductUuid (bds_products):", error);
    return null;
  }
}

/**
 * Lấy block/khu theo dự án — cloud.
 * Nhóm sản phẩm theo khu -> tầng -> căn.
 * Trục lưới (tầng = catalog `tang`, cột = catalog `vi_tri`) lấy từ cloud_catalogs
 * theo ma_ctdk_uid + da_project_id (theo web AI) — vì ma_tang/vi_tri là uuid.
 * Shape: { data: [{ maKhu, tenKhu, location:[{maVT,tenVT}], floor:[{maTang,tenTang,detailFloor:[]}] }] }
 */
export const PriceServices = {
  getBlock: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Price] chưa có cloud_jwt, bỏ qua getBlock");
      return { data: [] };
    }

    try {
      const maDA = payload?.maDA ?? payload?.MaDA;
      const projectUuid = await resolveProjectUuid(maDA);
      if (!projectUuid) return { data: [] };

      const params: Record<string, string> = {
        select: [
          "id",
          "ma_sp",
          "ky_hieu",
          "ma_da",
          "ma_khu",
          "ma_tang",
          "ma_tt",
          "vi_tri",
          "mau_nen",
          "tong_gia_gom_vat",
          "khu:ma_khu(id,item_code,item_name)",
          "tang:ma_tang(id,item_code,item_name)",
          "tt:ma_tt(id,item_name,color_code)",
        ].join(","),
        ma_da: `eq.${projectUuid}`,
        order: "created_at.desc",
        limit: "2000",
      };

      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk = `eq.${companyId}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/bds_products", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];

      // Trục lưới: tầng (catalog tang) + cột (catalog vi_tri) theo dự án
      const catalogBase: Record<string, string> = {
        select: "id,item_code,item_name",
        da_project_id: `eq.${projectUuid}`,
        order: "item_code.asc",
        limit: "500",
      };
      if (companyId && UUID_RE.test(companyId)) {
        catalogBase.ma_ctdk_uid = `eq.${companyId}`;
      }

      let tangList: any[] = [];
      let vtList: any[] = [];
      try {
        const [tangRes, vtRes] = await Promise.all([
          axiosApiSupabase.get("rest/v1/cloud_catalogs", {
            params: { ...catalogBase, catalog_type: "eq.tang" },
          }),
          axiosApiSupabase.get("rest/v1/cloud_catalogs", {
            params: { ...catalogBase, catalog_type: "eq.vi_tri" },
          }),
        ]);
        tangList = Array.isArray(tangRes.data) ? tangRes.data : [];
        vtList = Array.isArray(vtRes.data) ? vtRes.data : [];
      } catch (e) {
        console.log("ERROR getBlock catalogs (tang/vi_tri):", e);
      }

      const tangOrder = new Map<string, number>();
      tangList.forEach((t: any, i: number) => tangOrder.set(t.id, i));

      const location = vtList.map((v: any) => ({
        maVT: v.id,
        tenVT: v.item_name || v.item_code || v.id,
      }));

      // Nhóm theo khu
      const blockMap = new Map<string, any>();
      for (const r of rows) {
        const maKhu = r.ma_khu;
        if (maKhu == null || maKhu === -1) continue;

        if (!blockMap.has(String(maKhu))) {
          blockMap.set(String(maKhu), {
            maKhu,
            tenKhu: r.khu?.item_name || r.khu?.item_code || String(maKhu),
            location,
            floor: [],
          });
        }
        const block = blockMap.get(String(maKhu));

        const maTang = r.ma_tang;
        let floor = block.floor.find(
          (f: any) => String(f.maTang) === String(maTang)
        );
        if (!floor) {
          floor = {
            maTang,
            tenTang: r.tang?.item_name || r.tang?.item_code || String(maTang),
            detailFloor: [],
          };
          block.floor.push(floor);
        }

        floor.detailFloor.push({
          MaSP: r.ma_sp,
          KyHieu: r.ky_hieu,
          MaVT: r.vi_tri,
          MaTT: r.ma_tt,
          GiaBan: r.tong_gia_gom_vat,
          MauNen: r.mau_nen || r.tt?.color_code || "",
          TenTT: r.tt?.item_name || "",
          ColorTT: r.tt?.color_code || "",
        });
      }

      // Sắp tầng theo catalog tang (item_code asc); nếu catalog trống thì giữ nguyên
      const data = Array.from(blockMap.values()).map((b: any) => ({
        ...b,
        floor: [...b.floor].sort((a: any, c: any) => {
          const ai = tangOrder.get(a.maTang);
          const ci = tangOrder.get(c.maTang);
          if (ai != null && ci != null) return ai - ci;
          return String(a.tenTang).localeCompare(String(c.tenTang), "vi");
        }),
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getBlock (bds_products):", error);
      return { data: [] };
    }
  },

  /**
   * Giá đang hiệu lực của 1 sản phẩm — gọi RPC
   * get_active_price_for_product(p_ma_ctdk_uid, p_product_id, p_check_date).
   * Function trả SETOF price_list_items nhưng thực chất tối đa 1 dòng
   * (đã LIMIT 1 trong SQL) → lấy phần tử đầu tiên, rỗng thì null.
   * payload: { productId?: uuid, maSP?: string, checkDate?: "YYYY-MM-DD" }
   * (p_check_date có default current_date trong SQL — chỉ gửi khi có)
   */
  getActivePriceForProduct: async (
    payload: {
      productId?: any;
      maSP?: any;
      MaSP?: any;
      checkDate?: string;
    } = {}
  ): Promise<{ data: ActivePriceListItem | null }> => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
      console.log(
        "[Price] chưa có cloud_jwt/company_id hợp lệ, bỏ qua getActivePriceForProduct"
      );
      return { data: null };
    }

    try {
      const productUuid = await resolveProductUuid(
        payload?.productId,
        payload?.maSP ?? payload?.MaSP
      );
      if (!productUuid) return { data: null };

      const body: Record<string, any> = {
        p_ma_ctdk_uid: companyId,
        p_product_id: productUuid,
      };
      const checkDate = String(payload?.checkDate ?? "").trim();
      if (checkDate) body.p_check_date = checkDate;

      const res = await axiosApiSupabase.post(
        "rest/v1/rpc/get_active_price_for_product",
        body
      );
      const rows = Array.isArray(res.data)
        ? res.data
        : res.data
          ? [res.data]
          : [];
      return {
        data:
          rows.length > 0
            ? computeActivePriceTotals(rows[0] as ActivePriceListItem)
            : null,
      };
    } catch (error) {
      console.log("ERROR getActivePriceForProduct:", error);
      return { data: null };
    }
  },
};
