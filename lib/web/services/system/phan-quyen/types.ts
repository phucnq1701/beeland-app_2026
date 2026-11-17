// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/phan-quyen/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Ma trận phân quyền — kiểu dữ liệu (RPC fn_perm_* / fn_form_group_* ở BE, database/sp/20_he_thong/phan_quyen). */

/** Phạm vi dữ liệu của 1 ô: cả công ty / chỉ dữ liệu của nhân viên */
export type ScopeCode = "COMPANY" | "EMPLOYEE";

/** Nhóm quyền (cây — chỉ để sắp xếp, không kế thừa quyền) */
export interface PermGroup {
  id: string;
  per_name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_agent: boolean;
  is_full_access: boolean;
  is_active: boolean;
  /** "Cha › Con › Cháu" */
  path: string;
  /** gốc = 1 */
  depth: number;
  /** không có nhóm con ⇒ được có quyền + nhân viên */
  is_leaf: boolean;
  n_children: number;
  n_employees: number;
  n_forms: number;
}

export interface FeatureDef {
  code: string;
  name: string;
  color: string | null;
  sort_order: number;
}

/** Chức năng (form) công ty được cấp, kèm thao tác chọn được */
export interface MatrixForm {
  form_uid: string;
  form_id: number;
  form_name: string;
  form_path: string | null;
  sort_order: number;
  features: string[];
  n_features?: number;
}

/** Nhóm chức năng (cấp giữa Module › Nhóm chức năng › Chức năng) */
export interface MatrixFormGroup {
  id: string;
  group_name: string;
  sort_order: number;
  forms: MatrixForm[];
}

export interface MatrixModule {
  id: string;
  module_key: string;
  module_name: string;
  sort_order: number;
  icon?: string | null;
  groups: MatrixFormGroup[];
}

/** 1 ô đã lưu (sys_perm_group_forms) */
export interface MatrixCell {
  group_uid: string;
  form_uid: string;
  has_permission: boolean;
  /** [] + has_permission = true là dữ liệu cũ: máy chủ coi là MỌI thao tác */
  features: string[];
  type_code: ScopeCode;
}

/** Quyền của người đang thao tác */
export interface MatrixMe {
  can_edit: boolean;
  can_add: boolean;
  can_delete: boolean;
  /** toàn quyền (nhóm toàn quyền / tài khoản tổng) — không bị giới hạn "chỉ cấp quyền ⊆ quyền mình" */
  privileged: boolean;
  is_super: boolean;
  /** nhóm của chính mình — không tự sửa được */
  my_groups: string[];
}

export interface MatrixData {
  features: FeatureDef[];
  modules: MatrixModule[];
  groups: PermGroup[];
  cells: MatrixCell[];
  me: MatrixMe;
}

/** 1 ô gửi lên fn_perm_matrix_set. features rỗng ⇒ máy chủ lưu "không cấp" (has_permission = 0) */
export interface CellInput {
  group_uid: string;
  form_uid: string;
  features: string[];
  type_code: ScopeCode;
}

export interface PermGroupInput {
  id?: string;
  per_name: string;
  description?: string | null;
  /** có khoá ⇒ đổi nhóm cấp trên; null = gốc */
  parent_id?: string | null;
  sort_order?: number;
  is_agent?: boolean;
  is_full_access?: boolean;
  is_active?: boolean;
}

export interface GroupMember {
  id: string;
  ma_nv: string | null;
  ho_ten: string | null;
  email: string | null;
  ten_pb: string | null;
  ten_cv: string | null;
  lock: boolean;
  ap_dung: boolean;
  /** nhóm hiện tại (perm_group_uid, dự phòng bảng phụ) */
  group_uid: string | null;
}

/** Danh mục nhóm chức năng (tab Danh mục) */
export interface CatalogForm {
  form_uid: string;
  form_id: number;
  form_name: string;
  form_path: string | null;
  sort_order: number;
  /** Số tính năng đã khai báo (fn_form_group_list) */
  n_features?: number;
}

export interface CatalogGroup {
  id: string;
  group_name: string;
  sort_order: number;
  forms: CatalogForm[];
}

export interface CatalogModule {
  id: string;
  module_key: string;
  module_name: string;
  sort_order: number;
  icon?: string | null;
  groups: CatalogGroup[];
}

export interface FormGroupCatalog {
  modules: CatalogModule[];
  can_edit: boolean;
}
