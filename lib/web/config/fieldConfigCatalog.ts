// ⚠️ TỰ SINH — bản chép nguyên văn web src/config/fieldConfigCatalog.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Danh mục form + trường có thể cấu hình Bắt buộc / Ẩn / Chỉ xem / Chế độ xem (che).
 * Mọi key phải có ô thật trên form; luật xem src/lib/fieldConfigRules.ts.
 */
import type { FieldScope } from "../services/fieldConfig/types";

export interface FieldItem {
  key: string;
  label: string;
  group?: string;
  /** Luôn bắt buộc (code / backend đòi): luôn hiện, không Ẩn / Chỉ xem được */
  locked?: boolean;
  /** Chỉ Ẩn / Chỉ xem (vd cờ boolean) */
  noRequire?: boolean;
  /** Chỉ kiểm bắt buộc khi trường đang hiện */
  when?: (v: Record<string, any>) => boolean;
  /** Mặc định cả hai */
  scopes?: FieldScope[];
  /**
   * Loại giá trị cho Chế độ xem (che): text (mặc định) / date ⇒ 4 kiểu che; ref (danh mục) / image ⇒ chỉ "Che toàn bộ".
   */
  type?: "text" | "date" | "ref" | "image";
  /** Form che ở máy chủ nhưng trường này chưa có cột ⇒ chưa che được (icon mờ) */
  noMaskServer?: boolean;
}

export interface FieldForm {
  key: string;
  name: string;
  module: string;
  path?: string;
  scopes: FieldScope[];
  /** false ⇒ không hiện ở màn cấu hình */
  wired: boolean;
  /** Là biến thể của form khác — không liệt kê riêng */
  variantOnly?: boolean;
  variants?: { key: string; label: string }[];
  /** Máy chủ đã che theo Chế độ xem (đợt 1: khách hàng) — form khác: lưu được cấu hình nhưng chưa có tác dụng */
  maskServer?: boolean;
  fields: FieldItem[];
}

/** MaPhanLoaiKH của Book ký doanh nghiệp (SigningDrawer: kind === "enterprise" ? 3 : 1) */
// Callers must pass MaPhanLoaiKH derived from the drawer's `kind` (3 = enterprise).
export const SIGNING_ENTERPRISE_PHAN_LOAI = 3;
const isEnterprise = (v: Record<string, any>) =>
  Number(v?.MaPhanLoaiKH) === SIGNING_ENTERPRISE_PHAN_LOAI;
const hasForm = (v: Record<string, any>) => !!v?.FormCode;
const isHighRise = (v: Record<string, any>) => v?.FormCode === "CAOTANG";

const BOTH: FieldScope[] = ["SYSTEM", "AGENCY"];
const SYS: FieldScope[] = ["SYSTEM"];

export const FIELD_FORMS: FieldForm[] = [
  {
    key: "customer",
    name: "Khách hàng (cá nhân / tổ chức)",
    module: "CRM",
    path: "/customers/list",
    scopes: BOTH,
    wired: true,
    maskServer: true,
    variants: [
      { key: "customer", label: "Cá nhân" },
      { key: "customer_org", label: "Doanh nghiệp" },
    ],
    fields: [
      { key: "TenKH", label: "Họ và tên", group: "Cá nhân" },
      { key: "MaQD", label: "Danh xưng", group: "Cá nhân", type: "ref" },
      { key: "MaSoKH", label: "Mã khách hàng", group: "Cá nhân" },
      { key: "NgaySinh", label: "Ngày sinh", group: "Cá nhân", type: "date" },
      { key: "SoCMND", label: "Số CMND/CCCD", group: "Giấy tờ" },
      { key: "NgayCap", label: "Ngày cấp", group: "Giấy tờ", type: "date" },
      { key: "NoiCap", label: "Nơi cấp", group: "Giấy tờ" },
      { key: "MaSoTTNCN", label: "Số thuế TNCN", group: "Giấy tờ" },
      { key: "SoTaiKhoan", label: "Số tài khoản", group: "Ngân hàng" },
      { key: "TenNganHang", label: "Ngân hàng", group: "Ngân hàng" },
      { key: "HdLienQuanId", label: "HĐ liên quan", group: "Phân loại", type: "ref" },
      { key: "MoiQuanHeId", label: "Mối quan hệ", group: "Phân loại", type: "ref" },
      { key: "DiDong", label: "Số điện thoại", group: "Liên hệ" },
      { key: "DiDong2", label: "Số điện thoại 2", group: "Liên hệ" },
      { key: "Email", label: "Email", group: "Liên hệ" },
      { key: "Email2", label: "Email 2", group: "Liên hệ" },
      { key: "MaTinh", label: "Tỉnh/TP thường trú", group: "Liên hệ", type: "ref" },
      { key: "MaXa", label: "Phường/Xã thường trú", group: "Liên hệ", type: "ref" },
      { key: "ThuongTru", label: "Địa chỉ thường trú", group: "Liên hệ" },
      { key: "DiaChi", label: "Địa chỉ liên hệ", group: "Liên hệ" },
      { key: "MaNguon", label: "Nguồn khách hàng", group: "Phân loại", type: "ref" },
      { key: "MaTT", label: "Trạng thái", group: "Phân loại", type: "ref" },
      { key: "AnhCCCDTruoc", label: "Ảnh CCCD mặt trước", group: "Giấy tờ", type: "image" },
      { key: "AnhCCCDSau", label: "Ảnh CCCD mặt sau", group: "Giấy tờ", type: "image" },
    ],
  },
  {
    // Biến thể "Doanh nghiệp" của form Khách hàng — cấu hình RIÊNG
    key: "customer_org",
    name: "Khách hàng doanh nghiệp",
    module: "CRM",
    path: "/customers/list",
    scopes: BOTH,
    wired: true,
    maskServer: true,
    variantOnly: true,
    fields: [
      { key: "MaSoKH", label: "Mã khách hàng", group: "Thông tin doanh nghiệp" },
      { key: "TenCongTy", label: "Tên doanh nghiệp", group: "Thông tin doanh nghiệp" },
      { key: "MaSoThueCT", label: "Mã số thuế", group: "Thông tin doanh nghiệp" },
      { key: "DiaChiCT", label: "Địa chỉ trụ sở", group: "Thông tin doanh nghiệp" },
      { key: "MaTT", label: "Trạng thái", group: "Thông tin doanh nghiệp", type: "ref" },
      { key: "MaNguon", label: "Nguồn khách hàng", group: "Thông tin doanh nghiệp", type: "ref" },
      { key: "DienThoaiCT", label: "Số điện thoại", group: "Thông tin doanh nghiệp" },
      { key: "EmailCT", label: "Email", group: "Thông tin doanh nghiệp" },
      { key: "FaxCT", label: "Fax", group: "Thông tin doanh nghiệp", noMaskServer: true },
      { key: "SoGPKD", label: "Số GPKD", group: "Giấy phép kinh doanh" },
      { key: "NoiCapGDKKD", label: "Nơi cấp GDKKD", group: "Giấy phép kinh doanh" },
      { key: "NgayCapGDKKD", label: "Ngày cấp GDKKD", group: "Giấy phép kinh doanh", type: "date" },
      { key: "NguoiDaiDienPL", label: "Họ và tên", group: "Người đại diện pháp luật" },
      { key: "ChucVu", label: "Chức vụ", group: "Người đại diện pháp luật" },
      { key: "NDDDienThoai", label: "Số điện thoại", group: "Người đại diện pháp luật" },
      { key: "NDDEmail", label: "Email", group: "Người đại diện pháp luật" },
      { key: "NDDSoCCCD", label: "Số CCCD", group: "Người đại diện pháp luật" },
      { key: "NDDNgayCap", label: "Ngày cấp", group: "Người đại diện pháp luật", type: "date" },
      { key: "NDDNoiCap", label: "Nơi cấp", group: "Người đại diện pháp luật" },
      { key: "NDDThuongTru", label: "Địa chỉ thường trú", group: "Người đại diện pháp luật" },
      { key: "NDDDiaChiLH", label: "Địa chỉ liên lạc", group: "Người đại diện pháp luật" },
      { key: "NguoiUyQuyenList", label: "Người được ủy quyền", group: "Người được ủy quyền", type: "ref", noMaskServer: true },
    ],
  },
  {
    key: "pre_booking",
    name: "Booking thiện chí",
    module: "Bán hàng",
    path: "/sales/pre-bookings",
    scopes: BOTH,
    wired: true,
    fields: [
      { key: "MaKH", label: "Khách hàng", group: "Thông tin chung", locked: true },
      { key: "MaDA", label: "Dự án", group: "Thông tin chung", locked: true },
      { key: "FormCode", label: "Loại bất động sản", group: "Thông tin chung" },
      { key: "MaSan", label: "Sàn / Đại lý", group: "Thông tin chung", scopes: SYS },
      { key: "TienGiuCho", label: "Tiền booking", group: "Thông tin chung" },
      { key: "HanBooking", label: "Hạn booking", group: "Thông tin chung" },
      { key: "GhiChu", label: "Ghi chú", group: "Thông tin chung" },
      { key: "MaKhoangGia", label: "Khoảng giá", group: "Nguyện vọng", when: hasForm },
      { key: "MaDienTich", label: "Khoảng diện tích", group: "Nguyện vọng", when: hasForm },
      { key: "LoaiCans", label: "Loại căn", group: "Nguyện vọng", when: hasForm },
      { key: "Huongs", label: "Hướng", group: "Nguyện vọng", when: hasForm },
      { key: "Views", label: "View", group: "Nguyện vọng", when: hasForm },
      { key: "MaKhu", label: "Khu (cao tầng)", group: "Nguyện vọng", when: isHighRise },
      { key: "Tangs", label: "Tầng (cao tầng)", group: "Nguyện vọng", when: isHighRise },
      { key: "KhoangTangs", label: "Khoảng tầng (cao tầng)", group: "Nguyện vọng", when: isHighRise },
      { key: "Vitris", label: "Vị trí (cao tầng)", group: "Nguyện vọng", when: isHighRise },
      { key: "TaiLieus", label: "Tài liệu đính kèm", group: "Hồ sơ" },
    ],
  },
  {
    key: "signing",
    name: "Book ký hợp đồng",
    module: "Bán hàng",
    path: "/sales/signing-appointments",
    scopes: BOTH,
    wired: true,
    fields: [
      { key: "MaPGC", label: "Phiếu đặt cọc", group: "Thông tin book ký" },
      { key: "MaSan", label: "Đại lý phụ trách", group: "Thông tin book ký" },
      { key: "MaCan", label: "Mã căn", group: "Thông tin book ký" },
      { key: "NgayBookKy", label: "Ngày giờ book ký", group: "Thông tin book ký" },
      { key: "MaCa", label: "Ca book ký", group: "Thông tin book ký", locked: true },
      { key: "LoaiThuTuc", label: "Loại thủ tục", group: "Thông tin book ký", locked: true },
      { key: "MaPhanLoaiKH", label: "Phân loại khách hàng", group: "Thông tin book ký", noRequire: true },
      { key: "TenKH", label: "Tên công ty", group: "Doanh nghiệp", when: isEnterprise },
      { key: "SoDKKD", label: "Số ĐKKD", group: "Doanh nghiệp", when: isEnterprise },
      { key: "DkkdNgayCap", label: "Ngày cấp ĐKKD", group: "Doanh nghiệp", when: isEnterprise },
      { key: "DkkdNoiCap", label: "Nơi cấp ĐKKD", group: "Doanh nghiệp", when: isEnterprise },
      { key: "TruSo", label: "Trụ sở", group: "Doanh nghiệp", when: isEnterprise },
      { key: "NguoiDaiDien", label: "Người đại diện", group: "Doanh nghiệp", when: isEnterprise },
      { key: "ChucVu", label: "Chức vụ", group: "Doanh nghiệp", when: isEnterprise },
      { key: "NgaySinh", label: "Ngày sinh", group: "Người đại diện", when: isEnterprise },
      { key: "SoCMND", label: "Số CCCD / Hộ chiếu", group: "Người đại diện", when: isEnterprise },
      { key: "NgayCap", label: "Ngày cấp", group: "Người đại diện", when: isEnterprise },
      { key: "NoiCap", label: "Nơi cấp", group: "Người đại diện", when: isEnterprise },
      { key: "DienThoai", label: "Điện thoại", group: "Liên hệ", when: isEnterprise },
      { key: "Email", label: "Email", group: "Liên hệ", when: isEnterprise },
      { key: "DiaChiTT", label: "Địa chỉ thường trú", group: "Liên hệ", when: isEnterprise },
      { key: "DiaChiLH", label: "Địa chỉ liên hệ", group: "Liên hệ", when: isEnterprise },
      { key: "CoOwners", label: "Đồng sở hữu", group: "Doanh nghiệp", scopes: SYS, when: (v) => !!v.CoOwnerSlot },
      { key: "MaPhuongAnTT", label: "Phương án thanh toán", group: "Thanh toán" },
      { key: "LaChuyenKhoan", label: "Hình thức thanh toán (chuyển khoản)", group: "Thanh toán", noRequire: true },
      { key: "CoBaoLanh", label: "Bảo lãnh", group: "Thanh toán", noRequire: true },
      { key: "GhiChu", label: "Ghi chú", group: "Thanh toán" },
    ],
  },
  {
    key: "booking_name_change",
    name: "Đổi tên booking",
    module: "Bán hàng",
    path: "/sales/pre-booking-name-changes",
    scopes: BOTH,
    wired: true,
    fields: [
      { key: "MaKHMoi", label: "Khách hàng mới (có sẵn)", group: "Khách hàng mới", locked: true },
      { key: "DienGiai", label: "Lý do đổi tên", group: "Khách hàng mới" },
      { key: "TaiLieus", label: "Hình ảnh / tài liệu", group: "Khách hàng mới" },
    ],
  },
  {
    key: "booking_refund",
    name: "Hoàn booking",
    module: "Bán hàng",
    path: "/sales/booking-refunds",
    scopes: BOTH,
    wired: true,
    fields: [
      { key: "NgayHoan", label: "Ngày tạo phiếu hoàn", group: "Phiếu hoàn" },
      { key: "SoTien", label: "Số tiền hoàn", group: "Phiếu hoàn" },
      { key: "HinhThuc", label: "Hình thức hoàn", group: "Phiếu hoàn" },
      { key: "LyDo", label: "Lý do hoàn", group: "Phiếu hoàn" },
      { key: "SoTaiKhoan", label: "Số tài khoản nhận", group: "Ngân hàng", when: (v) => v?.HinhThuc === 1 },
      { key: "NganHang", label: "Ngân hàng", group: "Ngân hàng", when: (v) => v?.HinhThuc === 1 },
      { key: "GhiChu", label: "Ghi chú", group: "Phiếu hoàn" },
    ],
  },
  {
    key: "booking_merge",
    name: "Gộp booking",
    module: "Bán hàng",
    path: "/sales/booking-merges",
    scopes: BOTH,
    wired: true,
    fields: [
      { key: "BookingGop", label: "Booking được gộp", group: "Gộp phiếu", locked: true },
      { key: "GhiChu", label: "Ghi chú gộp phiếu", group: "Gộp phiếu" },
    ],
  },
  {
    key: "booking_extra_payment",
    name: "Nộp tiền bổ sung",
    module: "Bán hàng",
    path: "/sales/booking-extra-payments",
    scopes: BOTH,
    wired: true,
    fields: [
      { key: "NgayNop", label: "Ngày nộp", group: "Phiếu nộp" },
      { key: "SoTien", label: "Số tiền nộp bổ sung", group: "Phiếu nộp" },
      { key: "HinhThuc", label: "Hình thức nộp", group: "Phiếu nộp" },
      { key: "SoTaiKhoan", label: "Số tài khoản", group: "Ngân hàng", when: (v) => v?.HinhThuc === "CK" },
      { key: "NganHang", label: "Ngân hàng", group: "Ngân hàng", when: (v) => v?.HinhThuc === "CK" },
      { key: "NoiDung", label: "Nội dung", group: "Phiếu nộp" },
    ],
  },

  /* ---- Chưa gắn cấu hình (wired: false) — làm đợt sau ---- */
  {
    key: "contract",
    name: "Hợp đồng",
    module: "Hợp đồng",
    path: "/contracts/list",
    scopes: SYS,
    wired: false,
    fields: [
      { key: "SoHopDong", label: "Số hợp đồng" },
      { key: "NgayHopDong", label: "Ngày hợp đồng" },
      { key: "MaKH", label: "Khách hàng" },
      { key: "MaSP", label: "Sản phẩm" },
      { key: "GiaTriHopDong", label: "Giá trị hợp đồng" },
      { key: "MaCSBH", label: "Chính sách bán hàng" },
      { key: "MaTienDo", label: "Lịch thanh toán" },
      { key: "MaNVKD", label: "Nhân viên kinh doanh" },
      { key: "MaDaiLy", label: "Đại lý" },
    ],
  },
  {
    key: "booking",
    name: "Giữ chỗ từ bảng giá",
    module: "Bán hàng",
    path: "/sales/bookings",
    scopes: BOTH,
    wired: false,
    fields: [
      { key: "MaKH", label: "Khách hàng có sẵn", group: "Khách hàng" },
      { key: "TenKH", label: "Tên khách hàng", group: "Khách hàng" },
      { key: "SoCMND", label: "Số CMND/CCCD", group: "Khách hàng" },
      { key: "DiDong", label: "Di động", group: "Khách hàng" },
      { key: "Email", label: "Email", group: "Khách hàng" },
      { key: "DiaChi", label: "Địa chỉ", group: "Khách hàng" },
      { key: "MaSan", label: "Sàn giao dịch", group: "Giữ chỗ" },
      { key: "MaSP", label: "Sản phẩm", group: "Giữ chỗ", scopes: SYS },
      { key: "SoTien", label: "Số tiền giữ chỗ", group: "Giữ chỗ", scopes: SYS },
      { key: "NgayDatCho", label: "Ngày giữ chỗ", group: "Giữ chỗ", scopes: SYS },
      { key: "GhiChu", label: "Ghi chú", group: "Giữ chỗ", scopes: SYS },
    ],
  },
  {
    key: "deposit",
    name: "Đặt cọc",
    module: "Bán hàng",
    path: "/sales/deposits",
    scopes: SYS,
    wired: false,
    fields: [
      { key: "MaKH", label: "Khách hàng", group: "Thông tin cọc" },
      { key: "MaSP", label: "Sản phẩm", group: "Thông tin cọc" },
      { key: "MaSan", label: "Sàn / Đại lý", group: "Thông tin cọc" },
      { key: "MaNVKD", label: "Nhân viên kinh doanh", group: "Thông tin cọc" },
      { key: "SoTienCoc", label: "Số tiền cọc", group: "Thông tin cọc" },
      { key: "NgayCoc", label: "Ngày cọc", group: "Thông tin cọc" },
      { key: "NgayHetHan", label: "Ngày hết hạn", group: "Thông tin cọc" },
      { key: "MaPhuongAnTT", label: "Phương án thanh toán", group: "Thanh toán" },
      { key: "MaHinhThucTT", label: "Hình thức thanh toán", group: "Thanh toán" },
      { key: "MaCSBH", label: "Chính sách bán hàng", group: "Thanh toán" },
      { key: "MaKhuyenMai", label: "Quà tặng", group: "Thanh toán" },
      { key: "GhiChu", label: "Ghi chú", group: "Thanh toán" },
    ],
  },
  {
    key: "product",
    name: "Sản phẩm",
    module: "Sản phẩm",
    path: "/products/list",
    scopes: SYS,
    wired: false,
    fields: [
      { key: "MaSP", label: "Mã sản phẩm" },
      { key: "TenSP", label: "Tên sản phẩm" },
      { key: "MaDA", label: "Dự án" },
      { key: "DienTich", label: "Diện tích" },
      { key: "DonGia", label: "Đơn giá" },
      { key: "Huong", label: "Hướng" },
    ],
  },
  {
    key: "employee",
    name: "Nhân viên",
    module: "Hệ thống",
    path: "/system/employees",
    scopes: SYS,
    wired: false,
    fields: [
      { key: "HoTen", label: "Họ tên" },
      { key: "DienThoai", label: "Điện thoại" },
      { key: "Email", label: "Email" },
      { key: "MaPhongBan", label: "Phòng ban" },
      { key: "MaChucVu", label: "Chức vụ" },
    ],
  },
  {
    key: "agency",
    name: "Đại lý",
    module: "Đại lý",
    path: "/agencies",
    scopes: SYS,
    wired: false,
    fields: [
      { key: "TenDaiLy", label: "Tên đại lý" },
      { key: "MaSoThue", label: "Mã số thuế" },
      { key: "NguoiDaiDien", label: "Người đại diện" },
      { key: "DienThoai", label: "Điện thoại" },
      { key: "Email", label: "Email" },
      { key: "DiaChi", label: "Địa chỉ" },
    ],
  },
  {
    key: "receipt",
    name: "Phiếu thu / chi",
    module: "Tài chính",
    path: "/finance/cashbook",
    scopes: SYS,
    wired: false,
    fields: [
      { key: "SoPhieu", label: "Số phiếu" },
      { key: "NgayPhieu", label: "Ngày phiếu" },
      { key: "MaKH", label: "Khách hàng" },
      { key: "SoTien", label: "Số tiền" },
      { key: "LyDo", label: "Lý do / Diễn giải" },
      { key: "HinhThucTT", label: "Hình thức thanh toán" },
    ],
  },
  {
    key: "booking_product_change",
    name: "Đổi căn",
    module: "Bán hàng",
    path: "/sales/deposit-product-changes",
    scopes: BOTH,
    wired: false,
    fields: [
      { key: "MaGioHang", label: "Giỏ hàng", group: "Sản phẩm" },
      { key: "MaSPMoi", label: "Sản phẩm mới", group: "Sản phẩm" },
      { key: "LyDo", label: "Lý do đổi căn", group: "Hồ sơ" },
    ],
  },
];

export const findFieldForm = (key: string): FieldForm | undefined =>
  FIELD_FORMS.find((f) => f.key === key);

/** Form hiện ở màn cấu hình theo scope (chỉ wired, không liệt kê biến thể riêng) */
export const formsForScope = (scope: FieldScope): FieldForm[] =>
  FIELD_FORMS.filter((f) => f.wired && !f.variantOnly && f.scopes.includes(scope));

/** Trường của form theo scope ([] nếu form không có scope đó) */
export const fieldsForScope = (form: FieldForm, scope: FieldScope): FieldItem[] =>
  form.scopes.includes(scope)
    ? form.fields.filter((f) => !f.scopes || f.scopes.includes(scope))
    : [];
