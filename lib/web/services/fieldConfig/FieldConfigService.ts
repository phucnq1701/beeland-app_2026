// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/fieldConfig/FieldConfigService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../../_shims/integrations/supabase/client";
import { sessionClaims } from "../../_shims/lib/session";
import type {
  EffectiveConfig, FieldConfigList, FieldConfigRow, FieldScope, SaveFieldConfigInput,
} from "./types";

const TTL_MS = 60_000;
const FALLBACK = (): EffectiveConfig => ({ scope: "SYSTEM", forms: {} });

let cache: { key: string; at: number; value: EffectiveConfig } | null = null;
let gen = 0;
/** Kết quả tải: failed = lỗi RPC / mạng (value là FALLBACK, không cache). */
export interface EffectiveResult {
  value: EffectiveConfig;
  failed: boolean;
}
let inflight: { key: string; p: Promise<EffectiveResult> } | null = null;
const listeners = new Set<() => void>();

const claimsKey = (): string => {
  const c = sessionClaims() as Record<string, unknown>;
  return `${c.company_id ?? ""}|${c.sub ?? ""}|${c.per_id ?? ""}`;
};

const notify = () => listeners.forEach((fn) => fn());

const toError = (e: { message?: string; code?: string }) => {
  const err = new Error(e.message || "Lỗi cấu hình trường nhập") as Error & { code?: string };
  err.code = e.code;
  return err;
};

const valid = (key: string) => !!cache && cache.key === key && Date.now() - cache.at < TTL_MS;

const load = (force: boolean): Promise<EffectiveResult> => {
  const key = claimsKey();
  if (!force && valid(key)) return Promise.resolve({ value: cache!.value, failed: false });
  if (!force && inflight?.key === key) return inflight.p;
  const myGen = gen;
  let p!: Promise<EffectiveResult>;
  p = (async () => {
    await Promise.resolve();
    try {
      const { data, error } = await supabase.rpc("fn_field_config_effective" as any);
      if (error || !data) return { value: FALLBACK(), failed: true };
      const value = data as unknown as EffectiveConfig;
      if (gen === myGen) {
        const prev = cache;
        cache = { key, at: Date.now(), value };
        // bản mới khác bản đang dùng (hoặc đổi phiên/tài khoản) ⇒ báo form đang mở vẽ lại Ẩn/Chỉ xem/dấu *
        if (prev && (prev.key !== key || JSON.stringify(prev.value) !== JSON.stringify(value))) notify();
      }
      return { value, failed: false };
    } catch {
      return { value: FALLBACK(), failed: true };
    } finally {
      if (gen === myGen && inflight?.p === p) inflight = null;
    }
  })();
  if (gen === myGen) inflight = { key, p };
  return p;
};

export const FieldConfigService = {
  /** Cấu hình hiệu lực; lỗi ⇒ FALLBACK (không ràng buộc) — dùng cho hiển thị. */
  async effective(force = false): Promise<EffectiveConfig> {
    return (await load(force)).value;
  },

  /** Như effective nhưng báo lỗi tải (failed) — dùng cho kiểm tra trước khi lưu. */
  effectiveResult(force = false): Promise<EffectiveResult> {
    return load(force);
  },

  peek(): EffectiveConfig | null {
    return valid(claimsKey()) ? cache!.value : null;
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  clear() {
    gen++;
    cache = null;
    inflight = null;
  },

  async list(scope: FieldScope): Promise<FieldConfigList> {
    const { data, error } = await supabase.rpc("fn_field_config_list" as any, { p_scope: scope });
    if (error) throw toError(error);
    return data as unknown as FieldConfigList;
  },

  async save(input: SaveFieldConfigInput): Promise<FieldConfigRow | null> {
    const { data, error } = await supabase.rpc("fn_field_config_save" as any, {
      p_scope: input.scope,
      p_group_id: input.groupId,
      p_form_key: input.formKey,
      p_required: input.required,
      p_hidden: input.hidden,
      p_readonly: input.readonly,
      p_is_active: input.isActive,
      // chế độ xem từng trường (máy chủ chuẩn hoá, bỏ trường đang Ẩn)
      p_mask: input.mask,
      // chuỗi nguyên văn từ server — không qua Date (mất micro giây)
      p_expected_updated_at: input.expectedUpdatedAt,
    });
    if (error) throw toError(error);
    FieldConfigService.clear();
    notify();
    return (data as unknown as FieldConfigRow | null) ?? null;
  },

  async remove(scope: FieldScope, groupId: string | null, formKey: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("fn_field_config_delete" as any, {
      p_scope: scope,
      p_group_id: groupId,
      p_form_key: formKey,
    });
    if (error) throw toError(error);
    FieldConfigService.clear();
    notify();
    return !!(data as any)?.deleted;
  },
};
