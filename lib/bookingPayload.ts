/**
 * Payload tạo booking (BookingService.createBooking) từ dữ liệu màn tạo booking.
 * product = ProductService.normalizeProduct (uuid sản phẩm ở "ID"), có thể kèm LockId khi đi từ màn lock.
 * Trường giá theo web: beeland/src/components/Products/BookingFormDialog.tsx (payload gửi addBookingAPI).
 * Không import gì để test nạp trực tiếp được.
 */
export function buildBookingPayload(
  product: any,
  customer: { maKH?: any; tenKH?: any; diDong?: any; email?: any },
  san: { ID?: any; MaSan?: any; TenSan?: any } | null
) {
  const p = product || {};
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

    MaKH: customer?.maKH,
    TenKH: customer?.tenKH,
    DiDong: customer?.diDong,
    Email: customer?.email || "",
  };
}
