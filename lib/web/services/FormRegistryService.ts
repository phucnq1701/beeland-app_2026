// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/FormRegistryService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Quản lý TẬP TRUNG FormID + tính năng gán theo module.
 * Nguồn gốc: src/config/modules.ts (menu thật của app) → đồng bộ lên bảng
 * DÙNG CHUNG toàn hệ thống `sys_forms` (không thuộc công ty nào) để admin
 * chỉnh tính năng. Số form trong code = `sys_forms.form_code` (cố định, không sửa);
 * `sys_forms.form_id` là số tự sinh riêng của từng DB, không dùng để đối chiếu.
 *
 * Khi thêm module hoặc form mới trong modules.ts, hàm syncFromModules()
 * sẽ tự động thêm bản ghi mới với bộ tính năng gợi ý.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { modules } from "../_stubs/config/modules";
import { suggestFeatures } from "../_stubs/config/featureCatalog";

const TABLE = "sys_forms";

/** Tên module lấy từ code (modules.ts) — sys_forms chỉ lưu module_key */
const moduleNames = (): Map<string, string> =>
  new Map(modules.map((m) => [m.id, m.name]));

/** sys_forms dùng module_key, giao diện cũ dùng module_id (chuỗi) */
const fromCloud = (r: any): FormRegistryRow => {
  const key = r.module_key ?? r.module_id ?? "";
  return {
    ...r,
    form_id: r.form_code,
    module_id: key,
    module_name: moduleNames().get(key) ?? key,
    features: Array.isArray(r.features) ? r.features : [],
  };
};

/** Chuyển patch từ giao diện cũ sang cột của sys_forms */
const toCloud = (patch: Record<string, any>) => {
  const { module_id, module_name, ma_ctdk, form_id, ...rest } = patch; // form_id: số form không đổi sau khi tạo
  return module_id != null ? { ...rest, module_key: module_id } : rest;
};



export interface FormRegistryRow {
  id?: string;
  ma_ctdk?: string;
  module_id: string;
  module_name?: string | null;
  form_id?: number | null;
  form_path: string;
  form_name?: string | null;
  group_label?: string | null;
  features: string[];
  is_active?: boolean;
  source?: string;
  note?: string | null;
  updated_at?: string;
}

export interface CodeFormItem {
  module_id: string;
  module_name: string;
  group_label: string;
  form_path: string;
  form_name: string;
  form_id: number | null;
}

/** Toàn bộ form khai báo trong code (modules.ts) */
export function listFormsFromCode(): CodeFormItem[] {
  const out: CodeFormItem[] = [];
  for (const mod of modules) {
    for (const group of mod.menuGroups || []) {
      for (const item of group.items || []) {
        out.push({
          module_id: mod.id,
          module_name: mod.name,
          group_label: group.label,
          form_path: item.path,
          form_name: item.title,
          form_id: item.formId ?? null,
        });
      }
    }
  }
  return out;
}

export interface RegistryAudit {
  totalCode: number;
  totalCloud: number;
  missingFormId: CodeFormItem[];
  /** Có số form trong code nhưng DB này chưa có dòng form tương ứng */
  missingInDb: CodeFormItem[];
  duplicatedFormId: { formId: number; paths: string[] }[];
  orphanRows: FormRegistryRow[];
  noFeature: FormRegistryRow[];
}

export const FormRegistryService = {
  async list(): Promise<FormRegistryRow[]> {
    const { data, error } = await supabase
      .from(TABLE as any)
      .select("*")
      .order("module_key", { ascending: true })
      .order("form_path", { ascending: true });
    if (error) throw error;
    return ((data || []) as any[]).map(fromCloud);
  },

  /**
   * Đồng bộ danh mục từ code lên bảng dùng chung sys_forms:
   * - Form mới trong code → thêm mới (tự gợi ý tính năng)
   * - Form đã có → chỉ cập nhật thông tin mô tả (module, tên, nhóm), giữ nguyên
   *   FormID và tính năng do admin đã chỉnh
   */
  async syncFromModules(this: typeof FormRegistryService): Promise<{ added: number; updated: number }> {
    const codeForms = listFormsFromCode();
    const existing: FormRegistryRow[] = await this.list();
    const byPath = new Map<string, FormRegistryRow>(
      existing.map((r) => [r.form_path, r] as [string, FormRegistryRow])
    );

    const toInsert: any[] = [];

    // Mục đi chung quyền với form khác (PQ22) không có dòng riêng: thêm vào sẽ thành dòng ma trận không điều khiển được gì
    const usedFormIds = new Set(existing.map((r) => r.form_id).filter((id) => id != null));

    for (const f of codeForms) {
      const cur = byPath.get(f.form_path);
      if (!cur) {
        if (f.form_id == null) continue; // chưa khai số form thì chưa có form_code để thêm
        if (f.form_id !== 999 && usedFormIds.has(f.form_id)) continue;
        toInsert.push({
          module_key: f.module_id,
          group_label: f.group_label,
          form_path: f.form_path,
          form_name: f.form_name,
          form_code: f.form_id,
          features: suggestFeatures(f.form_path),
          source: "auto",
        });
      }
      // Form đã có: module, nhóm (FI-M1) và tên (FI-M2) do tab Form ID quản lý — không ghi đè theo code
    }

    if (toInsert.length) {
      const { error } = await supabase.from(TABLE as any).insert(toInsert as any);
      if (error) throw error;
    }
    return { added: toInsert.length, updated: 0 };
  },

  async update(id: string, patch: Partial<FormRegistryRow>) {
    const { error } = await supabase
      .from(TABLE as any)
      .update(toCloud(patch as any) as any)
      .eq("id", id);
    if (error) throw error;
  },

  async remove(id: string) {
    const { error } = await supabase.from(TABLE as any).delete().eq("id", id);
    if (error) throw error;
  },

  /** Rà soát chênh lệch giữa code và Cloud */
  audit(rows: FormRegistryRow[]): RegistryAudit {
    const codeForms = listFormsFromCode();
    const codePaths = new Set(codeForms.map((f) => f.form_path));

    const missingFormId = codeForms.filter((f) => !f.form_id);
    const dbCodes = new Set(rows.map((r) => r.form_id));
    const missingInDb = codeForms.filter((f) => f.form_id && f.form_id !== 999 && !dbCodes.has(f.form_id));

    const byFormId = new Map<number, string[]>();
    for (const f of codeForms) {
      if (!f.form_id || f.form_id === 999) continue;
      byFormId.set(f.form_id, [...(byFormId.get(f.form_id) || []), f.form_path]);
    }
    const duplicatedFormId = [...byFormId.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([formId, paths]) => ({ formId, paths }));

    return {
      totalCode: codeForms.length,
      totalCloud: rows.length,
      missingFormId,
      missingInDb,
      duplicatedFormId,
      orphanRows: rows.filter((r) => !codePaths.has(r.form_path)),
      noFeature: rows.filter((r) => !r.features?.length),
    };
  },
};

export default FormRegistryService;
