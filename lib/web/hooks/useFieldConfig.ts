// ⚠️ TỰ SINH — bản chép nguyên văn web src/hooks/useFieldConfig.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldConfigService } from "../services/fieldConfig/FieldConfigService";
import { findFieldForm } from "../config/fieldConfigCatalog";
import { isReadonly, isRequired, isShown, validateFields } from "../lib/fieldConfigRules";
import type { EffectiveConfig, FieldRule, FieldScope, ValidateResult } from "../services/fieldConfig/types";

const EMPTY_RULE: FieldRule = { required: [], hidden: [], readonly: [] };
const OK: ValidateResult = { ok: true, missing: [], message: "" };
const LOAD_FAILED: ValidateResult = {
  ok: false,
  missing: [],
  message: "Không tải được cấu hình bắt buộc nhập, vui lòng thử lại",
};

export function useFieldConfig(formKey: string) {
  const [eff, setEff] = useState<EffectiveConfig | null>(() => FieldConfigService.peek());
  const [ready, setReady] = useState<boolean>(() => FieldConfigService.peek() !== null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      FieldConfigService.effective().then((e) => {
        if (!alive) return;
        setEff(e);
        setReady(true);
      });
    load();
    const un = FieldConfigService.subscribe(load);
    // quay lại tab / cửa sổ ⇒ tải lại (trong TTL lấy cache; bản mới khác ⇒ service notify mọi form đang mở)
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      un();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const form = useMemo(() => findFieldForm(formKey), [formKey]);
  const scope: FieldScope = eff?.scope ?? "SYSTEM";
  const rule: FieldRule = eff?.forms?.[formKey] ?? EMPTY_RULE;

  const show = useCallback((k: string) => (form ? isShown(form, rule, scope, k) : true), [form, rule, scope]);
  const readonly = useCallback((k: string) => (form ? isReadonly(form, rule, scope, k) : false), [form, rule, scope]);
  const required = useCallback(
    (k: string, values?: Record<string, any>) => (form ? isRequired(form, rule, scope, k, values) : false),
    [form, rule, scope],
  );
  const validate = useCallback(
    async (values: Record<string, any>): Promise<ValidateResult> => {
      if (!form) return OK;
      // lỗi tải ⇒ thử lại 1 lần (bỏ cache); vẫn lỗi ⇒ chặn lưu thay vì cho qua với FALLBACK
      let r = await FieldConfigService.effectiveResult();
      if (r.failed) r = await FieldConfigService.effectiveResult(true);
      if (r.failed) return LOAD_FAILED;
      const e = r.value;
      return validateFields(form, e.forms?.[formKey] ?? EMPTY_RULE, e.scope, values);
    },
    [form, formKey],
  );

  return { ready, scope, show, readonly, required, validate };
}
