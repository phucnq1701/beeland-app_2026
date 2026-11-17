/**
 * Giá booking theo bảng giá – CHÉP TỪ WEB (web là chuẩn):
 *  - isLowRiseProduct:  beeland/src/utils/productType.ts
 *  - mapPriceListItem, pick: beeland/src/components/Products/BookingFormDialog.tsx
 *  - thứ tự bảng giá (priority tăng dần, giữ thứ tự máy chủ khi bằng): beeland/src/components/Sales/salesConfig/useSalesConfigOptions.ts
 * tests/booking-price.test.cjs so trực tiếp với code web. Không import gì để test nạp trực tiếp được.
 */

const LOW_RISE_KEYWORDS = [
  'thấp tầng',
  'thap tang',
  'liền kề',
  'lien ke',
  'biệt thự',
  'biet thu',
  'shophouse',
  'nhà phố',
  'nha pho',
  'townhouse',
  'villa',
];

const LOW_RISE_CODE_PREFIXES = ['LK', 'BT', 'SH', 'NP', 'VL', 'TH'];

function matchLowRiseText(v: any): boolean {
  if (!v || typeof v !== 'string') return false;
  const s = v.toLowerCase().trim();
  return LOW_RISE_KEYWORDS.some((k) => s.includes(k));
}

function matchLowRiseCode(code: any): boolean {
  if (!code || typeof code !== 'string') return false;
  const head = code.trim().toUpperCase().split(/[-_/\s]/)[0];
  return LOW_RISE_CODE_PREFIXES.includes(head);
}

/** Thấp tầng hay cao tầng – web gọi `isLowRiseProduct({ product: data, maSP: data?.KyHieu })`. */
export function isLowRiseProduct(input: { loaiSP?: string | null; product?: any; ttsp?: any; maSP?: string | null }): boolean {
  const { loaiSP, product, ttsp, maSP } = input;
  if (product?.FormCode === 'THAPTANG') return true;
  if (product?.FormCode === 'CAOTANG') return false;
  if (ttsp?.FormCode === 'THAPTANG') return true;
  if (ttsp?.FormCode === 'CAOTANG') return false;

  if (matchLowRiseText(loaiSP)) return true;
  if (matchLowRiseText(product?.product_type)) return true;
  if (matchLowRiseText(product?.TenLoaiBDS)) return true;
  if (matchLowRiseText(ttsp?.TenLoaiBDS)) return true;
  if (matchLowRiseText(ttsp?.TenLHBDS)) return true;

  if (matchLowRiseCode(maSP)) return true;
  if (matchLowRiseCode(product?.MaCan)) return true;
  if (matchLowRiseCode(product?.MaSoSP)) return true;
  if (matchLowRiseCode(product?.product_code)) return true;
  if (matchLowRiseCode(ttsp?.MaSoSP)) return true;
  if (matchLowRiseCode(ttsp?.MaCan)) return true;
  return false;
}
