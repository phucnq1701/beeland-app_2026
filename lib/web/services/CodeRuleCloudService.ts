// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CodeRuleCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../_shims/lib/session";

export interface CloudCodeRule {
  id?: string | null;
  formCode: string;
  pattern: string;
  resetCycle: "never" | "yearly" | "monthly";
}

const TBL = "cloud_code_rules";

/**
 * Quy tắc đánh mã lưu trên Cloud — tách theo UUID công ty đăng ký
 * (`ma_ctdk_uid` → cloud_companies.id), lấy từ token đăng nhập.
 * Cột `ma_ctdk` (text) đã bị xóa khỏi bảng.
 */
export const CodeRuleCloudService = {
  companyId: () => sessionCompanyId(),

  list: async (): Promise<CloudCodeRule[]> => {
    const uid = CodeRuleCloudService.companyId();
    if (!uid) return [];
    const { data, error } = await supabase
      .from(TBL as any)
      .select("*")
      .eq("ma_ctdk_uid", uid)
      .order("form_code", { ascending: true });
    if (error) throw error;
    return ((data || []) as any[]).map((d) => ({
      id: d.id,
      formCode: d.form_code,
      pattern: d.pattern || "",
      resetCycle: (d.reset_cycle || "never") as CloudCodeRule["resetCycle"],
    }));
  },

  save: async (rule: CloudCodeRule) => {
    const uid = CodeRuleCloudService.companyId();
    if (!uid) throw new Error("Không xác định được công ty đăng ký từ tài khoản đăng nhập");
    const payload: Record<string, any> = {
      ma_ctdk_uid: uid,
      form_code: rule.formCode,
      pattern: rule.pattern || "",
      reset_cycle: rule.resetCycle || "never",
    };
    const { error } = await supabase
      .from(TBL as any)
      .upsert(payload as any, { onConflict: "ma_ctdk_uid,form_code" });
    if (error) throw error;
  },

  remove: async (formCode: string) => {
    const uid = CodeRuleCloudService.companyId();
    if (!uid) return;
    const { error } = await supabase
      .from(TBL as any)
      .delete()
      .eq("form_code", formCode)
      .eq("ma_ctdk_uid", uid);
    if (error) throw error;
  },
};
