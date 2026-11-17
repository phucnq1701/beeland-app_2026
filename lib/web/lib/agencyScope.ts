// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/agencyScope.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { tenant } from "../services/CloudMirror";
import { sessionCompanyId, sessionBranchId, sessionEmployeeId } from "../_shims/lib/session";

/** Tài khoản hiện tại có phải đại lý không */
export const isAgencyAccount = (): boolean => {
  try {
    if (localStorage.getItem("account_type") === "AGENCY") return true;
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    return String(u?.typeAccount || "").toUpperCase() === "AGENCY";
  } catch {
    return false;
  }
};

/** Mã công ty (đại lý) của tài khoản đang đăng nhập */
export const getAgencyCompanyId = (): string | null => {
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    const v = u?.maCT ?? u?.MaCT ?? u?.profile?.maCT ?? u?.profile?.MaCT;
    return v == null || v === "" ? null : String(v);
  } catch {
    return null;
  }
};

/** Tập định danh của đại lý đang đăng nhập (MaCT, MaNV, tên đại lý...) */
export const getAgencyAliases = (): Set<string> => {
  const out = new Set<string>();
  const push = (v: any) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (s) out.add(s);
  };
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    [u?.maCT, u?.MaCT, u?.maNV, u?.MaNV, u?.tenCT, u?.TenCT, u?.tenCTVT, u?.TenCTVT].forEach(push);
  } catch {
    /* ignore */
  }
  ["agency_company_code", "agency_name"].forEach((k) => push(localStorage.getItem(k)));
  return out;
};

let cache: {
  key: string;
  ids: Set<string>;
  names: Set<string>;
  at: number;
} | null = null;

const norm = (v: any) => String(v ?? "").trim().toLowerCase();

/**
 * Phạm vi dự án của đại lý (ids = uuid + mã dự án cũ, names = tên dự án).
 * Máy chủ xác định đại lý theo phiên (`fn_agency_my_projects`, bảng `da_project_agencies`);
 * null = không phải đại lý / lỗi (đại lý ⇒ fail-closed ở nơi gọi).
 */
const loadScope = async (): Promise<{ ids: Set<string>; names: Set<string> } | null> => {
  if (!isAgencyAccount()) return null;
  const key = `${sessionCompanyId()}|${sessionEmployeeId()}`;
  if (cache && cache.key === key && Date.now() - cache.at < 60_000) return cache;
  try {
    const { data, error } = await supabase.rpc("fn_agency_my_projects" as any);
    if (error || !Array.isArray(data)) return null;
    const ids = new Set<string>();
    const names = new Set<string>();
    (data as any[]).forEach((p: any) => {
      if (p?.id) ids.add(String(p.id));
      if (p?.ma_da_code) ids.add(String(p.ma_da_code));
      if (p?.ten_da) names.add(norm(p.ten_da));
    });
    cache = { key, ids, names, at: Date.now() };
    return cache;
  } catch {
    return null;
  }
};

/** Danh sách MaDA mà đại lý được phân quyền xem (lưu trên Cloud) */
export const getAgencyProjectIds = async (): Promise<Set<string> | null> => {
  const s = await loadScope();
  return s ? s.ids : null;
};

export const clearAgencyProjectCache = () => {
  cache = null;
};

/** Lọc danh sách dự án theo phân quyền đại lý (giữ nguyên nếu không phải đại lý) */
export const filterProjectsForAgency = async <T extends Record<string, any>>(
  list: T[]
): Promise<T[]> => {
  if (!Array.isArray(list) || !list.length) return list || [];
  const s = await loadScope();
  // Agency permissions are fail-closed: if its scope cannot be resolved,
  // never fall back to exposing the tenant's complete project catalog.
  if (!s) return isAgencyAccount() ? [] : list;
  return list.filter(
    (p) =>
      s.ids.has(String(p?.MaDA ?? p?.maDA ?? p?.ID)) ||
      s.names.has(norm(p?.TenDA ?? p?.tenDA ?? p?.Name))
  );
};

const pickProjectIds = (r: any): string[] =>
  [
    r?.MaDA,
    r?.maDA,
    r?.ma_da,
    r?.MaDuAn,
    r?.ProjectId,
    r?.projectId,
    r?.project_id,
    r?.da_project_id,
    r?.raw?.MaDA,
    r?.raw?.ma_da,
    r?.raw?.project_id,
    r?.raw?.da_project_id,
  ]
    .map((v) => String(v ?? "").trim())
    .filter((v) => v !== "" && v !== "0" && v.toLowerCase() !== "null");

const pickProjectId = (r: any) => pickProjectIds(r)[0];

const pickProjectName = (r: any) =>
  r?.TenDA ?? r?.tenDA ?? r?.ten_da ?? r?.project_name ?? r?.raw?.TenDA ?? r?.raw?.ten_da;

/**
 * Lọc dữ liệu nghiệp vụ (booking, đặt cọc, phiếu...) theo dự án đại lý được xem.
 * Không phải đại lý → giữ nguyên. Dòng không xác định được dự án → giữ lại.
 */
export const filterRowsForAgency = async <T extends Record<string, any>>(
  rows: T[]
): Promise<T[]> => {
  if (!Array.isArray(rows) || !rows.length) return rows || [];
  const s = await loadScope();
  if (!s) return isAgencyAccount() ? [] : rows;
  return rows.filter((r) => {
    const ids = pickProjectIds(r);
    if (ids.some((id) => s.ids.has(id))) return true;
    const name = norm(pickProjectName(r));
    if (name && s.names.has(name)) return true;
    // Không xác định được dự án (thiếu cả mã lẫn tên) → giữ lại
    return !ids.length && !name;
  });
};


/**
 * Sàn giao dịch của chính đại lý đang đăng nhập (dùng khi danh mục sàn rỗng).
 * Ưu tiên bản ghi trong danh mục đại lý trên Cloud, sau đó tới hồ sơ đăng nhập.
 */
export const getOwnAgencyAsSan = async (): Promise<any | null> => {
  if (!isAgencyAccount()) return null;
  const aliases = getAgencyAliases();
  const ma_ctdk = tenant();
  try {
    if (ma_ctdk) {
      const { data } = await supabase
        .from("dm_companies" as any)
        .select("id, ten_ct, ten_ct_vt, ma_dl")
        .eq("tenant_company_id", sessionCompanyId() || "00000000-0000-0000-0000-000000000000")
        .eq("is_san", true);
      const rows = (data as any[]) || [];
      const branchId = sessionBranchId();
      // Chuẩn: đại lý của tài khoản = chi nhánh trong token. Không lấy bừa
      // bản ghi đầu tiên vì sẽ hiển thị nhầm dữ liệu của sàn khác.
      const hit =
        (branchId ? rows.find((a: any) => String(a?.id) === branchId) : null) ||
        rows.find((a: any) =>
          [a?.id, a?.ten_ct, a?.ten_ct_vt, a?.ma_dl]
            .map(norm)
            .some((v) => v && aliases.has(v))
        ) ||
        null;
      if (hit) {
        const id = String(hit.id);
        return {
          ID: id,
          MaCT: id,
          MaSan: id,
          TenCT: hit.ten_ct,
          TenCTVT: hit.ten_ct_vt ?? hit.ten_ct,
        };
      }
    }
  } catch {
    /* bỏ qua */
  }
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    const id = Number(u?.maCT ?? u?.MaCT);
    const ten = u?.tenCT ?? u?.TenCT ?? u?.tenCTVT ?? u?.TenCTVT;
    if (id) return { ID: id, MaCT: id, MaSan: id, TenCT: ten, TenCTVT: ten };
  } catch {
    /* bỏ qua */
  }
  return null;
};
