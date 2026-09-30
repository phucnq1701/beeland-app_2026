import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt, getTypeAccount, getEmployeeId, getMaNv, getCompanyCode } from "./cloudTenant";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

/**
 * Lấy tập MaDA/uuid dự án được gán cho đại lý (Agency Scope) y hệt logic web (agencyScope.ts).
 */
async function getAgencyProjectScope(companyId: string): Promise<{ ids: string[]; names: string[] }> {
  try {
    const typeAccount = await getTypeAccount();
    if (typeAccount !== "AGENCY") return { ids: [], names: [] };

    const aliases = new Set<string>();
    const addAlias = (v?: any) => {
      if (v != null && String(v).trim() !== "") {
        aliases.add(String(v).trim().toLowerCase());
      }
    };

    addAlias(await getCompanyCode());
    addAlias(await getMaNv());
    const empId = await getEmployeeId();
    
    const storedAgencyName = await AsyncStorage.getItem("agency_name");
    addAlias(storedAgencyName);
    const storedCompanyCode = await AsyncStorage.getItem("agency_company_code");
    addAlias(storedCompanyCode);

    // 1. Truy vấn dm_employees
    try {
      const empParams: Record<string, string> = {
        select: "id,ma_nv,ma_so,tai_khoan,email,ma_ct",
        ma_ctdk: `eq.${companyId}`,
      };
      if (empId && UUID_RE.test(empId)) {
        empParams.id = `eq.${empId}`;
      }
      const empRes = await axiosApiSupabase.get("rest/v1/dm_employees", { params: empParams });
      const empRows = Array.isArray(empRes.data) ? empRes.data : [];
      empRows.forEach((e: any) => {
        addAlias(e?.ma_nv);
        addAlias(e?.ma_so);
        addAlias(e?.tai_khoan);
        addAlias(e?.email);
        addAlias(e?.ma_ct);
      });
    } catch (e) {
      console.log("ERROR getAgencyProjectScope dm_employees:", e);
    }

    // 2. Truy vấn dm_companies (is_san = true)
    try {
      const compParams: Record<string, string> = {
        select: "id,ma_dl,ten_ct,ten_ct_vt",
        tenant_company_id: `eq.${companyId}`,
        is_san: "is.true",
      };
      const compRes = await axiosApiSupabase.get("rest/v1/dm_companies", { params: compParams });
      const compRows = Array.isArray(compRes.data) ? compRes.data : [];
      compRows.forEach((c: any) => {
        addAlias(c?.id);
        addAlias(c?.ma_dl);
        addAlias(c?.ten_ct);
        addAlias(c?.ten_ct_vt);
      });
    } catch (e) {
      console.log("ERROR getAgencyProjectScope dm_companies:", e);
    }

    console.log("[AgencyScope] Aliases:", Array.from(aliases));

    // 3. Truy vấn cloud_generic_records với endpoint admin/du-an/dai-ly
    const recordsParams: Record<string, string> = {
      select: "payload",
      ma_ctdk: `eq.${companyId}`,
      endpoint: "eq.admin/du-an/dai-ly",
      is_deleted: "eq.false",
    };
    const recRes = await axiosApiSupabase.get("rest/v1/cloud_generic_records", { params: recordsParams });
    const recRows = Array.isArray(recRes.data) ? recRes.data : [];
    console.log("[AgencyScope] cloud_generic_records count:", recRows.length);

    const matchedDaCodes = new Set<string>();
    recRows.forEach((r: any) => {
      const p = r?.payload || {};
      const maCT = p.MaCT || p.ma_ct || p.MaDL || p.ma_dl || "";
      const tenCT = p.TenCT || p.ten_ct || p.TenCTVT || p.ten_ct_vt || "";
      const maDA = p.MaDA || p.ma_da || p.ma_da_code || "";

      if (maDA) {
        const match =
          (maCT && aliases.has(String(maCT).trim().toLowerCase())) ||
          (tenCT && aliases.has(String(tenCT).trim().toLowerCase())) ||
          aliases.size === 0;
        if (match) {
          matchedDaCodes.add(String(maDA).trim());
        }
      }
    });

    console.log("[AgencyScope] matchedDaCodes:", Array.from(matchedDaCodes));

    if (matchedDaCodes.size === 0) {
      return { ids: [], names: [] };
    }

    // 4. Đối chiếu da_projects
    const projParams: Record<string, string> = {
      select: "id,ma_da_code,ten_da",
      ma_ctdk: `eq.${companyId}`,
    };
    const projRes = await axiosApiSupabase.get("rest/v1/da_projects", { params: projParams });
    const projRows = Array.isArray(projRes.data) ? projRes.data : [];

    const ids: string[] = [];
    const names: string[] = [];

    projRows.forEach((proj: any) => {
      const pId = proj?.id;
      const pCode = proj?.ma_da_code != null ? String(proj.ma_da_code).trim() : "";
      const pName = proj?.ten_da != null ? String(proj.ten_da).trim() : "";

      if (
        (pCode && matchedDaCodes.has(pCode)) ||
        (pId && matchedDaCodes.has(pId)) ||
        matchedDaCodes.has(pName)
      ) {
        if (pId) ids.push(pId);
        if (pCode) ids.push(pCode);
        if (pName) names.push(pName);
      }
    });

    return { ids: Array.from(new Set(ids)), names: Array.from(new Set(names)) };
  } catch (e) {
    console.log("ERROR getAgencyProjectScope:", e);
    return { ids: [], names: [] };
  }
}

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
  getProjects: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Project] chưa có cloud_jwt hợp lệ, bỏ qua gọi da_projects (cần đăng nhập lại)");
      return { data: [] };
    }
    const limit = payload?.limit ?? payload?.Limit ?? 50;

    try {
      const typeAccount = await getTypeAccount();
      let agencyScopeIds: string[] = [];
      let agencyScopeNames: string[] = [];
      if (typeAccount === "AGENCY" && companyId && UUID_RE.test(companyId)) {
        const scope = await getAgencyProjectScope(companyId);
        agencyScopeIds = scope.ids;
        agencyScopeNames = scope.names;
        console.log("[Project] Agency scope resolved:", { agencyScopeIds, agencyScopeNames });
        if (agencyScopeIds.length === 0 && agencyScopeNames.length === 0) {
          return { data: [] };
        }
      }

      const params: Record<string, string> = {
        select:
          "id,ma_da_code,ten_da,ten_viet_tat,dia_chi,ma_tt,ten_tt,image_url,ap_dung,created_at,updated_at",
        order: "ten_da.asc",
        limit: String(limit),
      };
      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk = `eq.${companyId}`;
        params.ap_dung = "is.true";
      } else if (companyId) {
        console.log(
          `[Project] bỏ filter ma_ctdk vì không phải UUID (đang là "${companyId}")`
        );
      }

      const res = await axiosApiSupabase.get("rest/v1/da_projects", {
        params,
        headers: { Prefer: "count=exact" },
      });

      let rows = Array.isArray(res.data) ? res.data : [];

      if (typeAccount === "AGENCY") {
        rows = rows.filter((r: any) => {
          const rId = r?.id;
          const rCode = r?.ma_da_code != null ? String(r.ma_da_code).trim() : "";
          const rName = r?.ten_da != null ? String(r.ten_da).trim() : "";
          return (
            agencyScopeIds.includes(rId) ||
            agencyScopeIds.includes(rCode) ||
            agencyScopeNames.includes(rName)
          );
        });
      }

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