import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

// Máy chủ file upload của web (POST multipart Image, TenCTDK, Project=beeland_admin_web).
// cloud_catalogs.raw lưu đường dẫn TƯƠNG ĐỐI (vd "upload/beeland_admin_web/brg/anhDuAn_xxx.jpg")
// → ghép tiền tố https://upload.beesky.vn/ để có URL đầy đủ.
const FILE_SERVER = "https://upload.beesky.vn/";

/** Chuẩn hoá URL ảnh: tuyệt đối hoá đường dẫn tương đối với máy chủ file */
function absUrl(u?: string | null): string {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return FILE_SERVER + s.replace(/^\/+/, "");
}

/** raw.anh_* của 1 dòng cloud_catalogs (catalog_type = 'du_an_anh') */
type DuAnAnhRaw = {
  anh_icon?: string;
  anh_so_do?: string;
  anh_background?: string;
  anh_so_do_3d?: string;
};

/**
 * Chuẩn hoá 1 dự án da_projects → field UI cũ đang dùng ở Home.
 * Ảnh hiển thị (icon) lấy theo WEB: Ảnh background → Ảnh icon → image_url.
 * (image_url của da_projects KHÔNG phải "Ảnh background" trên web)
 */
function normalizeProject(raw: any, anh?: DuAnAnhRaw | null) {
  const imageUrl = absUrl(raw?.image_url);
  // 4 ảnh đúng của web (cloud_catalogs.raw)
  const anhBackground = absUrl(anh?.anh_background);
  const anhIcon = absUrl(anh?.anh_icon);
  const anhSoDo = absUrl(anh?.anh_so_do);
  const anhSoDo3d = absUrl(anh?.anh_so_do_3d);
  // Ảnh đại diện hiển thị: web dùng "Ảnh background" làm banner/nền dự án
  const displayImage = anhBackground || anhIcon || imageUrl;

  const statusText = (raw?.ten_tt || "").trim();
  const maTT = raw?.ma_tt != null ? String(raw.ma_tt) : "";
  return {
    ...raw,
    id: raw?.id,
    MaDA: raw?.ma_da_code ?? raw?.id,
    ma_da_code: raw?.ma_da_code,
    TenDA: raw?.ten_da || raw?.ten_viet_tat || "Dự án",
    ten_da: raw?.ten_da,
    // Ảnh chính cho UI (Home banner, danh sách, chi tiết dự án)
    icon: displayImage,
    background: displayImage,
    // 4 ảnh chuẩn theo web
    anh_background: anhBackground,
    anh_icon: anhIcon,
    anh_so_do: anhSoDo,
    anh_so_do_3d: anhSoDo3d,
    // Giữ image_url gốc để tham chiếu (không dùng làm banner)
    image_url: imageUrl,
    mapImage: anhSoDo || displayImage,
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

/** row cloud_catalogs → ảnh dự án (shape getProjectImages cũ) */
function normalizeProjectImages(catalog: any) {
  const raw: DuAnAnhRaw = catalog?.raw || {};
  const background = absUrl(raw.anh_background);
  const icon = absUrl(raw.anh_icon);
  const soDo = absUrl(raw.anh_so_do);
  const display = background || icon;
  return {
    icon: display,
    mapImage: soDo || display,
    background: display || "",
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lấy ảnh (du_an_anh) của NHIỀU dự án trong 1 query.
 * Web lưu ảnh vào cloud_catalogs: catalog_type='du_an_anh',
 * item_code = ma_da_code (mã số dự án), raw = { anh_icon, anh_so_do, anh_background, anh_so_do_3d }
 * → trả Map: ma_da_code (string) → DuAnAnhRaw
 */
async function fetchDuAnAnhMap(
  maDaCodes: Array<string | number>
): Promise<Record<string, DuAnAnhRaw>> {
  const map: Record<string, DuAnAnhRaw> = {};
  const codes = Array.from(
    new Set(maDaCodes.filter((c) => c != null && String(c).trim() !== "").map(String))
  );
  if (codes.length === 0) return map;

  try {
    const companyId = await getCompanyId();
    const params: Record<string, string> = {
      select: "item_code,raw",
      catalog_type: "eq.du_an_anh",
      item_code: `in.(${codes.join(",")})`,
    };
    // cloud_catalogs dùng cột ma_ctdk_uid (uuid) — KHÔNG phải ma_ctdk
    if (companyId && UUID_RE.test(companyId)) {
      params.ma_ctdk_uid = `eq.${companyId}`;
    }

    const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", { params });
    const rows = Array.isArray(res.data) ? res.data : [];
    rows.forEach((r: any) => {
      if (r?.item_code != null) {
        map[String(r.item_code)] = r?.raw || {};
      }
    });
  } catch (error) {
    console.log("ERROR fetchDuAnAnhMap (cloud_catalogs du_an_anh):", error);
  }
  return map;
}

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

      // Ảnh dự án đúng nằm ở cloud_catalogs (catalog_type=du_an_anh) —
      // batch 1 query theo toàn bộ ma_da_code rồi ghép vào từng dự án
      const anhMap = await fetchDuAnAnhMap(rows.map((r: any) => r?.ma_da_code));
      const data = rows.map((r: any) =>
        normalizeProject(r, r?.ma_da_code != null ? anhMap[String(r.ma_da_code)] : null)
      );

      return { data };
    } catch (error) {
      console.log("ERROR getProjects (da_projects):", error);
      return { data: [] };
    }
  },

  // Ảnh dự án theo MaDA (ma_da_code) — đọc cloud_catalogs catalog_type='du_an_anh'
  getProjectImages: async (maDA: string | number) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || maDA == null || maDA === "") {
      return { data: null as null | ReturnType<typeof normalizeProjectImages> };
    }
    try {
      const companyId = await getCompanyId();
      const params: Record<string, string> = {
        select: "item_code,raw",
        catalog_type: "eq.du_an_anh",
        item_code: `eq.${maDA}`,
        limit: "1",
      };
      // cloud_catalogs dùng cột ma_ctdk_uid (uuid) — KHÔNG phải ma_ctdk
      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk_uid = `eq.${companyId}`;
      }
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", { params });
      const rows = Array.isArray(res.data) ? res.data : [];
      return {
        data: rows.length > 0 ? normalizeProjectImages(rows[0]) : null,
      };
    } catch (error) {
      console.log("ERROR getProjectImages (cloud_catalogs):", error);
      return { data: null as null | ReturnType<typeof normalizeProjectImages> };
    }
  },
};