/**
 * Payload tạo booking (BookingService.createBooking) từ dữ liệu màn tạo booking.
 * product = ProductService.normalizeProduct (uuid sản phẩm ở "ID"), có thể kèm LockId khi đi từ màn lock.
 * Trường giá theo web: beeland/src/components/Products/BookingFormDialog.tsx (payload gửi addBookingAPI).
 * Có bảng giá (cấu hình web tự chọn) → mọi khoản giá lấy theo bảng giá, khoản rỗng/0 lấy giá sản phẩm (web pick).
 */
import { BookingSalesConfig, pickPrice, policyBookingAmount } from './bookingPrice';

export function buildBookingPayload(
  product: any,
  customer: { maKH?: any; tenKH?: any; diDong?: any; email?: any },
  san: { ID?: any; MaSan?: any; TenSan?: any } | null,
  sales: BookingSalesConfig | null = null
) {
  const p = product || {};
  const base = productPricePayload(p);
  const pi: any = sales?.priceItem || null;
  const policy = sales?.policy || null;
  const prices = pi
    ? {
        TongGiaGomPBT: pickPrice(pi.TongGiaGomPBT, base.TongGiaGomPBT),
        DTThongThuy: pickPrice(pi.DTThongThuy, base.DTThongThuy),
        DonGiaTT: pickPrice(pi.DonGiaVAT, base.DonGiaTT),
        DonGiaChuaVAT: pickPrice(pi.raw?.unit_price, base.DonGiaChuaVAT),
        TongGiaChuaVAT: pickPrice(pi.TongGiaChuaVAT, base.TongGiaChuaVAT),
        TienVAT: pickPrice(pi.vatchtien, base.TienVAT),
        TongGiaGomVAT: pickPrice(pi.TongGiaGomVAT, base.TongGiaGomVAT),
        PhiBaoTri: pickPrice(pi.PhiBaoTri, base.PhiBaoTri),
        DienTichDat: pickPrice(pi.DienTichDat, base.DienTichDat),
        DonGiaDat: pickPrice(pi.DonGiaDat, base.DonGiaDat),
        TongGiaDat: pickPrice(pi.TongGiaDat, base.TongGiaDat),
        DienTichXD: pickPrice(pi.DienTichXD, base.DienTichXD),
        DonGiaXD: pickPrice(pi.DonGiaXD, base.DonGiaXD),
        ThanhTienXD: pickPrice(pi.ThanhTienXD, base.ThanhTienXD),
      }
    : base;
  return {
    MaSP: p.MaSP,
    // normalizeProduct trả uuid sản phẩm ở "ID"
    SanPhamId: p.ID ?? p.id ?? p.Id ?? null,
    // Web LockList → LockId: để máy chủ giải phóng đúng phiếu lock này
    LockId: p.LockId ?? null,
    KyHieu: p.KyHieu,
    MaSan: san?.ID || san?.MaSan || null,
    TenSan: san?.TenSan || null,
    MaKhu: p.MaKhu || null,
    TenKhu: p.TenKhu || null,
    MaDA: p.MaDA,
    TenDA: p.TenDA,
    ...prices,
    // Bảng giá / chính sách / cấu hình tính giá / tiến độ như web salesConfigPayload
    MaDotGia: sales?.priceListId ?? null,
    MaCS: policy?.id != null ? String(policy.id) : null,
    MaCSTong: policy?.pricing_config_id != null ? String(policy.pricing_config_id) : null,
    MaTDTT: policy?.payment_schedule_id != null ? String(policy.payment_schedule_id) : null,
    // Tiền booking theo chính sách (ưu tiên trước cài đặt bán hàng – web policyTienBooking)
    TienGiuCho: policyBookingAmount(policy),

    MaKH: customer?.maKH,
    TenKH: customer?.tenKH,
    DiDong: customer?.diDong,
    Email: customer?.email || "",
  };
}

/** Giá lấy trên sản phẩm (khi không có bảng giá / khoản bảng giá rỗng). */
function productPricePayload(p: any) {
  return {
    TongGiaGomPBT: p.TongGiaTriHDMB ?? p.TongGomPBT ?? 0,
    DTThongThuy: p.DTThongThuy || p.DienTichThongThuy || 0,
    DonGiaTT: p.DonGiaThongThuy || p.DonGia || 0,
    // Web gửi cả giá trước VAT / tiền VAT / đơn giá trước VAT
    DonGiaChuaVAT: p.DonGiaChuaVAT ?? null,
    TongGiaChuaVAT: p.TongGiaChuaVAT ?? null,
    TienVAT: p.TienVAT ?? p.vatchtien ?? null,
    TongGiaGomVAT: p.TongGiaGomVAT ?? p.TongGiaTriHDMB ?? 0,
    PhiBaoTri: p.PhiBaoTri ?? p.TienPhiBaoTri ?? 0,
    DienTichDat: p.DienTichDat || 0,
    DonGiaDat: p.DonGiaDat || 0,
    TongGiaDat: p.ThanhTienDat || p.TongGiaDat || 0,
    DienTichXD: p.DienTichXD || 0,
    DonGiaXD: p.DonGiaXD || 0,
    ThanhTienXD: p.ThanhTienXD || 0,
  };
}
