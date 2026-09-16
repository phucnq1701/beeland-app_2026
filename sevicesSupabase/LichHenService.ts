import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyCode, getValidSupabaseJwt } from "./cloudTenant";

function normalizeLichHen(row: any) {
  const raw = row?.raw || {};
  return {
    ...row,
    raw,
    maLH: raw?.MaLH || row?.item_code || row?.id,
    tieuDe: row?.item_name || raw?.TieuDe || raw?.ChuDe || "Lịch hẹn",
    ngayHen: raw?.NgayHen || row?.created_at,
    status: raw?.TrangThai || "",
    MaKH: raw?.MaKH || "",
  };
}

export const LichHenService = {
  /** API mới: lịch hẹn nằm trong cloud_catalogs catalog_type=lich_hen, tenant = company_code */
  listRecent: async ({ limit = 5 }: { limit?: number } = {}) => {
    // cloud_catalogs chặn anon (42501), không có JWT hợp lệ thì bỏ qua để tránh 401
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[LichHen] bỏ qua vì chưa có cloud_jwt hợp lệ (cloud_catalogs cấm anon)");
      return { data: [] };
    }
    const companyCode = await getCompanyCode();
    try {
      const params: Record<string, string> = {
        select: "id,item_code,item_name,parent_code,raw,created_at",
        catalog_type: "eq.lich_hen",
        order: "created_at.desc",
        limit: String(limit),
      };
      if (companyCode) params.ma_ctdk = `eq.${companyCode}`;
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params,
        headers: { Prefer: "count=exact" },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      return { data: rows.map(normalizeLichHen) };
    } catch (error) {
      console.log("ERROR listRecent LichHen:", error);
      return { data: [] };
    }
  },
};