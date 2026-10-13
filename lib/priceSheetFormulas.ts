/**
 * Công thức phiếu tính giá – bản app của web:
 *  - vòng chiết khấu (CSBH): beeland/src/components/Products/ContractForm/formulas.ts + helpers.ts (mapApiDetailsToFormulas)
 *  - cấu hình tính giá sản phẩm (CAOTANG/THAPTANG): beeland/src/utils/pricingEngine.ts
 * Khác web duy nhất: `new Function` → `evalArithmetic` (lib/formulaEval.ts), giữ nguyên bộ lọc ký tự và cách quy lỗi.
 * Test so trực tiếp với code web: tests/price-sheet-formulas.test.cjs.
 */
import { evalArithmetic } from "./formulaEval";

/* ============================ Vòng chiết khấu (formulas.ts) ============================ */

export type FormulaFieldKey =
  | "tongCK" | "tongChuaVAT" | "vat" | "tongGomVAT" | "phiBaoTri" | "tongGiaTriHD"
  | "giaDatChuaVAT" | "vatDat" | "tongGiaDat" | "tienXDChuaVAT" | "vatXD" | "tienXDGomVAT" | "tongGiaTriHDMB";

export interface RoundFormulas {
  tongCK: string;
  tongChuaVAT?: string;
  vat?: string;
  tongGomVAT?: string;
  phiBaoTri?: string;
  tongGiaTriHD?: string;
  giaDatChuaVAT?: string;
  vatDat?: string;
  tongGiaDat?: string;
  tienXDChuaVAT?: string;
  vatXD?: string;
  tienXDGomVAT?: string;
  tongGiaTriHDMB?: string;
  evalOrder?: FormulaFieldKey[];
}

export interface PolicyDiscountRound {
  key: string;
  name: string;
  description?: string;
  discountPercent: number;
  tienCK: number;
  heSo: number;
  enabled: boolean;
  formulas: RoundFormulas;
  maCK?: any;
  maKTT?: any;
}

export const DEFAULT_EVAL_ORDER: FormulaFieldKey[] = ["tongCK", "tongChuaVAT", "vat", "tongGomVAT", "phiBaoTri", "tongGiaTriHD"];
export const LOW_EVAL_ORDER: FormulaFieldKey[] = [
  "tongCK", "giaDatChuaVAT", "vatDat", "tongGiaDat", "tienXDChuaVAT", "vatXD", "tienXDGomVAT", "tongGiaTriHDMB",
];

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

/** ROUND(value, precision) – làm tròn theo bội 10^precision (ROUND(x, 3) = tròn nghìn) như web */
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
        const value = evalArithmetic(valueExpr);
        const precision = evalArithmetic(precisionExpr);
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

/** Thay biến rồi tính; lỗi / không hữu hạn / còn ký tự lạ → 0 (như web) */
export function evaluateRoundFormula(formula: string, vars: Record<string, number>): number {
  if (!formula) return 0;
  try {
    let expr = formula;
    const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const regex = new RegExp(`\\b${key}\\b`, "g");
      expr = expr.replace(regex, String(vars[key] ?? 0));
    }
    expr = resolveRoundFunctions(expr);
    expr = sanitizeFormulaExpression(expr).replace(/([+\-*/])\s*$/g, "").trim();
    if (!/^[\d\s+\-*/().,]+$/.test(expr)) return 0;
    const result = evalArithmetic(expr);
    if (typeof result === "number" && isFinite(result)) return result;
    return 0;
  } catch {
    return 0;
  }
}

const EMPTY_FORMULAS = (low: boolean): RoundFormulas => ({
  tongCK: "",
  evalOrder: [...(low ? LOW_EVAL_ORDER : DEFAULT_EVAL_ORDER)],
});

/** Chi tiết công thức của 1 vòng cấu hình (cloud_pricing_config_rounds.details) → RoundFormulas – helpers.ts */
export function mapApiDetailsToFormulas(details: any[], isLow: boolean): RoundFormulas {
  const fallback = EMPTY_FORMULAS(isLow);
  const get = (code: string) =>
    details?.find((d: any) => (d?.Code || "").toLowerCase() === code.toLowerCase())?.Formula;
  return {
    tongCK: get("TongCK") || fallback.tongCK,
    tongChuaVAT: get("TongChuaVAT") || fallback.tongChuaVAT,
    vat: get("VAT") || fallback.vat,
    tongGomVAT: get("TongGomVAT") || fallback.tongGomVAT,
    phiBaoTri: get("PhiBaoTri") || get("PhiBT") || fallback.phiBaoTri,
    tongGiaTriHD:
      get("TongGiaTriHD") || get("TongGiaTri") || get("TongGomPBT") || get("TongCongPBT") || get("TongThanhToan") ||
      fallback.tongGiaTriHD,
    giaDatChuaVAT: get("GiaDatChuaVAT") || get("GiaDatKoVAT") || fallback.giaDatChuaVAT,
    vatDat: get("VATDat") || fallback.vatDat,
    tongGiaDat: get("TongGiaDatVAT") || get("TongGiaDat") || fallback.tongGiaDat,
    tienXDChuaVAT: get("TongXDChuaVAT") || get("TienXDChuaVAT") || fallback.tienXDChuaVAT,
    vatXD: get("VATXD") || fallback.vatXD,
    tienXDGomVAT: get("TongXDVAT") || get("TienXDGomVAT") || fallback.tienXDGomVAT,
    tongGiaTriHDMB:
      get("TongGiaTriHDMB") || get("TongGiaTri") || get("TongGomPBT") || get("TongCongPBT") || get("TongThanhToan") ||
      fallback.tongGiaTriHDMB,
    evalOrder: isLow ? [...LOW_EVAL_ORDER] : [...DEFAULT_EVAL_ORDER],
  };
}

/** Vòng của cấu hình tính giá (đã sắp order_by) → khung vòng chiết khấu – helpers.loadRoundsFromCauHinh */
export function buildRoundTemplate(rounds: any[], isLow: boolean): PolicyDiscountRound[] {
  return (rounds || []).map((r: any, i: number) => ({
    key: String(r?.ID ?? `ck${i + 1}`),
    name: r?.Name || `Chiết khấu ${i + 1}`,
    description: r?.Description || "",
    discountPercent: r?.DefaultPercent ?? 0,
    tienCK: 0,
    heSo: 1,
    enabled: true,
    formulas: mapApiDetailsToFormulas(Array.isArray(r?.Details) ? r.Details : [], isLow),
  }));
}

/**
 * Áp chi tiết chính sách bán hàng (detail đã chuẩn hoá CKPT/CKTien/HeSo/TenChietKhau) lên khung vòng
 * – PriceSheetForm.applyCsbhDetailsToRounds (nhánh có template). Dòng dư dùng khung vòng cuối.
 */
export function applyPolicyDetailsToRounds(details: any[], template: PolicyDiscountRound[]): PolicyDiscountRound[] {
  if (!template.length) return [];
  if (!details.length) return template.map((r) => ({ ...r, discountPercent: 0, heSo: 1, tienCK: 0 }));
  return details.map((d, idx) => {
    const tpl = template[idx] ?? template[template.length - 1];
    return {
      ...tpl,
      key: template[idx] ? tpl.key : `${tpl.key}_extra_${idx}`,
      name: d?.TenChietKhau || tpl.name,
      discountPercent: Number(d?.CKPT) || 0,
      heSo: Number(d?.HeSo) || 1,
      tienCK: Number(d?.CKTien) || 0,
      enabled: true,
    };
  });
}

/** detail của da_sales_policies → dạng CKPT/CKTien (DaSalesPolicyService.normalizeDiscount + toUiDiscount) */
export function normalizePolicyDetail(d: any) {
  const loai = d?.Loai ?? (Number(d?.CKTien) > 0 ? "fixed_amount" : "percentage");
  const giaTri = d?.GiaTri ?? (loai === "fixed_amount" ? Number(d?.CKTien ?? 0) : Number(d?.CKPT ?? 0));
  const v = Number(giaTri ?? 0);
  return {
    ID: String(d?.ID ?? ""),
    TenChietKhau: String(d?.TenChietKhau ?? d?.Ten ?? ""),
    HeSo: Number(d?.HeSo ?? 0),
    Loai: loai,
    GiaTri: v,
    MaCK: String(d?.ID ?? ""),
    CKPT: loai === "fixed_amount" ? 0 : Number(v || 0),
    CKTien: loai === "fixed_amount" ? Number(v || 0) : 0,
  };
}

/* ======================== Cấu hình tính giá sản phẩm (pricingEngine.ts) ======================== */

export type RoundingMode = "none" | "round" | "floor" | "ceil";

export interface FieldConfig {
  key: string;
  label: string;
  type: "input" | "formula";
  formula?: string;
  roundingMode?: RoundingMode;
  roundingPrecision?: number;
}

export function mapApiDetailToFields(detail: any[] = []): FieldConfig[] {
  return [...detail]
    .sort((a, b) => (a?.OrderBy ?? 0) - (b?.OrderBy ?? 0))
    .map((d) => ({
      key: d.Code,
      label: d.Name,
      type: d.Type === "CONGTHUC" ? "formula" : "input",
      formula: d.Type === "CONGTHUC" ? d.Formula || "" : undefined,
    }));
}

export function pickActiveConfig(list: any[] = [], idCauHinhTinhGia: any): any | undefined {
  if (idCauHinhTinhGia) {
    const key = String(idCauHinhTinhGia);
    return list.find((c) => String(c?.ID ?? "") === key) || list.find((c) => c?.Status === true);
  }
  return list.find((c) => c?.Status === true);
}

export function getPriceFieldsFromApi(apiData: any[] | null | undefined, idCauHinhTinhGia: any): FieldConfig[] {
  const active = pickActiveConfig(apiData || [], idCauHinhTinhGia);
  return active?.Detail?.length ? mapApiDetailToFields(active.Detail) : [];
}

const PE_FNS = {
  round: (x: number, n: number = 0) => {
    const f = Math.pow(10, n);
    return Math.round(x * f) / f;
  },
  floor: (x: number, n: number = 0) => {
    const f = Math.pow(10, n);
    return Math.floor(x * f) / f;
  },
  ceil: (x: number, n: number = 0) => {
    const f = Math.pow(10, n);
    return Math.ceil(x * f) / f;
  },
};

export function evaluateFormula(formula: string, data: Record<string, any>, allFields: FieldConfig[]): number | null {
  if (!formula) return null;
  try {
    const fieldKeys = allFields.map((f) => f.key).sort((a, b) => b.length - a.length);
    let expression = formula;
    for (const key of fieldKeys) {
      const regex = new RegExp(`\\b${key}\\b`, "g");
      const val = Number(data[key]);
      expression = expression.replace(regex, isNaN(val) ? "0" : String(val));
    }
    expression = expression.replace(/\bDienTichThongThuy\b/g, String(Number(data["DienTichThongThuy"]) || 0));
    expression = expression.replace(
      /\bdien_tich\b/g,
      String(Number(data["DienTichThongThuy"] || data["DienTichDat"]) || 0)
    );
    if (!/^[\d\s+\-*/().,a-zA-Z_]+$/.test(expression)) return null;
    const identifiers = expression.match(/[a-zA-Z_]+/g) || [];
    for (const id of identifiers) {
      if (!["round", "floor", "ceil"].includes(id)) return null;
    }
    const result = evalArithmetic(expression, PE_FNS);
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

export function applyRounding(val: number, mode: RoundingMode = "round", precision: number = 0): number {
  if (mode === "none") return val;
  const factor = Math.pow(10, precision);
  switch (mode) {
    case "floor":
      return Math.floor(val * factor) / factor;
    case "ceil":
      return Math.ceil(val * factor) / factor;
    case "round":
    default:
      return Math.round(val * factor) / factor;
  }
}

export function computeAllFormulas(
  data: Record<string, any>,
  fields: FieldConfig[],
  roundingMode: RoundingMode = "round",
  roundingPrecision: number = 0
): Record<string, any> {
  const result = { ...data };
  const formulaFields = fields.filter((f) => f.type === "formula" && f.formula);
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const field of formulaFields) {
      const val = evaluateFormula(field.formula!, result, fields);
      if (val !== null && val !== result[field.key]) {
        const mode = field.roundingMode ?? roundingMode;
        const precision = field.roundingPrecision ?? roundingPrecision;
        result[field.key] = applyRounding(val, mode, precision);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}
