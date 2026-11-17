// ⚠️ TỰ SINH — bản chép nguyên văn web src/utils/codePattern.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { HeThongService } from "../_shims/services/HeThongService";
import { CodeRuleCloudService } from "../services/CodeRuleCloudService";

export type FormCode =
  | "DUAN"
  | "BOOKING"
  | "DATCOC"
  | "HOPDONG"
  | "GOPVON"
  | "PHIEUTHU"
  | "PHIEUCHI"
  | "SANPHAM";

export interface CodeRule {
  formCode: string;
  pattern: string;
  resetCycle: "never" | "yearly" | "monthly";
}

let cache: { rules: CodeRule[]; ts: number } | null = null;
const TTL = 60_000; // 1 phút

export async function loadCodeRules(force = false): Promise<CodeRule[]> {
  if (!force && cache && Date.now() - cache.ts < TTL) return cache.rules;
  // Ưu tiên Cloud (tách theo mã công ty đăng ký)
  try {
    const cloud = await CodeRuleCloudService.list();
    if (cloud.length) {
      const rules: CodeRule[] = cloud.map((c) => ({
        formCode: c.formCode,
        pattern: c.pattern,
        resetCycle: c.resetCycle,
      }));
      cache = { rules, ts: Date.now() };
      return rules;
    }
  } catch (e) {
    console.warn("loadCodeRules cloud error", e);
  }
  try {
    const res = await HeThongService.CaiDat.get();
    const rules: CodeRule[] = (res?.data ?? []).map((d: any) => ({
      formCode: d.FormCode ?? d.formCode,
      pattern: d.Pattern ?? d.pattern ?? "",
      resetCycle: (d.ResetCycle ?? d.resetCycle ?? "never") as CodeRule["resetCycle"],
    }));
    cache = { rules, ts: Date.now() };
    return rules;
  } catch (e) {
    console.error("loadCodeRules error", e);
    return cache?.rules ?? [];
  }
}


export async function getCodeRule(formCode: FormCode): Promise<CodeRule | null> {
  const rules = await loadCodeRules();
  return rules.find((r) => r.formCode === formCode) ?? null;
}

export interface RenderVars {
  MaSP?: string | number;
  TenDA?: string;
  MaDA?: string | number;
  STT?: number; // số thứ tự (auto)
  Lan?: number;
}

/** Bỏ dấu, viết hoa, bỏ ký tự lạ — dùng cho {TenDA}/{MaSP} trong mã chứng từ */
export const slug = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .toUpperCase();

export function renderPattern(pattern: string, vars: RenderVars = {}): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  // Detect STT placeholder length: {x}, {xx}, {xxx}, {xxxx}, {xxxxx}, ...
  let result = pattern || "";
  result = result.replace(/\{(x+)\}/gi, (_m, xs: string) => {
    const len = xs.length;
    return String(vars.STT ?? 1).padStart(len, "0");
  });

  return result
    .replace(/\{MaSP\}/g, slug(String(vars.MaSP ?? "")))
    .replace(/\{TenDA\}/g, slug(String(vars.TenDA ?? "")))
    .replace(/\{MaDA\}/g, slug(String(vars.MaDA ?? "")))
    .replace(/\{yyyy\}/gi, yyyy)
    .replace(/\{yy\}/g, yy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, MM)
    .replace(/\{mm\}/g, MM)
    .replace(/\{dd\}/g, dd)
    .replace(/\{DD\}/g, dd)
    .replace(/\{nam\}/g, yyyy)
    .replace(/\{thang\}/g, MM)
    .replace(/\{ngay\}/g, dd)
    .replace(/\{lan\}/g, String(vars.Lan ?? 1))
    // Token không hợp lệ (vd: {HDGV}) → giữ phần chữ, bỏ dấu ngoặc
    .replace(/\{([A-Za-z0-9_]+)\}/g, "$1");
}


/**
 * Chu kỳ reset Năm/Tháng chỉ bắt đầu lại số khi mẫu có token năm/tháng (tiền tố đổi theo kỳ); thiếu thì máy chủ đánh tiếp
 * để không trùng mã cũ — trả câu cảnh báo cho màn Cài đặt, null khi không cần.
 */
export function resetCycleWarning(pattern: string, cycle: CodeRule["resetCycle"]): string | null {
  const p = pattern || "";
  const missing =
    (cycle === "yearly" && !/\{(yyyy|yy|nam)\}/i.test(p)) ||
    (cycle === "monthly" && !/\{(mm|thang)\}/i.test(p));
  return missing ? "Mẫu không chứa năm/tháng — sang kỳ mới số sẽ đánh tiếp để không trùng mã cũ" : null;
}

export async function generateCodePreview(
  formCode: FormCode,
  vars: RenderVars = {}
): Promise<string> {
  const rule = await getCodeRule(formCode);
  if (!rule?.pattern) return "";
  return renderPattern(rule.pattern, vars);
}
