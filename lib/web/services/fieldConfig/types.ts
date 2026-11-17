// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/fieldConfig/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
export type FieldScope = "SYSTEM" | "AGENCY";

/** Chế độ xem (che ký tự) — mid: giữ h đầu + t cuối · tail: giữ t cuối · all: che hết (che-truong-theo-nhom) */
export type MaskKind = "mid" | "tail" | "all";
export interface MaskRule {
  k: MaskKind;
  h?: number;
  t?: number;
}
export type MaskMap = Record<string, MaskRule>;

export interface FieldRule {
  required: string[];
  hidden: string[];
  readonly: string[];
  /** Chế độ xem từng trường; thiếu = không che (máy chủ cũ / dòng chưa có che) */
  mask?: MaskMap;
}

export interface EffectiveConfig {
  scope: FieldScope;
  forms: Record<string, FieldRule>;
}

export interface FieldConfigRow extends FieldRule {
  id: string;
  group_id: string | null;
  form_key: string;
  is_active: boolean;
  updated_at: string;
}

export interface FieldConfigList {
  company: { id: string; code: string; ten_ct: string };
  groups: { id: string; per_name: string; is_full_access: boolean }[];
  rows: FieldConfigRow[];
}

export interface SaveFieldConfigInput {
  scope: FieldScope;
  groupId: string | null;
  formKey: string;
  required: string[];
  hidden: string[];
  readonly: string[];
  mask: MaskMap;
  isActive: boolean;
  expectedUpdatedAt: string | null;
}

export interface ValidateResult {
  ok: boolean;
  missing: { key: string; label: string }[];
  message: string;
}
