// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/phan-quyen/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import type {
  CatalogModule,
  CellInput,
  FeatureDef,
  FormGroupCatalog,
  GroupMember,
  MatrixCell,
  MatrixData,
  MatrixMe,
  MatrixModule,
  PermGroup,
  PermGroupInput,
} from "./types";

/**
 * Ma trận phân quyền (Hệ thống › Phân quyền, form 62) — gọi RPC máy chủ (database/sp/20_he_thong/phan_quyen ở BE).
 * Công ty lấy từ JWT; quyền, cây nhóm, chống leo quyền đều kiểm ở máy chủ. Lưu vẫn ở sys_perm_group_forms /
 * dm_employees.perm_group_uid / perm_user_groups ⇒ đăng nhập + app admin không đổi.
 */

export * from "./types";
export * from "./matrix";

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : []);
/** uuid chữ thường (SQL Server trả chữ hoa) */
const id = (v: unknown) => (v == null || v === "" ? null : String(v).toLowerCase());
const uid = (v: unknown) => id(v) ?? "";
const str = (v: unknown) => (v == null ? null : String(v));
const bool = (v: unknown) => v === true || v === 1 || v === "true";
const num = (v: unknown, d = 0) => (v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const codes = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).toUpperCase()) : []);

export const toGroup = (v: unknown): PermGroup => {
  const r = obj(v);
  return {
    id: uid(r.id),
    per_name: String(r.per_name ?? ""),
    description: str(r.description),
    parent_id: id(r.parent_id),
    sort_order: num(r.sort_order),
    is_agent: bool(r.is_agent),
    is_full_access: bool(r.is_full_access),
    is_active: r.is_active == null ? true : bool(r.is_active),
    path: String(r.path ?? r.per_name ?? ""),
    depth: num(r.depth, 1),
    is_leaf: r.is_leaf == null ? true : bool(r.is_leaf),
    n_children: num(r.n_children),
    n_employees: num(r.n_employees),
    n_forms: num(r.n_forms),
  };
};

const toModules = (v: unknown): MatrixModule[] =>
  arr(v).map((m) => ({
    id: uid(m.id),
    module_key: String(m.module_key ?? ""),
    module_name: String(m.module_name ?? m.module_key ?? ""),
    sort_order: num(m.sort_order),
    icon: str(m.icon),
    groups: arr(m.groups).map((g) => ({
      id: uid(g.id),
      group_name: String(g.group_name ?? ""),
      sort_order: num(g.sort_order),
      forms: arr(g.forms).map((f) => ({
        form_uid: uid(f.form_uid),
        form_id: num(f.form_id),
        form_name: String(f.form_name ?? f.form_path ?? ""),
        form_path: str(f.form_path),
        sort_order: num(f.sort_order),
        features: codes(f.features),
        n_features: num(f.n_features),
      })),
    })),
  }));

const toCell = (c: Raw): MatrixCell => ({
  group_uid: uid(c.group_uid),
  form_uid: uid(c.form_uid),
  has_permission: bool(c.has_permission),
  features: codes(c.features),
  type_code: c.type_code === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY",
});

const toMe = (v: unknown): MatrixMe => {
  const m = obj(v);
  return {
    can_edit: bool(m.can_edit),
    can_add: bool(m.can_add),
    can_delete: bool(m.can_delete),
    privileged: bool(m.privileged),
    is_super: bool(m.is_super),
    my_groups: (Array.isArray(m.my_groups) ? m.my_groups : []).map((g) => uid(obj(g).id ?? g)),
  };
};

/** Máy chủ chưa có RPC ma trận (BE / API chưa deploy) ⇒ màn giữ giao diện cũ */
export const isMatrixUnavailable = (e: unknown): boolean => {
  const err = obj(e);
  return err.code === "PGRST202" || /could not find (the function|stored procedure)/i.test(String(err.message ?? ""));
};

// ---------------------------------------------------------------- nhóm quyền
/** Cây nhóm quyền của công ty + quyền của người đang thao tác (máy chủ tính) */
export async function listGroupTree(): Promise<{ groups: PermGroup[]; me: MatrixMe }> {
  const r = obj(await rpcRaw<unknown>("fn_perm_group_tree", {}, { fallback: "Không tải được nhóm quyền" }));
  return { groups: arr(r.groups).map(toGroup), me: toMe(r.me) };
}

export async function saveGroup(input: PermGroupInput): Promise<PermGroup> {
  return toGroup(await rpcRaw<unknown>("fn_perm_group_save", { p_payload: input }, { fallback: "Không lưu được nhóm quyền" }));
}

export async function reorderGroups(items: Array<{ id: string; parent_id: string | null; sort_order: number }>) {
  await rpcRaw("fn_perm_group_reorder", { p_items: items }, { fallback: "Không sắp xếp được nhóm quyền" });
}

export async function deleteGroup(groupId: string) {
  await rpcRaw("fn_perm_group_delete", { p_id: groupId }, { fallback: "Không xoá được nhóm quyền" });
}

// ---------------------------------------------------------------- ma trận
export async function getMatrix(): Promise<MatrixData> {
  const r = obj(await rpcRaw<unknown>("fn_perm_matrix_get", {}, { fallback: "Không tải được ma trận phân quyền" }));
  const features: FeatureDef[] = arr(r.features).map((f) => ({
    code: String(f.code ?? "").toUpperCase(),
    name: String(f.name ?? f.code ?? ""),
    color: str(f.color),
    sort_order: num(f.sort_order),
  }));
  return {
    features,
    modules: toModules(r.modules),
    groups: arr(r.groups).map(toGroup),
    cells: arr(r.cells).map(toCell),
    me: toMe(r.me),
  };
}

/** Lưu nhiều ô 1 lần (máy chủ kiểm nhóm cuối, form công ty được cấp, thao tác của form, chống leo quyền) */
export async function setCells(items: CellInput[]): Promise<MatrixCell[]> {
  if (!items.length) return [];
  const r = obj(await rpcRaw<unknown>("fn_perm_matrix_set", { p_items: items }, { fallback: "Không lưu được phân quyền" }));
  return arr(r.cells).map(toCell);
}

// ---------------------------------------------------------------- nhân viên ↔ nhóm
export async function listMembers(): Promise<GroupMember[]> {
  const r = obj(await rpcRaw<unknown>("fn_perm_group_members", {}, { fallback: "Không tải được nhân viên" }));
  return arr(r.employees).map((e) => ({
    id: uid(e.id),
    ma_nv: str(e.ma_nv),
    ho_ten: str(e.ho_ten),
    email: str(e.email),
    ten_pb: str(e.ten_pb),
    ten_cv: str(e.ten_cv),
    lock: bool(e.lock),
    ap_dung: e.ap_dung == null ? true : bool(e.ap_dung),
    group_uid: id(e.group_uid),
  }));
}

/** Gán / chuyển nhân viên vào nhóm cuối — ghi cả hồ sơ nhân viên và bảng phụ (PQ10) */
export async function assignMembers(groupUid: string, employeeIds: string[]) {
  await rpcRaw("fn_perm_group_assign", { p_group_uid: groupUid, p_employee_ids: employeeIds }, { fallback: "Không gán được nhân viên" });
}

export async function unassignMembers(employeeIds: string[]) {
  await rpcRaw("fn_perm_group_unassign", { p_employee_ids: employeeIds }, { fallback: "Không bỏ được nhân viên khỏi nhóm" });
}

// ---------------------------------------------------------------- danh mục nhóm chức năng (tài khoản tổng)
export async function getFormGroupCatalog(): Promise<FormGroupCatalog> {
  const r = obj(await rpcRaw<unknown>("fn_form_group_list", {}, { fallback: "Không tải được danh mục nhóm chức năng" }));
  const modules: CatalogModule[] = toModules(r.modules).map((m) => ({
    ...m,
    groups: m.groups.map((g) => ({
      ...g,
      forms: g.forms.map((f) => ({ form_uid: f.form_uid, form_id: f.form_id, form_name: f.form_name, form_path: f.form_path, sort_order: f.sort_order, n_features: f.n_features })),
    })),
  }));
  return { modules, can_edit: bool(r.can_edit) };
}

export async function saveFormGroup(input: { id?: string; module_uid?: string; group_name: string; sort_order?: number }) {
  await rpcRaw("fn_form_group_save", { p_payload: input }, { fallback: "Không lưu được nhóm chức năng" });
}

export async function deleteFormGroup(groupId: string) {
  await rpcRaw("fn_form_group_delete", { p_id: groupId }, { fallback: "Không xoá được nhóm chức năng" });
}

/** FI-M2: sửa tên chức năng (chỉ tài khoản tổng). Menu dọc + tab + ma trận hiện tên này */
export async function renameForm(input: { form_uid: string; form_name: string }) {
  await rpcRaw("fn_form_rename", { p_payload: input }, { fallback: "Không sửa được tên chức năng" });
}

export async function reorderFormGroups(payload: {
  groups?: Array<{ id: string; sort_order: number }>;
  forms?: Array<{ form_uid: string; form_group_uid: string; sort_order: number }>;
}) {
  await rpcRaw("fn_form_group_reorder", { p_payload: { groups: payload.groups || [], forms: payload.forms || [] } }, {
    fallback: "Không sắp xếp được danh mục",
  });
}
