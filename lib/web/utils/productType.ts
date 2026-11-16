// ⚠️ TỰ SINH — bản chép nguyên văn web src/utils/productType.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Phát hiện sản phẩm là Thấp tầng hay Cao tầng từ nhiều nguồn dữ liệu khác nhau
 * (props, formData, API response).
 *
 * Thấp tầng bao gồm: Liền kề (LK), Biệt thự (BT), Shophouse (SH),
 * Nhà phố (NP), Villa, Townhouse.
 * Cao tầng bao gồm: Chung cư (CC/CH/A/B/C), Căn hộ.
 */
const LOW_RISE_KEYWORDS = [
  "thấp tầng",
  "thap tang",
  "liền kề",
  "lien ke",
  "biệt thự",
  "biet thu",
  "shophouse",
  "nhà phố",
  "nha pho",
  "townhouse",
  "villa",
];

const LOW_RISE_CODE_PREFIXES = ["LK", "BT", "SH", "NP", "VL", "TH"];

function matchLowRiseText(v: any): boolean {
  if (!v || typeof v !== "string") return false;
  const s = v.toLowerCase().trim();
  return LOW_RISE_KEYWORDS.some((k) => s.includes(k));
}

function matchLowRiseCode(code: any): boolean {
  if (!code || typeof code !== "string") return false;
  const head = code.trim().toUpperCase().split(/[-_/\s]/)[0];
  return LOW_RISE_CODE_PREFIXES.includes(head);
}

export interface IsLowRiseInput {
  loaiSP?: string | null;
  product?: any;
  ttsp?: any;
  maSP?: string | null;
}

export function isLowRiseProduct(input: IsLowRiseInput): boolean {
  const { loaiSP, product, ttsp, maSP } = input;

  // 1) FormCode khẳng định loại
  if (product?.FormCode === "THAPTANG") return true;
  if (product?.FormCode === "CAOTANG") return false;
  if (ttsp?.FormCode === "THAPTANG") return true;
  if (ttsp?.FormCode === "CAOTANG") return false;

  // 2) Text fields
  if (matchLowRiseText(loaiSP)) return true;
  if (matchLowRiseText(product?.product_type)) return true;
  if (matchLowRiseText(product?.TenLoaiBDS)) return true;
  if (matchLowRiseText(ttsp?.TenLoaiBDS)) return true;
  if (matchLowRiseText(ttsp?.TenLHBDS)) return true;

  // 3) Mã sản phẩm prefix
  if (matchLowRiseCode(maSP)) return true;
  if (matchLowRiseCode(product?.MaCan)) return true;
  if (matchLowRiseCode(product?.MaSoSP)) return true;
  if (matchLowRiseCode(product?.product_code)) return true;
  if (matchLowRiseCode(ttsp?.MaSoSP)) return true;
  if (matchLowRiseCode(ttsp?.MaCan)) return true;

  return false;
}
