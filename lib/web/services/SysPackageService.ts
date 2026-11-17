// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SysPackageService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * PHÂN QUYỀN CHUẨN MỚI — chỉ dùng các bảng hệ thống `sys_*`:
 *
 *   sys_modules  (module lớn)
 *     └─ sys_form_groups (nhóm chức năng — cùng danh mục với ma trận phân quyền)
 *          └─ sys_forms (menu con)
 *
 *   Cấp 1 – Gói sản phẩm     : sys_packages + sys_package_forms (uuid ↔ uuid)
 *   Cấp 2 – Công ty đăng ký  : sys_data_access (ma_ctdk = cloud_companies.id)
 *   Cấp 3 – Nhóm quyền NV    : sys_perm_groups / sys_perm_group_forms / perm_user_groups
 *
 * Các bảng cũ (cloud_module_groups, cloud_module_group_forms) đã bị xoá,
 * TUYỆT ĐỐI không truy xuất nữa.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { assertRowsAffected, friendlyWriteError } from "../lib/restWriteGuard";
import { getFormGroupCatalog } from "./system/phan-quyen";
import {
  type FormGroupCatalogLike,
  type FormPlacement,
  byPlacement,
  createFormPlacer,
} from "./system/phan-quyen/formTree";

const t = (name: string) => supabase.from(name as any);

const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const isUuid = (v: any) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

/* ------------------------------- Kiểu dữ liệu ------------------------------- */

export interface SysPackage {
  id: string;
  packageCode: string;
  name: string;
  pricePerMonth: number | null;
  isActive: boolean;
}

export interface PackageFormNode extends FormPlacement {
  formUid: string;
  formId: number;
  formName: string;
  formPath: string | null;
  checked: boolean;
  /** Form có nằm trong gói sản phẩm của công ty hay không */
  inPackage?: boolean;
}

export interface PackageModuleNode {
  moduleUid: string | null;
  moduleKey: string;
  moduleId: number | null;
  moduleName: string;
  forms: PackageFormNode[];
}

const mapPackage = (r: any): SysPackage => ({
  id: r?.id,
  packageCode: String(r?.package_code ?? r?.id ?? ""),
  name: r?.package_name || String(r?.package_code ?? ""),
  pricePerMonth: r?.price_per_month ?? null,
  isActive: r?.is_active !== false,
});

/* ------------------------------ Gói sản phẩm ------------------------------- */

export const listPackages = async (): Promise<SysPackage[]> => {
  const { data, error } = await t("sys_packages")
    .select("id, package_code, package_name, price_per_month, is_active")
    .order("package_name", { ascending: true });
  if (error) throw error;
  return ((data || []) as any[]).map(mapPackage);
};

/** Tra gói theo uuid hoặc theo mã gói (package_code) */
export const getPackage = async (key: any): Promise<SysPackage | null> => {
  const k = String(key ?? "").trim();
  if (!k) return null;
  const q = t("sys_packages").select(
    "id, package_code, package_name, price_per_month, is_active",
  );
  const { data } = isUuid(k)
    ? await q.eq("id", k).maybeSingle()
    : await q.eq("package_code", k).maybeSingle();
  return data ? mapPackage(data) : null;
};

export const savePackage = async (row: {
  id?: string | null;
  packageCode?: string | null;
  name: string;
  pricePerMonth?: any;
  isActive?: boolean;
}): Promise<SysPackage> => {
  const name = String(row?.name ?? "").trim();
  if (!name) throw new Error("Vui lòng nhập tên gói sản phẩm");

  const payload: any = {
    package_name: name,
    price_per_month: num(row?.pricePerMonth) ?? 0,
    is_active: row?.isActive !== false,
  };

  if (row?.id) {
    const res = await t("sys_packages")
      .update(payload)
      .eq("id", row.id)
      .select("id, package_code, package_name, price_per_month, is_active");
    await assertRowsAffected(res);
    return mapPackage((res.data as unknown[])[0]);
  }

  payload.package_code =
    String(row?.packageCode ?? "").trim() ||
    `pkg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { data, error } = await t("sys_packages")
    .upsert(payload, { onConflict: "package_code" })
    .select("id, package_code, package_name, price_per_month, is_active")
    .maybeSingle();
  if (error) throw error;
  return mapPackage(data);
};

export const removePackage = async (key: any) => {
  const pkg = await getPackage(key);
  if (!pkg) return;
  const { error: formErr } = await t("sys_package_forms").delete().eq("package_uid", pkg.id);
  if (formErr) throw friendlyWriteError(formErr);
  await assertRowsAffected(await t("sys_packages").delete().eq("id", pkg.id).select("id"));
};

export const duplicatePackage = async (
  key: any,
  newName?: string,
): Promise<SysPackage> => {
  const src = await getPackage(key);
  if (!src) throw new Error("Không tìm thấy gói sản phẩm nguồn");
  const clone = await savePackage({
    name: (newName || `${src.name} (bản sao)`).trim(),
    pricePerMonth: src.pricePerMonth,
    isActive: src.isActive,
  });
  const { data } = await t("sys_package_forms")
    .select("form_uid")
    .eq("package_uid", src.id);
  const rows = ((data || []) as any[]).map((r) => ({
    package_uid: clone.id,
    form_uid: r.form_uid,
  }));
  if (rows.length) {
    await t("sys_package_forms").upsert(rows as any, {
      onConflict: "package_uid,form_uid",
    });
  }
  return clone;
};

/* -------------- Danh mục module → nhóm chức năng → form (3 cấp) ------------- */

const loadCatalog = async () => {
  const [modRes, formRes] = await Promise.all([
    t("sys_modules")
      .select("id, module_key, module_id, module_name, sort_order, is_active")
      .order("sort_order", { ascending: true }),
    t("sys_forms")
      .select("id, form_id:form_code, form_name, form_path, module_uid, module_key, group_label, is_active")
      .order("form_code", { ascending: true }),
  ]);
  const modules = (((modRes as any).data || []) as any[]).filter(
    (m) => m.is_active !== false,
  );
  const forms = (((formRes as any).data || []) as any[]).filter(
    (f) => f.is_active !== false,
  );
  return { modules, forms };
};

/** form_uid ↔ số form (form_code) để quy đổi giữa danh mục và menu cũ */
export const formIdMaps = async () => {
  const { data } = await t("sys_forms").select("id, form_id:form_code");
  const uidToId = new Map<string, number>();
  const idToUid = new Map<number, string>();
  for (const f of (data || []) as any[]) {
    const fid = Number(f.form_id);
    if (!f?.id || !Number.isFinite(fid)) continue;
    uidToId.set(String(f.id), fid);
    idToUid.set(fid, String(f.id));
  }
  return { uidToId, idToUid };
};

/**
 * Vị trí form trong Module › Nhóm chức năng lấy từ danh mục của ma trận (fn_form_group_list, cần quyền xem form 62).
 * Không đọc được ⇒ null: cây vẫn chia 3 cấp theo sys_forms.group_label, thao tác tích không bị ảnh hưởng.
 */
const loadFormGroupCatalog = async (): Promise<FormGroupCatalogLike | null> => {
  try {
    return await getFormGroupCatalog();
  } catch (e) {
    console.warn("[SysPackageService] Không đọc được danh mục nhóm chức năng, dùng group_label", e);
    return null;
  }
};

/** Cây module → nhóm chức năng → form (form xếp sẵn theo nhóm) kèm trạng thái tích của gói */
export const loadPackageTree = async (
  packageKey: any,
): Promise<PackageModuleNode[]> => {
  const pkg = await getPackage(packageKey);
  const [{ modules, forms }, permRes, groupCatalog] = await Promise.all([
    loadCatalog(),
    pkg
      ? t("sys_package_forms").select("form_uid").eq("package_uid", pkg.id)
      : Promise.resolve({ data: [] as any[] }),
    loadFormGroupCatalog(),
  ]);
  const placeOf = createFormPlacer(groupCatalog);
  const checked = new Set<string>(
    (((permRes as any).data || []) as any[]).map((r) => String(r.form_uid)),
  );

  const byUid = new Map<string, PackageModuleNode>();
  const byKey = new Map<string, PackageModuleNode>();
  const nodes: PackageModuleNode[] = modules.map((m: any) => {
    const node: PackageModuleNode = {
      moduleUid: m.id,
      moduleKey: m.module_key,
      moduleId: m.module_id ?? null,
      moduleName: m.module_name || m.module_key,
      forms: [],
    };
    byUid.set(String(m.id), node);
    byKey.set(String(m.module_key), node);
    return node;
  });

  const other: PackageModuleNode = {
    moduleUid: null,
    moduleKey: "other",
    moduleId: null,
    moduleName: "Khác",
    forms: [],
  };

  for (const f of forms) {
    const node =
      (f.module_uid && byUid.get(String(f.module_uid))) ||
      (f.module_key && byKey.get(String(f.module_key))) ||
      other;
    node.forms.push({
      formUid: String(f.id),
      formId: Number(f.form_id),
      formName: f.form_name || f.form_path || `Form ${f.form_id}`,
      formPath: f.form_path ?? null,
      checked: checked.has(String(f.id)),
      ...placeOf(String(f.id), f.group_label),
    });
  }

  const out = nodes.filter((n) => n.forms.length);
  if (other.forms.length) out.push(other);
  out.forEach((n) => n.forms.sort(byPlacement));
  return out;
};

/* --------------------- Cấp 1: form thuộc gói sản phẩm --------------------- */

export const setPackageForms = async (
  packageKey: any,
  formUids: string[],
  checked: boolean,
) => {
  const pkg = await getPackage(packageKey);
  if (!pkg) throw new Error("Chưa xác định được gói sản phẩm");
  const uids = formUids.filter(Boolean);
  if (!uids.length) return;

  if (!checked) {
    await assertRowsAffected(
      await t("sys_package_forms").delete().eq("package_uid", pkg.id).in("form_uid", uids).select("form_uid"),
      {
        expected: uids.length,
        stillExists: async () => {
          const { data, error } = await t("sys_package_forms")
            .select("form_uid")
            .eq("package_uid", pkg.id)
            .in("form_uid", uids)
            .limit(1);
          return !!error || (Array.isArray(data) && data.length > 0);
        },
      },
    );
    return;
  }
  const { error } = await t("sys_package_forms").upsert(
    uids.map((form_uid) => ({ package_uid: pkg.id, form_uid })) as any,
    { onConflict: "package_uid,form_uid" },
  );
  if (error) throw error;
};

export const packageFormUids = async (packageKey: any): Promise<string[]> => {
  const pkg = await getPackage(packageKey);
  if (!pkg) return [];
  const { data, error } = await t("sys_package_forms")
    .select("form_uid")
    .eq("package_uid", pkg.id);
  if (error) throw error;
  return ((data || []) as any[]).map((r) => String(r.form_uid));
};

/** form_id (menu cũ) được mở trong gói */
export const packageFormIds = async (packageKey: any): Promise<Set<number>> => {
  const uids = await packageFormUids(packageKey);
  if (!uids.length) return new Set();
  const { uidToId } = await formIdMaps();
  return new Set(
    uids.map((u) => uidToId.get(u)).filter((n): n is number => Number.isFinite(n as any)),
  );
};

/** Chi tiết form của gói (kèm tên/module) để dựng menu */
export const packageForms = async (
  packageKey: any,
): Promise<Array<{ formUid: string; formId: number; formName: string | null; moduleIdLevel1: number | null }>> => {
  const uids = await packageFormUids(packageKey);
  if (!uids.length) return [];
  const { data } = await t("sys_forms")
    .select("id, form_id:form_code, form_name, module_id_level1")
    .in("id", uids);
  return ((data || []) as any[]).map((f) => ({
    formUid: String(f.id),
    formId: Number(f.form_id),
    formName: f.form_name ?? null,
    moduleIdLevel1: f.module_id_level1 ?? null,
  }));
};

/* ----------------- Cấp 2: quyền dữ liệu của công ty đăng ký ---------------- */

/** Áp gói sản phẩm vào công ty đăng ký ⇒ ghi sys_data_access */
export const applyPackageToCompany = async (
  companyId: string,
  packageKey: any,
): Promise<number> => {
  if (!companyId) return 0;
  const pkg = await getPackage(packageKey);
  const uids = pkg ? await packageFormUids(pkg.id) : [];

  const { error: delErr } = await t("sys_data_access").delete().eq("ma_ctdk", companyId);
  if (delErr) throw friendlyWriteError(delErr);
  // Gán gói cho công ty: RLS lọc ⇒ 0 dòng ⇒ không có quyền (không báo "đã áp gói" giả)
  await assertRowsAffected(
    await t("cloud_companies")
      .update({
        package_code: pkg?.packageCode ?? null,
        package_uid: pkg?.id ?? null,
      } as any)
      .eq("id", companyId)
      .select("id"),
  );

  if (!uids.length) return 0;
  const { error } = await t("sys_data_access").upsert(
    uids.map((form_uid) => ({
      ma_ctdk: companyId,
      package_uid: pkg?.id ?? null,
      form_uid,
    })) as any,
    { onConflict: "ma_ctdk,form_uid" },
  );
  if (error) throw friendlyWriteError(error);
  return uids.length;
};

export const companyFormUids = async (companyId: string): Promise<string[]> => {
  if (!companyId) return [];
  const { data, error } = await t("sys_data_access")
    .select("form_uid")
    .eq("ma_ctdk", companyId);
  if (error) throw error;
  return ((data || []) as any[]).map((r) => String(r.form_uid));
};

/**
 * Cây quyền của CÔNG TY ĐĂNG KÝ (giữ thứ tự 3 cấp của gói): chỉ gồm các form nằm trong gói đã bán,
 * `checked` = form đang có trong sys_data_access của công ty.
 */
export const loadCompanyTree = async (
  companyId: string,
  packageKey: any,
  includeOutsidePackage = false,
): Promise<PackageModuleNode[]> => {
  const [tree, granted] = await Promise.all([
    loadPackageTree(packageKey),
    companyFormUids(companyId),
  ]);
  const has = new Set(granted);
  return tree
    .map((m) => ({
      ...m,
      forms: m.forms
        .filter((f) => includeOutsidePackage || f.checked)
        .map((f) => ({
          ...f,
          inPackage: f.checked,
          checked: has.has(f.formUid),
        })),
    }))
    .filter((m) => m.forms.length);
};



export const companyFormIds = async (companyId: string): Promise<Set<number>> => {
  const uids = await companyFormUids(companyId);
  if (!uids.length) return new Set();
  const { uidToId } = await formIdMaps();
  return new Set(
    uids.map((u) => uidToId.get(u)).filter((n): n is number => Number.isFinite(n as any)),
  );
};

/** Bật/tắt form cho công ty (chỉ trong phạm vi gói đã bán) */
export const setCompanyForms = async (
  companyId: string,
  rows: Array<{ formId?: number; formUid?: string; hasPermission: boolean }>,
  packageKey?: any,
) => {
  if (!companyId || !rows.length) return;
  const { idToUid } = await formIdMaps();
  const pkg = packageKey ? await getPackage(packageKey) : null;
  const allowed = pkg ? new Set(await packageFormUids(pkg.id)) : null;
  // Cho phép mở thêm menu NGOÀI gói sản phẩm cho từng công ty đăng ký

  const resolve = (r: { formId?: number; formUid?: string }) =>
    r.formUid || (r.formId != null ? idToUid.get(Number(r.formId)) : undefined);

  const add: string[] = [];
  const remove: string[] = [];
  for (const r of rows) {
    const uid = resolve(r);
    if (!uid) continue;
    if (r.hasPermission) add.push(uid);
    else remove.push(uid);
  }

  if (remove.length) {
    // RLS lọc ⇒ 0 dòng, PostgREST vẫn 200: xoá thiếu mà form vẫn còn ⇒ không có quyền (Task 7a; trước đây lỗi bị nuốt)
    await assertRowsAffected(
      await t("sys_data_access").delete().eq("ma_ctdk", companyId).in("form_uid", remove).select("form_uid"),
      {
        expected: remove.length,
        stillExists: async () => {
          const { data, error } = await t("sys_data_access")
            .select("form_uid")
            .eq("ma_ctdk", companyId)
            .in("form_uid", remove)
            .limit(1);
          return !!error || (Array.isArray(data) && data.length > 0);
        },
      },
    );
  }
  if (add.length) {
    const { error } = await t("sys_data_access").upsert(
      add.map((form_uid) => ({
        ma_ctdk: companyId,
        package_uid:
          allowed && allowed.size && !allowed.has(form_uid) ? null : pkg?.id ?? null,
        form_uid,
      })) as any,
      { onConflict: "ma_ctdk,form_uid" },
    );
    if (error) throw friendlyWriteError(error);
  }
};

export const SysPackageService = {
  listPackages,
  getPackage,
  savePackage,
  removePackage,
  duplicatePackage,
  loadPackageTree,
  setPackageForms,
  packageFormUids,
  packageFormIds,
  packageForms,
  formIdMaps,
  applyPackageToCompany,
  companyFormUids,
  companyFormIds,
  loadCompanyTree,
  setCompanyForms,

};

export default SysPackageService;
