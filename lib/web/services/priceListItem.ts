// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/priceListItem.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Số của bảng giá, trống thì null (khác 0) */
const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

/** a − b khi cả hai đều có, còn lại null */
const diff = (a: unknown, b: unknown): number | null => {
  const x = num(a);
  const y = num(b);
  return x === null || y === null ? null : x - y;
};

/** a + b khi cả hai đều có, còn lại null */
const sum = (a: unknown, b: unknown): number | null => {
  const x = num(a);
  const y = num(b);
  return x === null || y === null ? null : x + y;
};

/**
 * Dòng `price_list_items` sang tên trường form đang đọc. Có bảng giá thì số tiền lấy theo bảng giá:
 * tiền VAT, phí bảo trì, tổng gồm PBT để trống thì tính từ các tổng của chính dòng đó, để form
 * không rơi về số của bản ghi sản phẩm.
 */
export function mapPriceListItem(row: any): Record<string, any> {
  return {
    ...row,
    MaSP: row.product_code,
    KyHieu: row.product_code,
    DTThongThuy: row.area,
    DienTichTimTuong: row.area_tim_tuong,
    DienTichDat: row.area,
    DienTichXD: row.area_xd,
    vatch: row.vat_rate,
    vatchtien: num(row.vat_amount) ?? diff(row.total_after_vat, row.total_before_vat),
    PTPhiBaoTri: row.maintenance_rate,
    PhiBaoTri: num(row.maintenance_amount) ?? diff(row.total_payment, row.total_after_vat),
    DonGiaChuaVAT: row.unit_price,
    DonGiaVAT: row.unit_price_vat,
    TongGiaChuaVAT: row.total_before_vat,
    TongGiaGomVAT: row.total_after_vat,
    TongGiaGomPBT: num(row.total_payment) ?? sum(row.total_after_vat, row.maintenance_amount),
    DonGiaDatPhanBo: row.land_alloc_price,
    DonGiaDatChuaVAT: row.land_alloc_price,
    DonGiaXD: row.construction_unit_price,
    TienSuDungDat: row.land_use_total ?? row.land_use_amount,
    ThanhTienXD: row.construction_amount,
    DonGiaDat: row.land_unit_price,
    GiaDatChuaVAT: row.land_before_vat,
    VATDat: row.land_vat_amount,
    TongGiaDat: row.land_total,
    TyLeVATXayDung: row.construction_vat_rate,
    TienVATXayDung: row.construction_vat_amount,
    ThanhTienVATXayDung: row.construction_total_after_vat,
    TongGiaTriHDMB: row.contract_total_value,
    SoTang: row.floor_count,
    GhiChu: row.note,
  };
}
