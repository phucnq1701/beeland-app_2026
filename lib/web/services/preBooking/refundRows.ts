// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/refundRows.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Dòng phiếu hoàn của BOOKING GIỮ CHỖ (bảng `cloud_booking_refunds`) ánh xạ sang cấu trúc dùng chung
 * của màn "Hoàn booking". Dùng chung cho `fn_booking_refund_list` (khối `__src = 'BOOKING'`).
 * `company_id` / `ten_cong_ty` của máy chủ là công ty của CHỨNG TỪ ⇒ `CompanyIdChungTu` / `TenCtyChungTu`
 * (không phải công ty của khách).
 */
const STATE_MAP: Record<string, string> = {
  PENDING: "PENDING",
  APPROVED: "REFUNDED",
  REJECTED: "REJECTED",
};

export const mapBookingRefundRow = (r: any) => ({
  __src: "BOOKING",
  ID: r.id,
  MaPhieuHoan: r.id,
  MaBooking: r.ma_pgc,
  MaPGC: r.ma_pgc,
  SoPhieu: r.so_phieu,
  KyHieu: r.so_phieu || r.ky_hieu,
  MaSanPham: r.ky_hieu,
  TenKH: r.ten_kh,
  DiDong: r.di_dong,
  TenDA: r.ten_da,
  SoTien: Number(r.so_tien) || 0,
  TienGiuCho: Number(r.so_tien) || 0,
  NgayHoan: r.ngay_hoan,
  GhiChu: r.ly_do,
  NguoiTao: r.nguoi_tao,
  CreatedAt: r.created_at,
  State: STATE_MAP[String(r.trang_thai || "").toUpperCase()] || "PENDING",
  CompanyIdChungTu: r.company_id ?? null,
  TenCtyChungTu: r.ten_cong_ty ?? "",
  SoPhieuChi: r.so_phieu_chi ?? null,
  TrangThaiPhieuChi: r.trang_thai_phieu_chi ?? null,
});
