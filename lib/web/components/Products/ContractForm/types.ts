// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { LoaiTienDoKey } from "../../../lib/tdttLoaiTienDo";
import type { UnitFundPreset } from "../../Sales/salesConfig/unitFundPriceList";
import type * as React from "react";
import type { GiaoDichKey } from "../../../lib/tdttGiaoDich";

export interface Policy {
  id: string;
  name: string;
  project_id: string | null;
}

export interface Discount {
  id: string;
  discount_order: number;
  discount_name: string;
  discount_percentage: number;
  discount_type: string;
  discount_form?: string;
}

export interface Product {
  id: string;
  code: string;
  project_name?: string;
  product_type?: string | null;
  zone: string | null;
  floor: number | null;
  area: number | null;
  price: number | null;
  // Low-rise product specific fields
  land_area?: number | null;
  land_unit_price?: number | null;
  construction_area?: number | null;
  total_floor_area?: number | null;
  construction_unit_price?: number | null;
  // Raw API fields (from backend payload)
  MaSP?: number;
  MaDA?: number;
  MaTT?: number;
  MaTang?: number;
  MaSan?: number;
  KyHieu?: string;
  TenDA?: string;
  Khu?: string;
  Tang?: string;
  TenViTri?: string;
  SoCanHo?: string;
  TenHuongBC?: string;
  TenHuongCua?: string;
  DienTichThongThuy?: number | null;
  DTTimDuong?: number | null;
  DonGiaChuaVAT?: number | null;
  DonGiaDaVAT?: number | null;
  TongGiaChuaVAT?: number | null;
  TongGiaDaVAT?: number | null;
  TyLeVAT?: number | null;
  TienVAT?: number | null;
  TyLePhiBaoTri?: number | null;
  TienPhiBaoTri?: number | null;
  TongGomPBT?: number | null;
  DonGiaXayDung?: number | null;
  HinhAnh?: string;
  TenTT?: string;
  SoPN?: number | null;
  MaSoPN?: number | null;
}

export interface ContractFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  type?: "deposit" | "contract" | "investment" | "pricesheet";
  type2?: string;
  filterCondition?: any;
  contractId?: string | null;
  /** MaPGC of an existing deposit/contract record to load via BanHangService.DatCoc.getByMaPGC */
  maPGC?: number | null;
  /**
   * Điền sẵn dữ liệu từ 1 chứng từ (đặt cọc / góp vốn / mua bán) theo MaPGC
   * nhưng vẫn coi là phiếu tính giá mới (không phải chế độ sửa chứng từ).
   */
  prefillMaPGC?: number | null;
  /** Flag: deposit form is opened from a Booking row → submit to add-booking-datcoc */
  fromBooking?: boolean;
  /** Prefill khách hàng từ MaKH (khi mở từ phiếu booking thiện chí). */
  initialMaKH?: number | string | null;
  /** Mã khách hàng (MaSoKH) của phiếu booking — dùng khi phiếu cũ không lưu uuid. */
  initialMaSoKH?: string | null;
  /** Số điện thoại khách hàng của phiếu booking — khóa tra cứu dự phòng. */
  initialDiDong?: string | null;
  /** Danh sách người đồng đứng tên (MaKH) lấy từ phiếu booking để điền sẵn. */
  initialCoOwnerIds?: Array<number | string | { MaKH?: any; ID?: any }> | null;
  /** Phiếu tính giá đã lưu trên cloud (payload + snapshot) để nạp lại khi sửa. */
  initialSheet?: any;
  /**
   * Dữ liệu thay đổi đã lưu của phụ lục (cột new_payload) — khi sửa phụ lục,
   * form nạp dữ liệu này đè lên dữ liệu hợp đồng gốc.
   */
  appendixPayload?: any;
  /** Số phụ lục đã lưu (sửa); trống = máy chủ sinh theo ký hiệu PHULUCHD. */
  appendixCode?: string | null;
  /** Loại phụ lục đã lưu (dm_phu_luc.id) khi sửa PL thay đổi HĐ; form trả lại qua onSaveSuccess({ appendixLoaiPl }). */
  appendixLoaiPl?: string | null;
  /** Tên loại phụ lục đã lưu — hiện khi mục không còn trong danh sách tải về */
  appendixLoaiPlTen?: string | null;
  /**
   * Id phiếu giữ chỗ (hoặc HĐ / phiếu cọc) của chứng từ đang lập PL thay đổi HĐ — ô Loại phụ lục lọc theo trạng thái phiếu (PLT2).
   * Trống ⇒ dùng `maPGC`.
   */
  appendixPgcId?: string | null;
  /**
   * uuid dòng vòng đời của HỢP ĐỒNG GỐC.
   * Có giá trị = đang lập HỢP ĐỒNG CHUYỂN NHƯỢNG cho hợp đồng đó.
   */
  maHDGoc?: string | null;
  /** Chứng từ đã duyệt: mở form chỉ để xem, khóa nút Lưu. */
  readOnly?: boolean;
  /** Quỹ căn + bảng giá theo bộ lọc lưới khi tạo phiếu mới; không truyền ⇒ Quỹ CĐT */
  unitFundPreset?: UnitFundPreset;
  /** Đổi tên TTĐC tạo phiếu mới (manual 178): khoá mọi bước trừ Khách hàng, Lưu ⇒ fn_deposit_rename_ttdc_save */
  renameTtdc?: import("../../../_stubs/components/Products/ContractForm/renameTtdc").RenameTtdcFormInput | null;
  /** Đổi căn TTĐC tạo phiếu mới (manual 188): Thêm đặt cọc căn mới, khoá bước Khách hàng, Lưu ⇒ fn_deposit_doi_can_ttdc_save */
  doiCanTtdc?: import("../../../_stubs/components/Products/ContractForm/doiCanTtdc").DoiCanTtdcFormInput | null;
  /** Phiếu tính giá: form chờ hàm này xong (trả Promise) rồi mới đóng */
  onSaveSuccess?: (res?: any) => void | Promise<unknown>;
}

export interface PaymentSchedule {
  id: number;
  dot: number;
  kieuThanhToan: string;
  tuongUngFormula?: string;
  tienVATFormula?: string;
  phiBaoTriFormula?: string;
  tongCongFormula?: string;
  tyLeTT: number;
  soTien: number;
  tyLeVAT: number;
  tienVAT: number;
  tyLeVATDat: number;
  tienVATDat: number;
  tyLePBT?: number;
  /** Thấp tầng: Tỷ lệ XD đợt (%) */
  tyLeXD?: number;
  tienXD: number;
  hasPBT?: boolean;
  tienBaoTri: number;
  /** Thấp tầng: Tiền XD gồm VAT của đợt (tùy chọn) */
  tienXDVAT?: number;
  tongGiaTri: number;
  /** Tiền cọc của đợt theo mẫu tiến độ (cột TienCoc) — công thức đợt sau đọc tổng qua biến TienCocPrev */
  tienCoc?: number;
  /** Loại tiến độ của đợt theo mẫu (HDMB | HDCN, null = chưa cấu hình) — lưu xuống cloud_pgc_dot_thanh_toan.loai_tien_do (hd-chuyen-nhuong-quy) */
  LoaiTienDo?: LoaiTienDoKey | null;
  /** Cao tầng: Vốn tự có / Vay NH của đợt — tỷ lệ theo mẫu tiến độ, số tiền theo công thức VonTuCo / VayNH của mẫu */
  tyLeVonTuCo?: number;
  vonTuCo?: number;
  vonTuCoFormula?: string;
  tyLeVayNH?: number;
  vayNH?: number;
  vayNHFormula?: string;
  /** Theo đợt mẫu tiến độ (manual 110): HDMB | HDCN | null, chữ 2 cột diễn giải — chỉ dùng cho phiếu in */
  loaiTienDo?: LoaiTienDoKey | null;
  dienGiaiTyLeTT?: string;
  dienGiaiThoiHanTT?: string;
  /** Thời hạn cách ngày gốc để tính ngày TT: số ngày, hoặc số tháng khi theoThang */
  soNgay?: number;
  /** Đợt mẫu TĐTT có Loại thời gian = Tháng (LoaiThoiGian "THANG") — soNgay là số tháng */
  theoThang?: boolean;
  /** Loại ngày của đợt mẫu TĐTT: 1 (8 cũ) = Ngày đặt cọc, 3 = Ngày giao dịch, 2 = cộng theo tháng — xem scheduleBaseKind */
  maLoaiNgay?: number | null;
  /** Giao dịch của đợt theo mẫu tiến độ ("BAN_GIAO" | "SO_DO") — chỉ để gắn thẻ, không lưu vào phiếu */
  giaoDich?: GiaoDichKey | null;
  /** Đợt khôi phục từ phiếu không khớp đợt mẫu (không biết số ngày / loại ngày) — giữ Ngày TT đã lưu, không tính lại */
  noDueConfig?: boolean;
  /** Ghi chú cho đợt thanh toán */
  ghiChu?: string;
  /** Ngày TT override (ISO string với offset +07:00). Nếu null sẽ tính từ ngayKy + soNgay */
  ngayTT?: string | null;
  /** Diễn giải đợt (pgc.lich_thanh_toan.DienGiai) */
  dienGiai?: string;
  /** Dòng khôi phục từ phiếu đã lưu — giữ nguyên số liệu cho tới khi sửa tài chính */
  restoredFromMaPGC?: boolean;
  /** Đợt dùng NextTongCong nhưng công thức các đợt phụ thuộc vòng, tính lặp chưa ổn định. Chỉ ở state, không lưu */
  canhBaoDotSau?: boolean;
}

/** Một bảng tiến độ dùng chung giao diện: "Lịch thanh toán" (lich) hoặc "Tiến độ HĐMB" (hdmb) */
export interface ScheduleSlot {
  key: "lich" | "hdmb";
  title: string;
  rows: PaymentSchedule[];
  setRows: React.Dispatch<React.SetStateAction<PaymentSchedule[]>>;
  templateId: string | null;
  selectTemplate: (id: string) => Promise<void>;
  loading: boolean;
  issues: string[];
  readOnly: boolean;
}

export interface CoOwner {
  id: string;
  type: "individual" | "business";
  maKH?: number | string | null;
  // Individual
  title: string;
  name: string;
  cmnd: string;
  ngayCap: Date | null;
  noiCap: string;
  phone: string;
  email: string;
  diaChi: string;
  diaChiLH: string;
  // Business
  tenDoanhNghiep: string;
  maSoThue: string;
  nguoiDaiDien: string;
  chucVu: string;
}

export interface Customer {
  id: string;
  maKH?: number | string | null;
  code: string;
  name: string;
  customer_type: string;
  mobile1: string | null;
  email: string | null;
  id_number: string | null;
  address: string | null;
  issue_date: string | null;
  issue_place: string | null;
  title?: string | null;
  tax_code: string | null;
}

export interface PromotionPolicy {
  id: string;
  name: string;
  gifts: PromotionGift[];
}

export interface PromotionGift {
  id: string;
  name: string;
  quantity: number;
  value: number;
}
