// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/print/templates/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { loaiTienDoKey } from "../../../../lib/tdttLoaiTienDo";

/**
 * Danh sách mẫu xuất phiếu tính giá (mẫu cố định trong code — người dùng chỉ chọn, không sửa).
 * Thêm mẫu mới: thêm 1 file trong thư mục này + 1 dòng vào PRICE_SHEET_TEMPLATES.
 */
export interface PriceSheetTemplateDef {
  key: string;
  name: string;
  /** Chỉ các công ty (mã công ty đăng ký, chữ thường) này thấy mẫu; bỏ trống = mọi công ty */
  companies?: string[];
  /** Ẩn mẫu với các công ty này (mẫu đã được thay bằng mẫu riêng) */
  exceptCompanies?: string[];
  /** Mẫu có ô "Tiêu chuẩn bàn giao" */
  needsHandoverStandard?: boolean;
  /** Mẫu có ô "Chương trình HTLS" (thời gian hỗ trợ lãi suất) */
  needsHtlsProgram?: boolean;
}

export const LEGACY_TEMPLATE_KEY = "mac-dinh";
export const BRG_KHONG_VAY = "brg-khong-vay";
export const BRG_CO_VAY = "brg-co-vay";
export const BRG_CN_KHONG_VAY = "brg-cn-khong-vay";
export const BRG_CN_CO_VAY = "brg-cn-co-vay";
/** Khoá mẫu cũ (10 đợt cố định) — phiếu đã lưu khoá này in bằng mẫu Không vay */
export const BRG_TT_THONG_THUONG_CDT = "brg-tt-thong-thuong-cdt";
const KEY_ALIASES: Record<string, string> = { [BRG_TT_THONG_THUONG_CDT]: BRG_KHONG_VAY };
export const PRICE_SHEET_TEMPLATES: PriceSheetTemplateDef[] = [
  { key: LEGACY_TEMPLATE_KEY, name: "Mẫu mặc định", exceptCompanies: ["brg"] },
  // beesky1 = công ty gốc (xem mọi công ty) — để kiểm thử
  {
    key: BRG_KHONG_VAY,
    name: "BRG – Không vay (không tham gia HTLS)",
    companies: ["brg", "beesky1"],
    needsHandoverStandard: true,
  },
  {
    key: BRG_CO_VAY,
    name: "BRG – Có vay (tham gia HTLS)",
    companies: ["brg", "beesky1"],
    needsHandoverStandard: true,
    needsHtlsProgram: true,
  },
  {
    key: BRG_CN_KHONG_VAY,
    name: "BRG – Chuyển nhượng, không vay",
    companies: ["brg", "beesky1"],
    needsHandoverStandard: true,
  },
  {
    key: BRG_CN_CO_VAY,
    name: "BRG – Chuyển nhượng, có vay",
    companies: ["brg", "beesky1"],
    needsHandoverStandard: true,
  },
];

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

export function templatesForCompany(companyCode: string | null | undefined): PriceSheetTemplateDef[] {
  const c = norm(companyCode);
  return PRICE_SHEET_TEMPLATES.filter(
    (t) => (!t.companies || t.companies.includes(c)) && !(t.exceptCompanies || []).includes(c)
  );
}

/** Mẫu mặc định của công ty = mẫu đầu tiên công ty được dùng. */
export function defaultTemplateKey(companyCode: string | null | undefined): string {
  return templatesForCompany(companyCode)[0]?.key ?? LEGACY_TEMPLATE_KEY;
}

export function findTemplate(key: string | null | undefined): PriceSheetTemplateDef | undefined {
  const k = KEY_ALIASES[String(key ?? "")] ?? key;
  return PRICE_SHEET_TEMPLATES.find((t) => t.key === k);
}

/** Mẫu dùng khi in: mẫu đã lưu trên phiếu, chưa lưu thì mẫu mặc định của công ty đang đăng nhập. */
export function resolveTemplateKey(saved: unknown, companyCode: string | null | undefined): string {
  const k = typeof saved === "string" ? saved : "";
  return findTemplate(k)?.key ?? defaultTemplateKey(companyCode);
}

/** Chuyển nhượng = tiến độ có cả đợt HĐCN và đợt HĐMB; đợt để trống loại không tính */
export function isChuyenNhuong(rows: ReadonlyArray<{ loaiTienDo?: unknown }>): boolean {
  const loai = new Set((rows || []).map((r) => loaiTienDoKey(r?.loaiTienDo)).filter(Boolean));
  return loai.size >= 2;
}

/**
 * Mẫu xuất của phiếu, tự xác định theo tiến độ (người dùng không chọn): công ty có mẫu BRG ⇒ Chuyển nhượng hay CĐT theo
 * Loại tiến độ, Có vay khi có đợt Vay NH% > 0. Công ty khác ⇒ mẫu mặc định.
 */
export function autoTemplateKey(
  rows: ReadonlyArray<{ loaiTienDo?: unknown; tyLeVayNH?: unknown }>,
  companyCode: string | null | undefined
): string {
  if (!templatesForCompany(companyCode).some((t) => t.key === BRG_KHONG_VAY)) return defaultTemplateKey(companyCode);
  const coVay = (rows || []).some((r) => (Number(r?.tyLeVayNH) || 0) > 0);
  if (isChuyenNhuong(rows)) return coVay ? BRG_CN_CO_VAY : BRG_CN_KHONG_VAY;
  return coVay ? BRG_CO_VAY : BRG_KHONG_VAY;
}
