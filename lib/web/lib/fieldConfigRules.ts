// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/fieldConfigRules.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Luật thuần: hiện / chỉ xem / bắt buộc / kiểm giá trị theo cấu hình. */
import { fieldsForScope, type FieldForm, type FieldItem } from "../config/fieldConfigCatalog";
import type { FieldRule, FieldScope, ValidateResult } from "../services/fieldConfig/types";

export const isEmptyValue = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
};

const find = (form: FieldForm, scope: FieldScope, key: string): FieldItem | undefined =>
  fieldsForScope(form, scope).find((f) => f.key === key);

export const isShown = (form: FieldForm, rule: FieldRule, scope: FieldScope, key: string): boolean => {
  const f = find(form, scope, key);
  if (!f || f.locked) return true;
  return !rule.hidden.includes(key);
};

export const isReadonly = (form: FieldForm, rule: FieldRule, scope: FieldScope, key: string): boolean => {
  const f = find(form, scope, key);
  if (!f || f.locked) return false;
  return rule.readonly.includes(key);
};

export const isRequired = (
  form: FieldForm,
  rule: FieldRule,
  scope: FieldScope,
  key: string,
  values?: Record<string, any>,
): boolean => {
  const f = find(form, scope, key);
  if (!f || f.noRequire) return false;
  if (f.locked) return true;
  if (!rule.required.includes(key)) return false;
  if (rule.hidden.includes(key) || rule.readonly.includes(key)) return false;
  if (f.when && !(values && f.when(values))) return false;
  return true;
};

export const validateFields = (
  form: FieldForm,
  rule: FieldRule,
  scope: FieldScope,
  values: Record<string, any>,
): ValidateResult => {
  const missing: { key: string; label: string }[] = [];
  for (const f of fieldsForScope(form, scope)) {
    if (isRequired(form, rule, scope, f.key, values) && isEmptyValue(values?.[f.key]))
      missing.push({ key: f.key, label: f.label });
  }
  return {
    ok: missing.length === 0,
    missing,
    message: missing.length ? "Vui lòng nhập: " + missing.map((m) => m.label).join(", ") : "",
  };
};
