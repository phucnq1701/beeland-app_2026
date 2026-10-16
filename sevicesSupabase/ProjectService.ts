import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";
import { projectRowsFromRpc } from "../lib/projectScope";

// Máy chủ file upload của web (POST multipart Image, TenCTDK, Project=beeland_admin_web).
const FILE_SERVER = "https://upload.beesky.vn/";

function absUrl(u?: string | null): string {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return FILE_SERVER + s.replace(/^\/+/, "");
}

type DuAnAnhRaw = {
  anh_icon?: string;
  anh_so_do?: string;
  anh_background?: string;
  anh_so_do_3d?: string;
};

function normalizeProject(raw: any, anh?: DuAnAnhRaw | null) {
  const imageUrl = absUrl(raw?.image_url);
  const anhBackground = absUrl(anh?.anh_background);
  const anhIcon = absUrl(anh?.anh_icon);
  const anhSoDo = absUrl(anh?.anh_so_do);
  const anhSoDo3d = absUrl(anh?.anh_so_do_3d);
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
    icon: displayImage,
    background: displayImage,
    anh_background: anhBackground,
    anh_icon: anhIcon,
    anh_so_do: anhSoDo,
    anh_so_do_3d: anhSoDo3d,
    image_url: imageUrl,
    mapImage: anhSoDo || displayImage,
    district: raw?.dia_chi || "",
    dia_chi: raw?.dia_chi || "",
    MaTT: maTT,
    ma_tt: maTT,
    TenTT: statusText,
    ten_tt: statusText,
    is_active: statusText.toLowerCase() === "đang bán",
    statusText: statusText || "Không xác định",
    price: raw?.price || "",
  };
}

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
  /**
   * Danh sách dự án người đăng nhập được xem — cùng hàm web dùng cho mọi ô chọn dự án
   * (`fn_da_project_list`, web `src/services/ProjectDaCloudService.ts` listManagedProjects).
   * Máy chủ tự áp công ty (JWT) + phạm vi: nhân viên đại lý ⇒ dự án gán cho đại lý ở tab Đại lý của dự án;
   * nội bộ ⇒ dự án được gán cho nhân viên (full access / admin ⇒ mọi dự án). App không tự lọc phạm vi nữa
   * (bản cũ đọc `cloud_generic_records` endpoint `admin/du-an/dai-ly` — web đã xoá 2026-10-14 ⇒ đại lý luôn rỗng).
   */
  getProjects: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Project] chưa có cloud_jwt hợp lệ, bỏ qua fn_da_project_list (cần đăng nhập lại)");
      return { data: [] };
    }
    const limit = Math.max(1, Number(payload?.limit ?? payload?.Limit ?? 50) || 50);
    const keyword = String(payload?.keyword ?? payload?.InputSearch ?? "").trim();

    try {
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_da_project_list", {
        p_keyword: keyword || null,
        p_page: 1,
        p_size: limit,
      });
      const rows = projectRowsFromRpc(res?.data);

      const anhMap = await fetchDuAnAnhMap(rows.map((r: any) => r?.ma_da_code));
      const data = rows.map((r: any) =>
        normalizeProject(r, r?.ma_da_code != null ? anhMap[String(r.ma_da_code)] : null)
      );

      return { data };
    } catch (error) {
      console.log("ERROR getProjects (fn_da_project_list):", error);
      return { data: [] };
    }
  },

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