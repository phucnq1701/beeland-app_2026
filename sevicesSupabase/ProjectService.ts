import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

// Chuẩn hoá 1 dự án da_projects -> field UI cũ đang dùng ở Home
function normalizeProject(raw: any) {
  const imageUrl = (raw?.image_url || "").trim();
  const statusText = (raw?.ten_tt || "").trim();
  const maTT = raw?.ma_tt != null ? String(raw.ma_tt) : "";
  return {
    ...raw,
    id: raw?.id,
    MaDA: raw?.ma_da_code ?? raw?.id,
    ma_da_code: raw?.ma_da_code,
    TenDA: raw?.ten_da || raw?.ten_viet_tat || "Dự án",
    ten_da: raw?.ten_da,
    icon: imageUrl || "",
    image_url: imageUrl,
    district: raw?.dia_chi || "",
    dia_chi: raw?.dia_chi || "",
    MaTT: maTT,
    ma_tt: maTT,
    TenTT: statusText,
    ten_tt: statusText,
    // Home đang check MaTT===1/2/3, giữ tương thích text
    is_active: statusText.toLowerCase() === "đang bán",
    statusText: statusText || "Không xác định",
    price: raw?.price || "",
  };
}

function normalizeProjectImages(raw: any) {
  return {
    icon: raw?.anh_icon || "",
    mapImage: raw?.anh_so_do || "",
    background: raw?.anh_background || "",
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ProjectService = {
  getProjects: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    // Anon đã bị khóa SELECT (42501) nên không gọi API khi chưa có JWT hợp lệ
    if (!validJwt) {
      console.log("[Project] chưa có cloud_jwt hợp lệ, bỏ qua gọi da_projects (cần đăng nhập lại)");
      return { data: [] };
    }
    const limit = payload?.limit ?? payload?.Limit ?? 50;

    try {
      const params: Record<string, string> = {
        select:
          "id,ma_da_code,ten_da,ten_viet_tat,dia_chi,ma_tt,ten_tt,image_url,ap_dung,created_at,updated_at",
        order: "ten_da.asc",
        limit: String(limit),
      };
      // ma_ctdk là uuid, nếu là "1" (maCTDK cũ) thì BỎ filter để tránh 400 22P02
      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk = `eq.${companyId}`;
        // chỉ lấy dự án đang áp dụng, giống web ap_dung=true
        params.ap_dung = "is.true";
      } else if (companyId) {
        console.log(
          `[Project] bỏ filter ma_ctdk vì không phải UUID (đang là "${companyId}"), cần đăng nhập lại để có company_id`
        );
      }

      const res = await axiosApiSupabase.get("rest/v1/da_projects", {
        params,
        headers: { Prefer: "count=exact" },
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.map(normalizeProject);

      return { data };
    } catch (error) {
      console.log("ERROR getProjects (da_projects):", error);
      return { data: [] };
    }
  },

  // Lấy ảnh dự án theo MaDA — giữ API cũ, hiện da_projects đã có image_url nên trả null để UI fallback
  getProjectImages: async (_maDA: string | number) => {
    return { data: null as null | ReturnType<typeof normalizeProjectImages> };
  },
};