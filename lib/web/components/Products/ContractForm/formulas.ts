// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/formulas.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { PolicyDiscountOption } from "../../../services/DaSalesPolicyService";
import type { PickedOption } from "./discountOptions";

/* ====== Policy Config Round (from localStorage config) ====== */
export type FormulaFieldKey =
  | 'tongCK' | 'tongChuaVAT' | 'vat' | 'tongGomVAT' | 'phiBaoTri' | 'tongGiaTriHD' | 'giaNaked'
  // Low-rise specific fields
  | 'giaDatChuaVAT' | 'vatDat' | 'tongGiaDat' | 'tienXDChuaVAT' | 'vatXD' | 'tienXDGomVAT' | 'tongGiaTriHDMB';

export interface RoundFormulas {
  // High-rise
  tongCK: string;
  tongChuaVAT?: string;
  vat?: string;
  tongGomVAT?: string;
  phiBaoTri?: string;
  tongGiaTriHD?: string;
  giaNaked?: string;
  // Low-rise
  giaDatChuaVAT?: string;
  vatDat?: string;
  tongGiaDat?: string;
  tienXDChuaVAT?: string;
  vatXD?: string;
  tienXDGomVAT?: string;
  tongGiaTriHDMB?: string;
  evalOrder?: FormulaFieldKey[];
}

export const DEFAULT_EVAL_ORDER: FormulaFieldKey[] = ['tongCK', 'tongChuaVAT', 'vat', 'tongGomVAT', 'phiBaoTri', 'tongGiaTriHD', 'giaNaked'];
export const LOW_EVAL_ORDER: FormulaFieldKey[] = ['tongCK', 'giaDatChuaVAT', 'vatDat', 'tongGiaDat', 'tienXDChuaVAT', 'vatXD', 'tienXDGomVAT', 'tongGiaTriHDMB'];

export interface PolicyDiscountRound {
  key: string;
  name: string;
  description?: string;
  discountPercent: number;
  tienCK: number;
  heSo: number;
  enabled: boolean;
  formulas: RoundFormulas;
  /** Mã dòng chiết khấu của chính sách (ID), hoặc số thứ tự kiểu cũ */
  maCK?: unknown;
  /** Các mức tùy chọn của dòng chính sách */
  luaChon?: PolicyDiscountOption[];
  /** Các mức đã tick (ảnh chụp tên và giá trị) */
  luaChonDaChon?: PickedOption[];
  /** Loại của dòng chính sách: percentage | fixed_amount */
  loai?: string;
  /** Dòng mốc tính của chính sách */
  mocTinh?: boolean;
  /** Không trừ vào giá HĐ: CK luôn bằng 0, các mức đã tick vẫn được lưu */
  khongTruGiaHD?: boolean;
  /** Dòng % tick Mốc tính tỷ lệ chiết khấu: cộng vào `LuyKeCKTyLe` của các dòng tick phía dưới */
  mocTinhTyLe?: boolean;
  /** Loại vòng của cấu hình tính giá (cao tầng): TIENCODINH | PHANTRAM */
  loaiCK?: string;
}

/** Normalize formula text to tolerate accidental dangling operators/spaces */
export function sanitizeFormulaExpression(expression: string): string {
  return expression
    .replace(/\s+/g, " ")
    .replace(/([+\-*/])\s*,/g, ",")
    .replace(/([+\-*/])\s*\)/g, ")")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim();
}

/** Resolve custom ROUND(value, precision) calls before evaluating expression */
export function resolveRoundFunctions(expression: string): string {
  let expr = sanitizeFormulaExpression(expression);
  let safetyLimit = 20;

  while (/ROUND\s*\(/i.test(expr) && safetyLimit-- > 0) {
    let replaced = false;
    const positions: number[] = [];
    const upper = expr.toUpperCase();
    let searchFrom = 0;

    while (true) {
      const idx = upper.indexOf("ROUND", searchFrom);
      if (idx === -1) break;
      positions.push(idx);
      searchFrom = idx + 1;
    }

    for (let pi = positions.length - 1; pi >= 0; pi--) {
      const start = positions[pi];
      let cursor = start + 5;
      while (cursor < expr.length && /\s/.test(expr[cursor])) cursor++;
      if (cursor >= expr.length || expr[cursor] !== "(") continue;

      const openIndex = cursor;
      let depth = 0;
      let commaIndex = -1;
      let closeIndex = -1;

      for (let i = openIndex; i < expr.length; i++) {
        if (expr[i] === "(") depth++;
        else if (expr[i] === ")") {
          depth--;
          if (depth === 0) {
            closeIndex = i;
            break;
          }
        } else if (expr[i] === "," && depth === 1 && commaIndex === -1) {
          commaIndex = i;
        }
      }

      if (closeIndex === -1) {
        expr = expr.slice(0, start) + expr.slice(start + 5);
        replaced = true;
        break;
      }

      if (commaIndex === -1) {
        const inner = sanitizeFormulaExpression(expr.slice(openIndex + 1, closeIndex));
        expr = expr.slice(0, start) + inner + expr.slice(closeIndex + 1);
        replaced = true;
        break;
      }

      try {
        const valueExpr = sanitizeFormulaExpression(expr.slice(openIndex + 1, commaIndex).trim());
        const precisionExpr = sanitizeFormulaExpression(expr.slice(commaIndex + 1, closeIndex).trim());
        const value = new Function(`"use strict"; return (${valueExpr});`)();
        const precision = new Function(`"use strict"; return (${precisionExpr});`)();

        if (typeof value !== "number" || !isFinite(value) || typeof precision !== "number" || !isFinite(precision)) {
          expr = expr.slice(0, start) + valueExpr + expr.slice(closeIndex + 1);
          replaced = true;
          break;
        }

        const factor = Math.pow(10, precision);
        const rounded = Math.round(value / factor) * factor;
        expr = expr.slice(0, start) + String(rounded) + expr.slice(closeIndex + 1);
        replaced = true;
        break;
      } catch {
        const inner = sanitizeFormulaExpression(expr.slice(openIndex + 1, commaIndex).trim());
        expr = expr.slice(0, start) + inner + expr.slice(closeIndex + 1);
        replaced = true;
        break;
      }
    }

    if (!replaced) break;
  }

  return sanitizeFormulaExpression(expr);
}

/** Biến theo lần còn sót (lần chưa tính hoặc không có) tính là 0, phần còn lại của công thức vẫn tính. */
export const zeroRoundRefs = (expr: string): string =>
  expr.replace(/\b(?:TongChuaVATLan|TienCKLan)[1-9]\d*\b/g, "0");

/** Evaluate a round formula string using context variables */
export function evaluateRoundFormula(formula: string, vars: Record<string, number>): number {
  if (!formula) return 0;
  try {
    // Dấu = ở đầu do nhập theo thói quen Excel, không thuộc biểu thức
    let expr = formula.replace(/^\s*=\s*/, "");
    const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      const value = vars[key] ?? 0;
      // Số âm phải có ngoặc: `A-B` với B = -5 thành `A--5` là lỗi cú pháp, công thức sẽ ra 0
      expr = expr.replace(regex, value < 0 ? `(${value})` : String(value));
    }
    expr = zeroRoundRefs(expr);
    expr = resolveRoundFunctions(expr);
    expr = sanitizeFormulaExpression(expr).replace(/([+\-*/])\s*$/g, "").trim();
    if (!/^[\d\s+\-*/().,]+$/.test(expr)) return 0;
    const result = new Function(`"use strict"; return (${expr});`)();
    if (typeof result === 'number' && isFinite(result)) return result;
    return 0;
  } catch { return 0; }
}

/** Công thức mặc định của Giá Naked: giữ nguyên giá lần trước. */
export const NAKED_KEEP_FORMULA = "GiaNaked_Prev";

/**
 * Công thức đã trim. Để trống thì Giá Naked giữ giá lần trước, các khóa khác bằng 0.
 * Trong công thức Giá Naked, `GiaNaked` được hiểu là `GiaNaked_Prev`: vòng hội tụ chạy
 * nhiều lượt và ghi đè `GiaNaked`, tự tham chiếu sẽ bị nhân lên theo số lượt.
 */
export function roundFormulaText(formulas: RoundFormulas | undefined, key: FormulaFieldKey): string {
  const text = (formulas?.[key] || "").trim();
  if (key !== "giaNaked") return text || "0";
  return text.replace(/\bGiaNaked\b/g, NAKED_KEEP_FORMULA) || NAKED_KEEP_FORMULA;
}

export const DEFAULT_FIRST_FORMULAS: RoundFormulas = {
  tongCK: '',
  evalOrder: [...DEFAULT_EVAL_ORDER]
};
export const DEFAULT_NEXT_FORMULAS: RoundFormulas = {
  tongCK: '',
  evalOrder: [...DEFAULT_EVAL_ORDER]
};

/* ---- LOW-RISE FORMULAS (Thấp tầng) ---- */
export const LOW_FIRST_FORMULAS: RoundFormulas = {
  tongCK: '',
  evalOrder: [...LOW_EVAL_ORDER],
};
export const LOW_NEXT_FORMULAS: RoundFormulas = {
  tongCK: '',
  evalOrder: [...LOW_EVAL_ORDER],
};

export function getDefaultRounds(type: 'high' | 'low' = 'high'): PolicyDiscountRound[] {
  if (type === 'low') {
    return [
      // { key: 'ck1', name: 'Chiết khấu thanh toán nhanh', description: '', discountPercent: 0, tienCK: 0, heSo: 1, enabled: true, formulas: { ...LOW_FIRST_FORMULAS } },
      // { key: 'ck2', name: 'Chiết khấu mở bán', description: '', discountPercent: 0, tienCK: 0, heSo: 1, enabled: true, formulas: { ...LOW_NEXT_FORMULAS } },
      // { key: 'ck3', name: 'Chiết khấu mua nhiều', description: '', discountPercent: 0, tienCK: 0, heSo: 1, enabled: false, formulas: { ...LOW_NEXT_FORMULAS } },
    ];
  }
  return [
    // { key: 'ck1', name: 'Chiết khấu thanh toán nhanh', description: '', discountPercent: 0, tienCK: 0, heSo: 1, enabled: true, formulas: { ...DEFAULT_FIRST_FORMULAS } },
    // { key: 'ck2', name: 'Chiết khấu mở bán', description: '', discountPercent: 0, tienCK: 0, heSo: 1, enabled: true, formulas: { ...DEFAULT_NEXT_FORMULAS } },
    // { key: 'ck3', name: 'Chiết khấu mua nhiều', description: '', discountPercent: 0, tienCK: 0, heSo: 1, enabled: false, formulas: { ...DEFAULT_NEXT_FORMULAS } },
  ];
}
