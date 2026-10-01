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

/** Bảng giá hiện hành sắp theo priority tăng dần (số nhỏ = ưu tiên cao), bằng nhau giữ thứ tự máy chủ. */
export function sortPriceLists<T extends { priority?: any }>(rows: T[]): T[] {
  return [...(rows || [])]
    .map((pl, i) => ({ pl, i }))
    .sort((a, b) => Number(a.pl?.priority ?? 9999) - Number(b.pl?.priority ?? 9999) || a.i - b.i)
    .map(({ pl }) => pl);
}

export type PriceListItem = {
  raw: any;
  DTThongThuy: number;
  DonGiaVAT: number;
  TongGiaChuaVAT: number;
  vatchtien: number;
  TongGiaGomVAT: number;
  PhiBaoTri: number;
  TongGiaGomPBT: number;
  DienTichDat: number;
  DonGiaDat: number;
  TongGiaDat: number;
  DienTichXD: number;
  DonGiaXD: number;
  ThanhTienXD: number;
  GiaTriHD: number;
};

/** Dòng giá của sản phẩm trong bảng giá (fn_get_price_list_item_by_product) → các khoản giá như web. */
export function mapPriceListItem(row: any): PriceListItem | null {
  if (!row) return null;
  const num = (v: any) => (v == null || v === '' ? 0 : Number(v));
  const area = num(row.area);
  const unitPrice = num(row.unit_price);
  const vatRate = num(row.vat_rate);
  const pbtRate = num(row.maintenance_rate);
  const beforeVat = row.total_before_vat != null ? num(row.total_before_vat) : area * unitPrice;
  const vatAmount = row.vat_amount != null ? num(row.vat_amount) : (beforeVat * vatRate) / 100;
  const afterVat = row.total_after_vat != null ? num(row.total_after_vat) : beforeVat + vatAmount;
  const pbt = row.maintenance_amount != null ? num(row.maintenance_amount) : (afterVat * pbtRate) / 100;
  const totalPayment = row.total_payment != null ? num(row.total_payment) : afterVat + pbt;
  const landTotal = row.land_total != null ? num(row.land_total) : area * num(row.land_unit_price);
  const constructionAmount =
    row.construction_amount != null ? num(row.construction_amount) : num(row.area_xd) * num(row.construction_unit_price);

  return {
    raw: row,
    DTThongThuy: area,
    DonGiaVAT: unitPrice ? unitPrice * (1 + vatRate / 100) : 0,
    TongGiaChuaVAT: beforeVat,
    vatchtien: vatAmount,
    TongGiaGomVAT: afterVat,
    PhiBaoTri: pbt,
    TongGiaGomPBT: totalPayment,
    DienTichDat: area,
    DonGiaDat: num(row.land_unit_price),
    TongGiaDat: landTotal,
    DienTichXD: num(row.area_xd),
    DonGiaXD: num(row.construction_unit_price),
    ThanhTienXD: constructionAmount,
    GiaTriHD: row.contract_total_value != null ? num(row.contract_total_value) : totalPayment,
  };
}

/** Web pick: giá bảng giá rỗng / 0 → dùng giá sản phẩm. */
export const pickPrice = (a: any, b: any) => (a == null || a === '' || Number(a) === 0 ? b : a);

/** Cấu hình bán hàng web tự chọn khi mở form booking. */
export type BookingSalesConfig = {
  priceListId: string | null;
  priceItem: PriceListItem | null;
  policy: { id?: any; pricing_config_id?: any; payment_schedule_id?: any; tien_booking?: any; TienBooking?: any } | null;
};

/** Tiền booking khai báo trong chính sách (web policyTienBooking); không có → null. */
export function policyBookingAmount(policy: BookingSalesConfig['policy']): number | null {
  const v = Number(policy?.TienBooking ?? policy?.tien_booking ?? 0);
  return v > 0 ? v : null;
}
