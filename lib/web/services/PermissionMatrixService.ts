// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/PermissionMatrixService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Phân quyền 3 CẤP (chuẩn mới, dùng danh mục sys_* toàn hệ thống):
 *
 *  Cấp 1 – Gói sản phẩm      : cloud_module_groups + cloud_module_group_forms
 *  Cấp 2 – Công ty đăng ký   : company_form_permissions (trong phạm vi gói)
 *  Cấp 3 – Nhóm quyền/NV     : sys_perm_groups + sys_perm_group_forms + perm_user_groups
 *
 * Quyền hiệu lực = giao (intersect) của cả 3 cấp.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { packageFormIds, packageForms } from "./PackageCatalogService";
import { SysPackageService } from "./SysPackageService";

import { sessionCompanyId, sessionCompanyCode, sessionMaNV, sessionPerId, sessionPermGroupUid } from "../_shims/lib/session";
import { assertRowsAffected, friendlyWriteError } from "../lib/restWriteGuard";

const t = (name: string) => supabase.from(name as any);

/** Phạm vi dữ liệu của 1 chức năng trong nhóm quyền */
export type DataScopeCode = "COMPANY" | "EMPLOYEE";

const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ---------------------- Công ty đăng ký ---------------------- */

export interface CompanyRow {
  id: string;
  code?: string | null;
  ten_ct?: string | null;
  package_code?: string | null;
  is_active?: boolean | null;
  is_root?: boolean | null;
}

const COMPANY_COLS = "id, code, ten_ct, package_code, is_active, is_root, raw";

/**
 * Khoá gói = `cloud_module_groups.group_id`. Dữ liệu cũ mới chỉ lưu ở
 * `raw.MaNhomSP`, nên đọc dự phòng từ đó để cấp 1 không bị rỗng.
 */
const mapCompany = (r: any): CompanyRow => ({
  id: r?.id,
  code: r?.code ?? null,
  ten_ct: r?.ten_ct ?? null,
  package_code:
    (r?.package_code && String(r.package_code).trim()) ||
    (r?.raw?.MaNhomSP != null && String(r.raw.MaNhomSP).trim()) ||
    null,
  is_active: r?.is_active ?? null,
  is_root: r?.is_root ?? null,
});

export const listCompanies = async (): Promise<CompanyRow[]> => {
  const { data, error } = await t("cloud_companies")
    .select(COMPANY_COLS)
    .order("ten_ct", { ascending: true });
  if (error) throw error;
  return ((data || []) as any[]).map(mapCompany);
};

export const getCompany = async (idOrCode: string): Promise<CompanyRow | null> => {
  const key = String(idOrCode || "").trim();
  if (!key) return null;
  const isUuid = /^[0-9a-f-]{36}$/i.test(key);
  const q = t("cloud_companies").select(COMPANY_COLS);
  const { data, error } = isUuid
    ? await q.eq("id", key).maybeSingle()
    : await q.eq("code", key.toLowerCase()).maybeSingle();
  if (error || !data) return null;
  return mapCompany(data);
};

/**
 * Tạo / cập nhật CÔNG TY ĐĂNG KÝ (cloud_companies) theo mã đăng nhập và
 * trả về uuid của chính công ty vừa tạo (không phụ thuộc token đang đăng nhập).
 */
export const saveCompany = async (input: {
  code: string;
  ten_ct?: string | null;
  email?: string | null;
  dien_thoai?: string | null;
  dia_chi?: string | null;
  package_code?: string | null;
  package_uid?: string | null;
  is_active?: boolean;
  raw?: any;
}): Promise<string> => {
  const code = String(input.code || "").trim().toLowerCase();
  if (!code) throw new Error("Thiếu mã công ty đăng ký");
  const payload: any = {
    code,
    ten_ct: input.ten_ct ?? null,
    email: input.email ?? null,
    dien_thoai: input.dien_thoai ?? null,
    dia_chi: input.dia_chi ?? null,
    package_code: input.package_code ?? null,
    package_uid: input.package_uid ?? null,
    is_active: input.is_active !== false,
  };
  if (input.raw) payload.raw = input.raw;
  const { data, error } = await t("cloud_companies")
    .upsert(payload, { onConflict: "code" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  const id = String((data as any)?.id || "");
  if (id) return id;
  const found = await getCompany(code);
  if (!found?.id) throw new Error("Không lấy được uuid công ty đăng ký vừa tạo");
  return found.id;
};

/** uuid công ty của phiên hiện tại (ưu tiên token, dự phòng tra theo mã) */
export const currentCompanyId = async (): Promise<string> => {
  const fromToken = sessionCompanyId();
  if (fromToken) return fromToken;
  const c = await getCompany(sessionCompanyCode());
  return c?.id || "";
};

export const setCompanyPackage = async (companyId: string, packageCode: string | null) => {
  const pkg = packageCode ? await SysPackageService.getPackage(packageCode) : null;
  await assertRowsAffected(
    await t("cloud_companies")
      .update({
        package_code: pkg?.packageCode ?? packageCode,
        package_uid: pkg?.id ?? null,
      } as any)
      .eq("id", companyId)
      .select("id"),
  );
};

/* ---------------- Cấp 2: quyền form của công ty (sys_data_access) ---------------- */

export const companyFormIds = async (companyId: string): Promise<Set<number>> => {
  if (!companyId) return new Set();
  return SysPackageService.companyFormIds(companyId);
};

/** Bật/tắt 1 form cho công ty — chặn nếu form không nằm trong gói đã bán */
export const setCompanyForm = async (
  companyId: string,
  formId: number,
  hasPermission: boolean,
) => {
  const company = await getCompany(companyId);
  await SysPackageService.setCompanyForms(
    companyId,
    [{ formId, hasPermission }],
    hasPermission ? company?.package_code || undefined : undefined,
  );
};

export const setCompanyForms = async (
  companyId: string,
  rows: Array<{ formId: number; hasPermission: boolean }>,
) => {
  if (!companyId || !rows.length) return;
  const company = await getCompany(companyId);
  await SysPackageService.setCompanyForms(
    companyId,
    rows,
    company?.package_code || undefined,
  );
};

/** Áp toàn bộ form của gói vào công ty (dùng khi gán gói mới) */
export const applyPackageToCompany = async (companyId: string, packageCode: string) =>
  SysPackageService.applyPackageToCompany(companyId, packageCode);


/* ------------- Cấp 3: nhóm quyền và người dùng ------------- */

/** Bản ghi `id` của bảng còn thấy được không (phân biệt "đã xoá trước" với "RLS chặn" khi DELETE 0 dòng) */
const rowStillExists = (table: string, id: string) => async () => {
  const { data, error } = await t(table).select("id").eq("id", id).limit(1);
  if (error) return true;
  return Array.isArray(data) && data.length > 0;
};

export interface PermGroup {
  id?: string;
  company_id: string;
  per_name: string;
  description?: string | null;
  is_agent?: boolean;
  is_active?: boolean;
  is_full_access?: boolean;
}

export const listPermGroups = async (companyId: string): Promise<PermGroup[]> => {
  if (!companyId) return [];
  const { data, error } = await t("sys_perm_groups")
    .select("*")
    .eq("company_id", companyId)
    .order("per_name", { ascending: true });
  if (error) throw error;
  return (data || []) as any as PermGroup[];
};

export const savePermGroup = async (row: PermGroup): Promise<string> => {
  const payload = {
    company_id: row.company_id,
    per_name: row.per_name,
    description: row.description ?? null,
    is_agent: !!row.is_agent,
    is_active: row.is_active ?? true,
    is_full_access: !!row.is_full_access,
  };
  if (row.id) {
    // RLS lọc mất dòng ⇒ PostgREST 200 với 0 dòng: kiểm số dòng để không báo "thành công" giả (Task 7a)
    await assertRowsAffected(await t("sys_perm_groups").update(payload as any).eq("id", row.id).select("id"));
    return row.id;
  }
  // Không dùng upsert onConflict (company_id, per_name): ma trận phân quyền cho trùng tên khác nhóm cấp trên (PQ9) nên khoá đó
  // bị thay bằng (company_id, parent_id, per_name). Tìm theo tên trong công ty: có 1 ⇒ sửa, chưa có ⇒ thêm.
  // (Dùng cho tạo công ty mới — ghi nhóm cho công ty khác phiên nên không đi qua RPC fn_perm_group_save.)
  const { data: found, error: findError } = await t("sys_perm_groups")
    .select("id")
    .eq("company_id", row.company_id)
    .eq("per_name", row.per_name)
    .limit(2);
  if (findError) throw friendlyWriteError(findError);
  const hits = (found || []) as any[];
  if (hits.length > 1) throw new Error(`Có nhiều nhóm quyền tên "${row.per_name}" — sửa ở màn Phân quyền`);
  if (hits.length === 1) {
    const id = String(hits[0].id);
    await assertRowsAffected(await t("sys_perm_groups").update(payload as any).eq("id", id).select("id"));
    return id;
  }
  const { data, error } = await t("sys_perm_groups").insert(payload as any).select("id").maybeSingle();
  if (error) throw friendlyWriteError(error);
  return (data as any)?.id || "";
};

export const removePermGroup = async (groupUid: string) => {
  await assertRowsAffected(await t("sys_perm_groups").delete().eq("id", groupUid).select("id"), {
    stillExists: rowStillExists("sys_perm_groups", groupUid),
  });
};

/**
 * Quyền form của nhóm — khoá theo `form_uid` (uuid của sys_forms).
 * Bảng `sys_perm_group_forms` đã bỏ hẳn cột `form_id`.
 */
export const groupFormPermissions = async (
  groupUid: string,
): Promise<Map<string, { has: boolean; features: string[]; typeCode: DataScopeCode }>> => {
  const out = new Map<
    string,
    { has: boolean; features: string[]; typeCode: DataScopeCode }
  >();
  if (!groupUid) return out;
  const { data, error } = await t("sys_perm_group_forms")
    .select("form_uid, has_permission, features, type_code")
    .eq("group_uid", groupUid);
  if (error) throw error;
  for (const r of (data || []) as any[]) {
    out.set(String(r.form_uid), {
      has: !!r.has_permission,
      features: Array.isArray(r.features) ? r.features.map(String) : [],
      typeCode: String(r.type_code) === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY",
    });
  }
  return out;
};

/** Bản đồ tương thích cho code cũ: form_id → quyền của nhóm */
export const groupFormPermissionsByFormId = async (
  groupUid: string,
): Promise<Map<number, { has: boolean; features: string[] }>> => {
  const [byUid, { uidToId }] = await Promise.all([
    groupFormPermissions(groupUid),
    SysPackageService.formIdMaps(),
  ]);
  const out = new Map<number, { has: boolean; features: string[] }>();
  for (const [uid, v] of byUid) {
    const fid = uidToId.get(uid);
    if (Number.isFinite(fid as any)) out.set(Number(fid), v);
  }
  return out;
};

/** Quy đổi formId → formUid cho các lời gọi cũ */
const resolveFormUid = async (
  r: { formUid?: string | null; formId?: number | null },
): Promise<string | null> => {
  if (r.formUid) return String(r.formUid);
  if (r.formId == null) return null;
  const { idToUid } = await SysPackageService.formIdMaps();
  return idToUid.get(Number(r.formId)) || null;
};

/** Gán quyền form + tính năng cho nhóm — chặn form ngoài quyền công ty */
export const setGroupForm = async (
  groupUid: string,
  companyId: string,
  form: string | number,
  hasPermission: boolean,
  features: string[] = [],
  typeCode: DataScopeCode = "COMPANY",
) => {
  const formUid =
    typeof form === "string" && /^[0-9a-f-]{36}$/i.test(form)
      ? form
      : await resolveFormUid({ formId: Number(form) });
  if (!formUid) throw new Error("Không xác định được chức năng");
  if (hasPermission) {
    const allowed = new Set(await SysPackageService.companyFormUids(companyId));
    if (allowed.size && !allowed.has(formUid)) {
      throw new Error("Form chưa được phân quyền cho công ty");
    }
  }
  const { error } = await t("sys_perm_group_forms").upsert(
    {
      group_uid: groupUid,
      company_id: companyId,
      form_uid: formUid,
      has_permission: hasPermission,
      features,
      type_code: typeCode === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY",
    } as any,
    { onConflict: "group_uid,form_uid" },
  );
  if (error) throw error;
};

/** Ghi hàng loạt quyền form của nhóm (dùng cho nút "Tích tất cả") */
export const setGroupForms = async (
  groupUid: string,
  companyId: string,
  rows: Array<{
    formUid?: string;
    formId?: number;
    hasPermission: boolean;
    features?: string[];
    typeCode?: DataScopeCode;
  }>,
) => {
  if (!groupUid || !rows.length) return;
  const [{ idToUid }, allowedList] = await Promise.all([
    SysPackageService.formIdMaps(),
    SysPackageService.companyFormUids(companyId),
  ]);
  const allowed = new Set(allowedList);
  const payload: any[] = [];
  for (const r of rows) {
    const uid = r.formUid || (r.formId != null ? idToUid.get(Number(r.formId)) : null);
    if (!uid) continue;
    if (r.hasPermission && allowed.size && !allowed.has(uid)) continue;
    payload.push({
      group_uid: groupUid,
      company_id: companyId,
      form_uid: uid,
      has_permission: !!r.hasPermission,
      features: r.features ?? [],
      type_code: r.typeCode === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY",
    });
  }
  if (!payload.length) return;
  const { error } = await t("sys_perm_group_forms").upsert(payload as any, {
    onConflict: "group_uid,form_uid",
  });
  if (error) throw error;
};

export interface AllowedFormFeature {
  code: string;
  name: string;
  color: string;
}

export interface AllowedForm {
  formUid: string;
  formId: number;
  formName: string;
  formPath: string | null;
  moduleKey: string;
  moduleName: string;
  groupLabel: string;
  features: AllowedFormFeature[];
}

/**
 * Danh mục form ĐỂ HIỂN THỊ cho nhóm quyền của một công ty đăng ký.
 *
 *   sys_perm_groups.company_id (uuid cloud_companies)
 *      → sys_data_access.ma_ctdk (uuid cloud_companies)
 *      → sys_data_access.form_uid → sys_forms
 *
 * Danh sách này chỉ là danh mục để tích chọn (KHÔNG phải quyền đang bật).
 * Quyền đang bật đọc riêng ở `sys_perm_group_forms`.
 * Hành động lấy từ `sys_form_features` (theo form_uid), tên/màu từ `sys_features`.
 */
export const listAllowedForms = async (companyId: string): Promise<AllowedForm[]> => {
  if (!companyId) return [];
  const { listFeatures, formFeatureMapByUid } = await import(
    "./SysCatalogService"
  );

  const [accessRes, featByUid, features, modRes] = await Promise.all([
    t("sys_data_access")
      .select("form_uid")
      .eq("ma_ctdk", companyId),
    formFeatureMapByUid().catch(() => new Map<string, string[]>()),
    listFeatures().catch(() => [] as any[]),
    t("sys_modules").select("id, module_key, module_name, sort_order"),
  ]);

  if ((accessRes as any).error) throw (accessRes as any).error;

  const allowedFormUids = [
    ...new Set(
      (((accessRes as any).data || []) as any[])
        .map((r) => String(r.form_uid || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!allowedFormUids.length) return [];

  // Không dùng PostgREST embedded relation ở đây: schema self-host có thể chưa
  // khai báo FK sys_data_access.form_uid → sys_forms.id, khiến drawer lỗi fetch.
  const formsRes = await t("sys_forms")
    .select(
      "id, form_id:form_code, form_name, form_path, module_uid, module_key, group_label, is_active",
    );
  if ((formsRes as any).error) throw (formsRes as any).error;

  const featMeta = new Map(
    (features || []).map((f: any) => [
      String(f.feature_code).toUpperCase(),
      { name: f.feature_name || f.feature_code, color: f.color || "default" },
    ]),
  );
  const allFeatureCodes = (features || [])
    .filter((f: any) => f.is_active !== false)
    .map((f: any) => String(f.feature_code).toUpperCase());
  // Hành động hiển thị theo thứ tự danh mục (sys_features đã sắp theo sort_order), không theo thứ tự đọc sys_form_features
  const featRank = new Map((features || []).map((f: any, i: number) => [String(f.feature_code).toUpperCase(), i]));
  const byRank = (a: string, b: string) =>
    (featRank.get(a.toUpperCase()) ?? Number.MAX_SAFE_INTEGER) - (featRank.get(b.toUpperCase()) ?? Number.MAX_SAFE_INTEGER);
  const modules = new Map(
    (((modRes as any).data || []) as any[]).map((m) => [String(m.id), m]),
  );

  const allowedSet = new Set(allowedFormUids);
  const formRows = (((formsRes as any).data || []) as any[]).filter(
    (form) => form?.id && allowedSet.has(String(form.id)),
  );

  return formRows
    .filter((f: any) => f.is_active !== false)
    .map((f: any) => {
      const mod = f.module_uid ? modules.get(String(f.module_uid)) : null;
      const codes = featByUid.get(String(f.id)) || [];
      const list = [...(codes.length ? codes : allFeatureCodes)].sort(byRank);
      return {
        formUid: String(f.id),
        formId: Number(f.form_id),
        formName: f.form_name || f.form_path || `Chức năng ${f.form_id}`,
        formPath: f.form_path ?? null,
        moduleKey: mod?.module_key || f.module_key || "",
        moduleName: mod?.module_name || f.module_key || "KHÁC",
        groupLabel: mod?.module_name || f.group_label || f.module_key || "KHÁC",
        features: list.map((c) => {
          const code = String(c).toUpperCase();
          const meta = featMeta.get(code);
          return { code, name: meta?.name || code, color: meta?.color || "default" };
        }),
      };
    })
    .sort(
      (a, b) =>
        a.groupLabel.localeCompare(b.groupLabel, "vi") ||
        a.formName.localeCompare(b.formName, "vi"),
    );
};






export interface AssignUserInput {
  companyId: string;
  groupUid: string;
  employeeId: string;
}

export const ensureEmployee = async (input: {
  companyId: string;
  maNV: string;
  email?: string | null;
  fullName?: string | null;
}) => {
  const maNV = String(input.maNV || "").trim();
  if (!input.companyId || !maNV) throw new Error("Thiếu công ty hoặc mã nhân viên");
  const { data, error } = await t("dm_employees")
    .upsert(
      {
        ma_ctdk: input.companyId,
        ma_nv: maNV,
        ma_so: maNV,
        email: input.email || null,
        ho_ten: input.fullName || null,
        ap_dung: true,
        lock: false,
      } as any,
      { onConflict: "ma_ctdk,ma_nv" },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  const employeeId = String((data as any)?.id || "");
  if (!employeeId) throw new Error("Không lấy được UUID nhân viên");
  return employeeId;
};

export const assignUserToGroup = async (input: AssignUserInput) => {
  if (!input.companyId || !input.groupUid || !input.employeeId) {
    throw new Error("Thiếu công ty, nhóm quyền hoặc nhân viên");
  }
  const { error } = await t("perm_user_groups").upsert(
    {
      company_id: input.companyId,
      group_uid: input.groupUid,
      employee_id: input.employeeId,
    } as any,
    { onConflict: "company_id,employee_id" },
  );
  if (error) throw error;
  // Đăng nhập đọc dm_employees.perm_group_uid TRƯỚC bảng phụ ⇒ phải ghi cả hồ sơ nhân viên, nếu không chuyển nhóm không có tác dụng
  // (ma trận phân quyền PQ10; màn mới dùng RPC fn_perm_group_assign ghi cả 2 trong 1 giao dịch)
  await assertRowsAffected(
    await t("dm_employees").update({ perm_group_uid: input.groupUid } as any).eq("id", input.employeeId).select("id"),
  );
};

export const listGroupUsers = async (groupUid: string): Promise<any[]> => {
  if (!groupUid) return [];
  const { data, error } = await t("perm_user_groups")
    .select("id, company_id, group_uid, employee_id")
    .eq("group_uid", groupUid);
  if (error) throw error;
  const assignments = (data || []) as any[];
  const employeeIds = assignments.map((r) => r.employee_id).filter(Boolean);
  if (!employeeIds.length) return [];
  const { data: employees, error: employeeError } = await t("dm_employees")
    .select("id, ma_nv, ho_ten, email")
    .in("id", employeeIds);
  if (employeeError) throw employeeError;
  const employeeMap = new Map(
    ((employees || []) as any[]).map((employee) => [String(employee.id), employee]),
  );
  return assignments.map((assignment) => {
    const employee = employeeMap.get(String(assignment.employee_id));
    return {
      ...assignment,
      ma_nv: employee?.ma_nv ?? "",
      full_name: employee?.ho_ten ?? null,
      email: employee?.email ?? null,
    };
  });
};

export const removeUserFromGroup = async (id: string) => {
  const { data: link } = await t("perm_user_groups").select("employee_id, group_uid").eq("id", id).maybeSingle();
  await assertRowsAffected(await t("perm_user_groups").delete().eq("id", id).select("id"), {
    stillExists: rowStillExists("perm_user_groups", id),
  });
  // Gỡ cả hồ sơ nhân viên (nguồn đăng nhập) nếu đang trỏ đúng nhóm vừa gỡ (PQ10)
  const emp = (link as any)?.employee_id;
  const grp = (link as any)?.group_uid;
  if (emp && grp) {
    await t("dm_employees").update({ perm_group_uid: null } as any).eq("id", emp).eq("perm_group_uid", grp);
  }
};

/* ---------------- Quyền hiệu lực của phiên hiện tại ---------------- */

export interface EffectiveMatrix {
  companyId: string;
  groupUid: string;
  perId: number;
  forms: Set<number>;
  features: Map<number, Set<string>>;
  /** true = chưa cấu hình xong ⇒ không chặn */
  empty: boolean;
}

let cache: EffectiveMatrix | null = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

export const resetMatrixCache = () => {
  cache = null;
  cacheAt = 0;
};

const resolveGroupUid = async (companyId: string): Promise<{ uid: string; perId: number }> => {
  const perId = sessionPerId();
  // Nhóm quyền lấy từ token (claim per_id = uuid sys_perm_groups) nếu có
  const fromToken = sessionPermGroupUid();
  if (fromToken) return { uid: fromToken, perId };
  const code = String(sessionMaNV() || "").trim();
  if (code) {
    const { data: employee } = await t("dm_employees")
      .select("id, perm_group_uid")
      .eq("ma_ctdk", companyId)
      .eq("ma_nv", code)
      .limit(1)
      .maybeSingle();
    // Nguồn chuẩn: nhóm quyền lưu trực tiếp trên hồ sơ nhân viên
    if ((employee as any)?.perm_group_uid) {
      return { uid: String((employee as any).perm_group_uid), perId };
    }
    if ((employee as any)?.id) {
      const { data } = await t("perm_user_groups")
        .select("group_uid")
        .eq("company_id", companyId)
        .eq("employee_id", (employee as any).id)
        .limit(1)
        .maybeSingle();
      if ((data as any)?.group_uid) {
        return { uid: (data as any).group_uid, perId };
      }
    }
  }
  return { uid: "", perId };
};


export const getEffectiveMatrix = async (): Promise<EffectiveMatrix> => {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;

  const companyId = await currentCompanyId();
  const forms = new Set<number>();
  const features = new Map<number, Set<string>>();
  let groupUid = "";
  let perId = sessionPerId();

  if (companyId) {
    const company = await getCompany(companyId);
    const pkg = await packageFormIds(company?.package_code || "");
    const companyForms = await companyFormIds(companyId);
    const resolved = await resolveGroupUid(companyId);
    groupUid = resolved.uid;
    perId = resolved.perId;
    const groupForms = groupUid ? await groupFormPermissions(groupUid) : new Map();

    for (const [formId, v] of groupForms) {
      if (!v.has) continue;
      if (companyForms.size && !companyForms.has(formId)) continue;
      if (pkg.size && !pkg.has(formId)) continue;
      forms.add(formId);
      if (v.features.length) {
        features.set(formId, new Set(v.features.map((f) => f.toLowerCase())));
      }
    }
  }

  cache = {
    companyId,
    groupUid,
    perId,
    forms,
    features,
    empty: forms.size === 0,
  };
  cacheAt = now;
  return cache;
};

export const canFormMatrix = async (formId?: number | null) => {
  if (formId == null) return true;
  const m = await getEffectiveMatrix();
  if (m.empty) return true;
  return m.forms.has(Number(formId));
};

export const canActionMatrix = async (
  formId?: number | null,
  feature?: string | number | null,
) => {
  if (formId == null || feature == null) return true;
  const m = await getEffectiveMatrix();
  if (m.empty) return true;
  const set = m.features.get(Number(formId));
  if (!set || !set.size) return false;
  return set.has(String(feature).toLowerCase());
};

export const PermissionMatrixService = {
  listCompanies,
  getCompany,
  saveCompany,
  currentCompanyId,
  setCompanyPackage,
  companyFormIds,
  setCompanyForm,
  setCompanyForms,
  applyPackageToCompany,
  listPermGroups,
  savePermGroup,
  removePermGroup,
  groupFormPermissions,
  groupFormPermissionsByFormId,
  setGroupForm,
  setGroupForms,
  listAllowedForms,

  assignUserToGroup,
  ensureEmployee,
  listGroupUsers,
  removeUserFromGroup,
  getEffectiveMatrix,
  canFormMatrix,
  canActionMatrix,
  resetMatrixCache,
};

export default PermissionMatrixService;
