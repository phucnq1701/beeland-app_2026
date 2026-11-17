// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-appointment/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Đặt lịch ký — hàm map thuần (dòng RPC ↔ hình dạng UI), không gọi máy chủ/không đọc phiên. */

/** Giữ nguyên giờ người dùng nhập theo múi giờ VN (+07:00) khi lưu. */
export const toVNStore = (v: any): string | null => {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:(\d{2}))?/);
  if (m) return `${m[1]}T${m[2]}:${m[4] ?? "00"}+07:00`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Đọc ra chuỗi giờ VN (naive) để UI hiển thị đúng giờ đã nhập. */
export const fromVNStore = (v: any): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, c) => ((a[c.type] = c.value), a), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
};

export const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? n : null;
};

/** Mã chữ (danh mục Phương án thanh toán đặt lịch ký là mã chữ, mã cũ dạng số cũng lưu dạng chữ) — rỗng ⇒ null. */
export const code = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? s : null;
};

export const bool = (v: any): boolean | null =>
  v === true || v === false ? v : null;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Chỉ nhận giá trị uuid — các mã cũ dạng số/chuỗi trả về null. */
export const uid = (v: any): string | null => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : null;
};

/** Dòng lưới (fn_signing_appointment_list / dòng trả về sau khi ghi) -> object giống response API cũ */
export const listRowOut = (r: any): any => ({
  ID: Number(r.seq),
  UID: r.id ?? null,
  MaSPCode: r.ma_sp ?? null,
  State: r.state,
  IsPersonal: !!r.is_personal,
  NgayBookKy: fromVNStore(r.ngay_book_ky),
  MaDA: r.project_id,
  TenDA: r.ten_da ?? null,
  MaSP: r.san_pham_id ?? null,
  MaSanPham: r.san_pham_id ?? null,
  MaCan: r.ma_can ?? null,
  KyHieu: r.ma_can ?? null,
  MaPGC: r.phieu_giu_cho_id ?? null,
  SoPhieu: r.so_phieu ?? null,
  MaKH: r.khach_hang_id ?? null,
  TenKH: r.ten_kh ?? null,
  TenCongTy: r.is_personal ? null : r.ten_kh ?? null,
  /** Công ty của chứng từ (KHÁC TenCongTy = công ty của khách) */
  CompanyIdChungTu: r.company_id ?? null,
  TenCtyChungTu: r.ten_cong_ty ?? null,
  SoGiayTo: r.so_giay_to ?? null,
  SoCMND: r.is_personal ? r.so_giay_to ?? null : null,
  SoCCCD: r.is_personal ? r.so_giay_to ?? null : null,
  SoDKKD: r.is_personal ? null : r.so_giay_to ?? null,
  DiDong: r.dien_thoai ?? null,
  DienThoai: r.dien_thoai ?? null,
  Email: r.email ?? null,
  NgaySinh: r.ngay_sinh ?? null,
  ThuongTru: r.thuong_tru ?? null,
  DiaChi: r.dia_chi ?? null,
  DiaChiCT: r.dia_chi_ct ?? null,
  MaSan: r.san_id ?? null,
  TenSan: r.ten_san ?? null,
  DaiLy: r.ten_san ?? null,
  MaPhanLoaiKH: r.ma_phan_loai_kh,
  MaPhuongAnTT: code(r.ma_phuong_an_tt),
  /** Giao dịch có lịch thanh toán ⇒ hiện lịch đó thay phương án chọn tay (DK28–DK30) */
  PhuongAnTT: r.ten_lich_tt ?? r.ten_phuong_an_tt ?? null,
  MaLichTT: r.lich_tt_id ?? null,
  TenLichTT: r.ten_lich_tt ?? null,
  LaChuyenKhoan: r.la_chuyen_khoan,
  HinhThucTT:
    r.la_chuyen_khoan === true ? "Chuyển khoản" : r.la_chuyen_khoan === false ? "Tiền mặt" : null,
  CoBaoLanh: r.co_bao_lanh,
  BaoLanh:
    r.co_bao_lanh === true ? "Có bảo lãnh" : r.co_bao_lanh === false ? "Không bảo lãnh" : null,
  MaCa: r.ca_lam_viec_id ?? null,
  TenCa: r.ten_ca ?? null,
  LoaiThuTuc: r.loai_thu_tuc_id ?? null,
  TenLoaiThuTuc: r.ten_loai_thu_tuc ?? null,
  DiemKy: r.diem_ky_id ?? null,
  TenDiemKy: r.ten_diem_ky ?? null,
  DiaChiDiemKy: r.dia_chi_diem_ky ?? null,
  GhiChu: r.ghi_chu ?? null,
  NgayTao: r.created_at,
  CreatedAt: r.created_at,
  /** Nguồn lịch (luồng ký TTĐC); null = lịch cũ chưa gán nguồn */
  Nguon: (r.nguon === "DAT_COC" || r.nguon === "HOP_DONG" ? r.nguon : null) as "DAT_COC" | "HOP_DONG" | null,
  HopDongId: r.hop_dong_id ?? null,
  SoHopDong: r.so_hop_dong ?? null,
  LoaiHopDong: r.loai_hop_dong ?? null,
});

/** Dòng phiếu đặt cọc từ hàm máy chủ -> shape dùng trong form lịch ký. */
export const depositOut = (d: any) => ({
  MaPGC: d.id,
  SoPhieu: d.so_phieu ?? d.so_phieu_gc ?? null,
  SoPhieuGC: d.so_phieu_gc ?? null,
  MaDA: d.project_id,
  TenDA: d.ten_da ?? null,
  MaSP: d.san_pham_id,
  MaSanPham: d.ma_can ?? null,
  MaCan: d.ma_can ?? null,
  MaSPCode: d.ma_sp ?? null,
  MaKH: d.khach_hang_id,
  KhachHang: d.ten_kh ?? d.ten_cong_ty ?? "",
  TenKH: d.ten_kh ?? null,
  TenCongTy: d.ten_cong_ty ?? null,
  SoCCCD: d.cccd ?? null,
  DienThoai: d.dien_thoai ?? null,
  Email: d.email ?? null,
  /** Loại khách hàng chính của phiếu (cloud_customers.is_personal) */
  IsPersonal: d.is_personal !== false,
  MaSan: d.san_id,
  TenSan: d.ten_san ?? null,
  /** Người đồng đứng tên lấy từ tt_khach_hang.ListKhachHang của phiếu giữ chỗ */
  CoOwners: Array.isArray(d.co_owners) ? d.co_owners : [],
  /** Lịch thanh toán (tiến độ) của giao dịch — có thì ô Phương án thanh toán hiện lịch này và khoá (DK28–DK29) */
  MaLichTT: d.lich_tt_id ?? null,
  TenLichTT: d.ten_lich_tt ?? null,
  /** Kho hồ sơ của giao dịch (chỉ khi lấy 1 phiếu theo id) — lịch ký mới thừa hưởng (DK31–DK35) */
  HoSoGiaoDich: Array.isArray(d.ho_so) ? d.ho_so : [],
});
