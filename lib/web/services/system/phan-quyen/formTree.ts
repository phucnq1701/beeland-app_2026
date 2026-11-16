// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/phan-quyen/formTree.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Cây chức năng 3 cấp (Module › Nhóm chức năng › Chức năng) cho các màn tích chọn form: Phân quyền công ty, Gói sản phẩm.
 * Cùng danh mục, thứ tự và cách tìm với ma trận phân quyền (filterModules) — hàm thuần, không gọi mạng.
 */
import { fold } from "./matrix";

export const OTHER_GROUP_NAME = "Khác";
const OTHER_GROUP_KEY = "other";

export interface FormPlacement {
  groupKey: string;
  groupName: string;
  groupRank: number;
  formRank: number;
}

/** Phần của danh mục (getFormGroupCatalog) cần để xếp form — catalog đã sắp theo thứ tự nhóm, thứ tự form */
export interface FormGroupCatalogLike {
  modules: Array<{
    groups: Array<{ id: string; group_name: string; forms: Array<{ form_uid: string }> }>;
  }>;
}

export type FormPlacer = (formUid: string, groupLabel?: string | null) => FormPlacement;

const other = (formRank: number): FormPlacement => ({
  groupKey: OTHER_GROUP_KEY,
  groupName: OTHER_GROUP_NAME,
  groupRank: Number.MAX_SAFE_INTEGER,
  formRank,
});

/**
 * Trả hàm xếp 1 form vào nhóm. Có danh mục ⇒ theo sys_form_groups (form không có trong danh mục vào "Khác").
 * catalog = null (không đọc được danh mục) ⇒ theo group_label, thứ tự nhóm = thứ tự gặp.
 */
export function createFormPlacer(catalog: FormGroupCatalogLike | null): FormPlacer {
  let seen = 0;
  if (catalog) {
    const placed = new Map<string, FormPlacement>();
    let groupRank = 0;
    for (const module of catalog.modules) {
      for (const group of module.groups) {
        group.forms.forEach((form, formRank) =>
          placed.set(form.form_uid.toLowerCase(), {
            groupKey: group.id,
            groupName: group.group_name,
            groupRank,
            formRank,
          }),
        );
        groupRank += 1;
      }
    }
    return (formUid) => placed.get(formUid.toLowerCase()) ?? other(seen++);
  }

  const labelRank = new Map<string, number>();
  return (_formUid, groupLabel) => {
    const formRank = seen++;
    const label = String(groupLabel ?? "").trim();
    if (!label) return other(formRank);
    if (!labelRank.has(label)) labelRank.set(label, labelRank.size);
    return { groupKey: `label:${label}`, groupName: label, groupRank: labelRank.get(label) as number, formRank };
  };
}

export const byPlacement = (a: FormPlacement, b: FormPlacement) =>
  a.groupRank - b.groupRank || a.formRank - b.formRank;

export interface FormGroupView<F> {
  groupKey: string;
  groupName: string;
  forms: F[];
}

/** Gom danh sách form của 1 module theo nhóm, giữ thứ tự sẵn có */
export function formGroupsOf<F extends Pick<FormPlacement, "groupKey" | "groupName">>(forms: F[]): FormGroupView<F>[] {
  const groups = new Map<string, FormGroupView<F>>();
  for (const form of forms) {
    const group = groups.get(form.groupKey);
    if (group) group.forms.push(form);
    else groups.set(form.groupKey, { groupKey: form.groupKey, groupName: form.groupName, forms: [form] });
  }
  return [...groups.values()];
}

/** Tìm như ma trận: khớp module ⇒ cả module; khớp nhóm ⇒ cả nhóm; khớp tên / đường dẫn / đúng FormID ⇒ form đó */
export function filterFormTree<
  F extends { groupName: string; formName: string; formPath: string | null; formId: number },
  M extends { moduleName: string; forms: F[] },
>(modules: M[], keyword: string): M[] {
  const kw = fold(keyword);
  if (!kw) return modules;
  return modules
    .map((m) =>
      fold(m.moduleName).includes(kw)
        ? m
        : {
            ...m,
            forms: m.forms.filter(
              (f) =>
                fold(f.groupName).includes(kw) ||
                fold(f.formName).includes(kw) ||
                fold(f.formPath || "").includes(kw) ||
                String(f.formId) === kw,
            ),
          },
    )
    .filter((m) => m.forms.length);
}
