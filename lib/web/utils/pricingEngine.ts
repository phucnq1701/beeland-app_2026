// ⚠️ TỰ SINH — bản chép nguyên văn web src/utils/pricingEngine.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/* ====== PRICING ENGINE — Shared types, defaults & formula evaluator ====== */

export type RoundingMode = "none" | "round" | "floor" | "ceil";
export type RoundingPrecision = 0 | 1 | 2 | 3 | -1 | -2 | -3;

export interface FieldConfig {
  key: string;
  label: string;
  type: "input" | "formula";
  formula?: string;
  description?: string;
  /** Per-field rounding override. If not set, uses profile-level rounding. */
  roundingMode?: RoundingMode;
  roundingPrecision?: RoundingPrecision;
}

export interface PricingProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  type: "high" | "low";
  fields: FieldConfig[];
  roundingMode?: RoundingMode;
  roundingPrecision?: RoundingPrecision;
  createdAt: string;
  updatedAt: string;
}

/* ====== HIGH-RISE DEFAULT FIELDS ====== */
export const HIGH_RISE_FIELDS: FieldConfig[] = [
  { key: "DienTichThongThuy", label: "Điện tích thông thuỷ", type: "input" },
  { key: "DonGiaDaVAT", label: "ĐG gồm VAT", type: "input" },
  { key: "DGDatPB", label: "ĐG đất phân bổ", type: "input" },
  {
    key: "DonGiaChuaVAT",
    label: "Đơn giá chưa VAT",
    type: "formula",
    formula: "DonGiaDaVAT - DGDatPB",
  },
  { key: "DonGiaSuDungDat", label: "Tiền sử dụng đất", type: "input" },
  {
    key: "TyLeVAT",
    label: "% VAT",
    type: "input",
    description: "Mặc định 10%",
  },
  {
    key: "TyLePhiBaoTri",
    label: "% PBT",
    type: "input",
    description: "Mặc định 2%",
  },
  {
    key: "DonGiaXayDung",
    label: "Đơn giá xây dựng",
    type: "formula",
    formula: "DonGiaChuaVAT - DonGiaSuDungDat",
  },
  {
    key: "TienVAT",
    label: "Tiền VAT",
    type: "formula",
    formula: "TongGiaChuaVAT * TyLeVAT / 100",
  },
  {
    key: "TongGiaDaVAT",
    label: "Tổng giá gồm VAT",
    type: "formula",
    formula: "DonGiaDaVAT * DienTichThongThuy",
  },
  {
    key: "TienPhiBaoTri",
    label: "Phí bảo trì",
    type: "formula",
    formula: "TongGiaChuaVAT * TyLePhiBaoTri / 100",
  },
  {
    key: "TongGiaChuaVAT",
    label: "Tổng giá chưa VAT",
    type: "formula",
    formula: "DonGiaChuaVAT * DienTichThongThuy",
  },
  {
    key: "TongThanhToan",
    label: "Tổng gồm VA+PBT",
    type: "formula",
    formula: "TongGiaDaVAT + TienPhiBaoTri",
  },
  { key: "GiaNaked", label: "Giá Naked", type: "input" },
];

/* ====== LOW-RISE DEFAULT FIELDS ====== */
export const LOW_RISE_FIELDS: FieldConfig[] = [
  { key: "DienTichDat", label: "Diện tích đất", type: "input" },
  { key: "DonGiaDat", label: "Đơn giá đất", type: "input" },
  {
    key: "GiaDatKoVAT",
    label: "Giá đất không VAT",
    type: "formula",
    formula: "DienTichDat * DonGiaDat",
  },
  {
    key: "TyLeVAT",
    label: "% VAT",
    type: "input",
    description: "Mặc định 10%",
  },
  {
    key: "VATDat",
    label: "Tiền VAT đất",
    type: "formula",
    formula: "GiaDatKoVAT * TyLeVAT / 100",
  },
  {
    key: "GiaDatChuaVAT",
    label: "Giá đất chưa VAT",
    type: "formula",
    formula: "GiaDatKoVAT - VATDat",
  },
  { key: "DonGiaSDDat", label: "Đơn giá SD đất", type: "input" },
  {
    key: "TienSDDat",
    label: "Tiền SD đất",
    type: "formula",
    formula: "DienTichDat * DonGiaSDDat",
  },
  { key: "DienTichXD", label: "Diện tích XD", type: "input" },
  {
    key: "TyLeVATXayDung",
    label: "% VAT XD",
    type: "input",
    description: "Mặc định 10%",
  },
  { key: "DonGiaXD", label: "Đơn giá XD", type: "input" },
  {
    key: "ThanhTienXD",
    label: "Thành tiền XD",
    type: "formula",
    formula: "DienTichXD * DonGiaXD",
  },
  {
    key: "TienVATXayDung",
    label: "Tiền VAT XD",
    type: "formula",
    formula: "ThanhTienXD * TyLeVATXayDung / 100",
  },
  {
    key: "ThanhTienVATXayDung",
    label: "Thành tiền VAT XD",
    type: "formula",
    formula: "ThanhTienXD + TienVATXayDung",
  },
  {
    key: "TongGiaTriHDMB",
    label: "Tổng giá trị HDMB",
    type: "formula",
    formula: "GiaDatKoVAT + VATDat + TienSDDat + ThanhTienVATXayDung",
  },
];

/* ====== DEFAULT PROFILES ====== */
export const defaultProfiles: PricingProfile[] = [
  {
    id: "hr-default",
    name: "Cấu hình mặc định - Cao tầng",
    description: "Cấu hình tính giá tiêu chuẩn cho sản phẩm cao tầng",
    isDefault: true,
    type: "high",
    fields: HIGH_RISE_FIELDS,
    createdAt: "2024-01-15",
    updatedAt: "2024-06-20",
  },
  {
    id: "lr-default",
    name: "Cấu hình mặc định - Thấp tầng",
    description: "Cấu hình tính giá tiêu chuẩn cho sản phẩm thấp tầng",
    isDefault: true,
    type: "low",
    fields: LOW_RISE_FIELDS,
    createdAt: "2024-01-15",
    updatedAt: "2024-06-20",
  },
];

/* ====== STORAGE KEY ====== */
const STORAGE_KEY = "beeland_pricing_profiles";

/** Load profiles from localStorage, fallback to defaults */
export function loadPricingProfiles(): PricingProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return defaultProfiles;
}

/** Save profiles to localStorage */
export function savePricingProfiles(profiles: PricingProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

/** Get the default profile for a given type */
export function getDefaultProfile(
  type: "high" | "low"
): PricingProfile | undefined {
  const profiles = loadPricingProfiles();
  return (
    profiles.find((p) => p.type === type && p.isDefault) ||
    profiles.find((p) => p.type === type)
  );
}

/** Get price fields from the default profile */
export function getDefaultPriceFields(type: "high" | "low"): FieldConfig[] {
  const profile = getDefaultProfile(type);
  return (
    profile?.fields || (type === "high" ? HIGH_RISE_FIELDS : LOW_RISE_FIELDS)
  );
}

/* ====== API MAPPING ======
 * API trả về mảng cấu hình; mỗi cấu hình có Detail[] với:
 *  { Code, Name, Formula, Type: "TUNHAP" | "CONGTHUC", OrderBy }
 * Hàm dưới đây convert sang FieldConfig[] để dùng chung với engine.
 */

export interface ApiPricingDetail {
  ID?: number;
  CauHinhId?: number;
  Code: string;
  Name: string;
  Formula?: string | null;
  Type: "TUNHAP" | "CONGTHUC" | string;
  OrderBy?: number;
}

export interface ApiPricingConfig {
  ID?: number;
  Name?: string;
  FormCode?: string;
  MaDA?: number;
  Status?: boolean;
  Detail?: ApiPricingDetail[];
}

/** Convert mảng Detail từ API thành FieldConfig[] (đã sort theo OrderBy). */
export function mapApiDetailToFields(
  detail: ApiPricingDetail[] = []
): FieldConfig[] {
  return [...detail]
    .sort((a, b) => (a.OrderBy ?? 0) - (b.OrderBy ?? 0))
    .map<FieldConfig>((d) => ({
      key: d.Code,
      label: d.Name,
      type: d.Type === "CONGTHUC" ? "formula" : "input",
      formula: d.Type === "CONGTHUC" ? d.Formula || "" : undefined,
    }));
}

/** Lấy cấu hình active đầu tiên (Status === true) trong response data. */
export function pickActiveConfig(
  list: ApiPricingConfig[] = [],
  idCauHinhTinhGia: any
): ApiPricingConfig | undefined {
  if (idCauHinhTinhGia) {
    const key = String(idCauHinhTinhGia);
    return (
      list.find((c) => String(c?.ID ?? "") === key) ||
      list.find((c) => c?.Status === true)
    );

  } else {
    return list.find((c) => c?.Status === true);
  }
}

/**
 * Tổng hợp: từ API response → FieldConfig[].
 * Nếu không có cấu hình active hoặc Detail rỗng, trả về defaults theo `type`.
 */
export function getPriceFieldsFromApi(
  apiData: ApiPricingConfig[] | undefined | null,
  type: "high" | "low",
  idCauHinhTinhGia
): FieldConfig[] {
  const active = pickActiveConfig(apiData || [], idCauHinhTinhGia);
  const fields = active?.Detail?.length
    ? mapApiDetailToFields(active.Detail)
    : [];
  if (fields.length) return fields;
  return [];
  //  type === "high" ? HIGH_RISE_FIELDS : LOW_RISE_FIELDS;
}

/* ====== FORMULA EVALUATOR ====== */

/**
 * Safely evaluate a formula string using data values.
 * Supports: +, -, *, /, (, ), and numeric literals.
 * Field keys are replaced by their numeric values from the data object.
 */
export function evaluateFormula(
  formula: string,
  data: Record<string, any>,
  allFields: FieldConfig[]
): number | null {
  if (!formula) return null;

  try {
    // Collect all field keys, sort by length desc to avoid partial replacement
    const fieldKeys = allFields
      .map((f) => f.key)
      .sort((a, b) => b.length - a.length);

    let expression = formula;
    for (const key of fieldKeys) {
      const regex = new RegExp(`\\b${key}\\b`, "g");
      const val = Number(data[key]);
      if (isNaN(val)) {
        expression = expression.replace(regex, "0");
      } else {
        expression = expression.replace(regex, String(val));
      }
    }

    // Also replace any remaining known area fields
    expression = expression.replace(
      /\bDienTichThongThuy\b/g,
      String(Number(data["DienTichThongThuy"]) || 0)
    );
    expression = expression.replace(
      /\bdien_tich\b/g,
      String(Number(data["DienTichThongThuy"] || data["DienTichDat"]) || 0)
    );

    // Validate: only allow digits, operators, parentheses, dots, spaces, commas, and function names round/floor/ceil
    if (!/^[\d\s+\-*/().,a-zA-Z_]+$/.test(expression)) return null;
    // Whitelist identifiers — only allow round/floor/ceil
    const identifiers = expression.match(/[a-zA-Z_]+/g) || [];
    for (const id of identifiers) {
      if (!["round", "floor", "ceil"].includes(id)) return null;
    }

    // Provide round/floor/ceil with optional precision: round(x), round(x, n)
    const round = (x: number, n: number = 0) => {
      const f = Math.pow(10, n);
      return Math.round(x * f) / f;
    };
    const floor = (x: number, n: number = 0) => {
      const f = Math.pow(10, n);
      return Math.floor(x * f) / f;
    };
    const ceil = (x: number, n: number = 0) => {
      const f = Math.pow(10, n);
      return Math.ceil(x * f) / f;
    };

    // eslint-disable-next-line no-new-func
    const result = new Function(
      "round",
      "floor",
      "ceil",
      `"use strict"; return (${expression});`
    )(round, floor, ceil);
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

/**
 * Given current data and field configs, compute all formula fields.
 * Handles dependency ordering by iterating multiple passes.
 */
export function applyRounding(
  val: number,
  mode: RoundingMode = "round",
  precision: RoundingPrecision = 0
): number {
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
  roundingPrecision: RoundingPrecision = 0
): Record<string, any> {
  const result = { ...data };
  const formulaFields = fields.filter((f) => f.type === "formula" && f.formula);

  // Multiple passes to resolve dependencies
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const field of formulaFields) {
      const val = evaluateFormula(field.formula!, result, fields);
      if (val !== null && val !== result[field.key]) {
        // Use per-field rounding if set, else fallback to profile-level
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

/* ====== ALIAS & INVERSE SOLVER ====== */

/** Các mã trường cùng ý nghĩa nhưng đặt tên khác nhau giữa các cấu hình */
export const FIELD_ALIASES: string[][] = [
  ["TongGomPBT", "TongThanhToan", "TongGiaTriHD", "TongCongPBT"],
  ["TienPhiBaoTri", "PhiBaoTri", "TienPBT"],
  ["DienTichTimTuong", "DTTimTuong", "DienTichTimTuong2"],
  ["DienTichThongThuy", "DTThongThuy"],
  ["TongGiaDat", "TongTienDatVAT"],
  ["ThanhTienVATXayDung", "TongGiaXDVAT"],
  ["DonGiaSuDungDat", "DonGiaSDDat"],
];

/** Trả về mã trường thực tế có trong cấu hình, chấp nhận các tên đồng nghĩa */
export function resolveFieldCode(
  fields: FieldConfig[],
  code: string
): string {
  if (fields.some((f) => f.key === code)) return code;
  const group = FIELD_ALIASES.find((g) => g.includes(code));
  if (group) {
    const found = fields.find((f) => group.includes(f.key));
    if (found) return found.key;
  }
  return code;
}

/** Thứ tự ưu tiên chọn trường nguồn khi tính ngược từ trường công thức */
const INVERSE_PRIORITY = [
  "DonGiaDaVAT",
  "DonGiaChuaVAT",
  "DonGiaDat",
  "DonGiaXD",
  "DonGiaSDDat",
  "DonGiaSuDungDat",
  "DGDatPB",
];

/**
 * Tính ngược: người dùng nhập giá trị cho 1 trường công thức, tìm trường nhập
 * tay nguồn để suy ra giá trị tương ứng (các công thức đều tuyến tính).
 */
export function solveInputForTarget(
  fields: FieldConfig[],
  data: Record<string, any>,
  targetKey: string,
  targetValue: any
): { key: string; value: number } | null {
  const target = fields.find((f) => f.key === targetKey);
  if (!target || target.type !== "formula" || !target.formula) return null;

  const inputs = new Set(
    fields.filter((f) => f.type !== "formula").map((f) => f.key)
  );
  const deps = new Set<string>();
  const visit = (key: string, depth = 0) => {
    if (depth > 8) return;
    if (inputs.has(key)) {
      deps.add(key);
      return;
    }
    const f = fields.find((x) => x.key === key);
    if (!f?.formula) return;
    const ids = f.formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    ids
      .filter((i) => !["round", "floor", "ceil"].includes(i))
      .forEach((i) => visit(i, depth + 1));
  };
  visit(targetKey);

  const ordered = [...deps]
    .filter((k) => !/^TyLe/i.test(k))
    .sort((a, b) => {
      const ia = INVERSE_PRIORITY.indexOf(a);
      const ib = INVERSE_PRIORITY.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  const goal = Number(targetValue) || 0;
  for (const driver of ordered) {
    const f0 = Number(
      computeAllFormulas({ ...data, [driver]: 0 }, fields, "none")[targetKey]
    );
    const f1 = Number(
      computeAllFormulas({ ...data, [driver]: 1 }, fields, "none")[targetKey]
    );
    const slope = f1 - f0;
    if (!isFinite(slope) || Math.abs(slope) < 1e-9) continue;
    const x = (goal - f0) / slope;
    if (!isFinite(x)) continue;
    return { key: driver, value: x };
  }
  return null;
}
