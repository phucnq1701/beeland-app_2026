// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SysCatalogService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * DANH MỤC PHÂN QUYỀN CHUẨN (4 bảng liên kết rõ ràng):
 *
 *   sys_modules       : module cấp 1                      (module_key, module_id)
 *   sys_forms         : form, gắn module_uid → sys_modules(id)
 *   sys_features      : danh mục tính năng dùng chung     (feature_code)
 *   sys_form_features : form ↔ tính năng được sử dụng     (form_uid, form_id, feature_code)
 *
 * Bảng quyền truy cập form dùng lại:
 *   sys_data_access (cấp công ty) và sys_perm_group_forms (cấp nhóm quyền),
 *   cả hai đều tham chiếu form qua form_id + form_uid.
 *
 * Nguồn danh mục module/form vẫn là code fix cứng (src/config/modules.ts) —
 * hàm syncFromCode() đẩy toàn bộ lên 4 bảng trên.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { modules } from "../_stubs/config/modules";
import { suggestFeatures } from "../_stubs/config/featureCatalog";
import { listFormsFromCode } from "./FormRegistryService";

const t = (name: string) => supabase.from(name as any);

/** PostgREST self-host trả tối đa 1000 dòng/lần (PGRST_DB_MAX_ROWS) — sys_form_features đã > 1000 dòng nên đọc theo trang */
const PAGE = 1000;
type FormFeatureRow = Record<string, unknown>;
const selectAllFormFeatures = async (columns: string): Promise<FormFeatureRow[]> => {
  const all: FormFeatureRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await t("sys_form_features")
      .select(columns)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...((data || []) as unknown as FormFeatureRow[]));
    if (!data || data.length < PAGE) return all;
  }
};

export interface SysModuleRow {
  id: string;
  module_key: string;
  module_id: number | null;
  module_name: string;
  sort_order: number | null;
  is_active: boolean;
}

export interface SysFormRow {
  id: string;
  form_id: number;
  form_path: string | null;
  form_name: string | null;
  module_uid: string | null;
  module_key: string | null;
  group_label: string | null;
  is_active: boolean;
}

export interface SysFeatureRow {
  id?: string;
  feature_code: string;
  feature_name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

/* ----------------------------- Đọc danh mục ----------------------------- */

export const listModules = async (): Promise<SysModuleRow[]> => {
  const { data, error } = await t("sys_modules")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("module_name", { ascending: true });
  if (error) throw error;
  return (data || []) as any as SysModuleRow[];
};

export const listForms = async (): Promise<SysFormRow[]> => {
  const { data, error } = await t("sys_forms")
    .select("id, form_id:form_code, form_path, form_name, module_uid, module_key, group_label, is_active")
    .order("module_key", { ascending: true })
    .order("form_code", { ascending: true });
  if (error) throw error;
  return (data || []) as any as SysFormRow[];
};

export const listFeatures = async (): Promise<SysFeatureRow[]> => {
  const { data, error } = await t("sys_features")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as any as SysFeatureRow[];
};

/** Map form_id → danh sách feature_code được phép dùng trên form đó */
export const formFeatureMap = async (): Promise<Map<number, string[]>> => {
  const data = await selectAllFormFeatures("form_id, feature_code, is_active");
  const out = new Map<number, string[]>();
  for (const r of data) {
    if (r.is_active === false) continue;
    const key = Number(r.form_id);
    out.set(key, [...(out.get(key) || []), String(r.feature_code)]);
  }
  return out;
};

/** Map form_uid → danh sách feature_code (khoá uuid, chuẩn mới) */
export const formFeatureMapByUid = async (): Promise<Map<string, string[]>> => {
  const data = await selectAllFormFeatures("form_uid, feature_code, is_active");
  const out = new Map<string, string[]>();
  for (const r of data) {
    if (r.is_active === false || !r.form_uid) continue;
    const key = String(r.form_uid);
    const code = String(r.feature_code).toUpperCase();
    const cur = out.get(key) || [];
    if (!cur.includes(code)) out.set(key, [...cur, code]);
  }
  return out;
};

/* ------------------ Đồng bộ từ danh mục fix cứng trong code ------------------ */

export interface SyncResult {
  modules: number;
  forms: number;
  features: number;
  formFeatures: number;
}

export const syncFromCode = async (): Promise<SyncResult> => {
  // 2) Module
  // Chỉ thêm Module chưa có: tên và trạng thái ẩn do tab Form ID quản lý
  const existingModules = new Set((await listModules()).map((m) => m.module_key));
  const newModules = modules
    .map((m, i) => ({ module_key: m.id, module_name: m.name, sort_order: i + 1, is_active: true }))
    .filter((m) => !existingModules.has(m.module_key));
  if (newModules.length) {
    const { error: eMod } = await t("sys_modules").insert(newModules as any);
    if (eMod) throw eMod;
  }
  const moduleUid = new Map((await listModules()).map((m) => [m.module_key, m.id]));

  // 3) Form (gắn module_uid)
  const codeForms = listFormsFromCode().filter((f) => Number.isFinite(Number(f.form_id)));
  const seen = new Set<number>();
  const formRows = codeForms
    .filter((f) => {
      const id = Number(f.form_id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((f) => ({
      form_code: Number(f.form_id), // form_id của sys_forms do DB tự sinh
      form_path: f.form_path,
      form_name: f.form_name,
      module_key: f.module_id,
      module_uid: moduleUid.get(f.module_id) ?? null,
      group_label: f.group_label,
      is_active: true,
      source: "code",
    }));
  // Form đã có: module + nhóm (FI-M1) và tên (FI-M2) do tab Form ID quản lý ⇒ chỉ cập nhật đường dẫn
  const existingCodes = new Set((await listForms()).map((f) => Number(f.form_id)));
  const newRows = formRows.filter((r) => !existingCodes.has(r.form_code));
  const oldRows = formRows
    .filter((r) => existingCodes.has(r.form_code))
    .map(({ module_key: _k, module_uid: _u, group_label: _g, form_name: _n, ...rest }) => rest);
  for (const rows of [newRows, oldRows]) {
    if (!rows.length) continue;
    const { error } = await t("sys_forms").upsert(rows as any, { onConflict: "form_code" });
    if (error) throw error;
  }
  const formUid = new Map((await listForms()).map((f) => [Number(f.form_id), f.id]));

  // 4) Form ↔ tính năng: chỉ khai báo mặc định cho form chưa có khai báo. Sau đó tab Form ID là nơi duy nhất sửa.
  const declared = await formFeatureMap();
  const pairs: any[] = [];
  const done = new Set<number>();
  for (const f of codeForms) {
    const id = Number(f.form_id);
    if (!id || declared.has(id) || done.has(id)) continue;
    done.add(id);
    for (const code of suggestFeatures(f.form_path)) {
      pairs.push({
        form_id: id,
        form_uid: formUid.get(id) ?? null,
        feature_code: code,
        is_active: true,
      });
    }
  }
  if (pairs.length) {
    const { error } = await t("sys_form_features").upsert(pairs as any, {
      onConflict: "form_id,feature_code",
    });
    if (error) throw error;
  }

  return {
    modules: modules.length,
    forms: formRows.length,
    features: 0,
    formFeatures: pairs.length,
  };
};

export const SysCatalogService = {
  listModules,
  listForms,
  listFeatures,
  formFeatureMap,
  formFeatureMapByUid,
  syncFromCode,
};

export default SysCatalogService;
