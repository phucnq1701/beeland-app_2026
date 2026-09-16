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
};