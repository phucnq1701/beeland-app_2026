// ⚠️ TỰ SINH — bản chép nguyên văn web src/pages/sales/giao-dich/dat-lich-ky/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
export interface SelectOption {
  value: any;
  label: string;
  raw?: any;
}

export interface FormOptions {
  deposits: SelectOption[];
  agencies: SelectOption[];
  plans: SelectOption[];
  httt: SelectOption[];
  phanLoaiKH?: SelectOption[];
  loading?: boolean;
  searchingDeposit?: boolean;
  onSearchDeposit?: (kw: string) => void;
  onPickDeposit?: (val: any) => void;
  editingId?: number | null;
  /** Đại lý đăng nhập: khóa ô "Đại lý phụ trách" theo sàn của tài khoản */
  lockAgency?: boolean;
  /** Khoá ô "Chọn đặt cọc" (mở từ phiếu đặt cọc hoặc đang sửa) */
  lockDeposit?: boolean;
  /** Khối tìm/chọn khách hàng dùng chung (Booking thiện chí / Đặt cọc) */
  customerSlot?: React.ReactNode;
  /** Khối khách hàng đồng sở hữu dùng chung */
  coOwnerSlot?: React.ReactNode;
}

export const EMPTY_OPTS: FormOptions = {
  deposits: [],
  agencies: [],
  plans: [],
  httt: [],
};

export type CustomerKind = "individual" | "enterprise";

/** Nguồn lịch ký — lập tại chứng từ cụ thể (spec 2026-11-12-luong-ky-ttdc-trang-thai) */
export type SigningSourceKind = "DAT_COC" | "HOP_DONG";
export type SigningSource =
  | { kind: "DAT_COC"; pgcId: string }
  | { kind: "HOP_DONG"; contractId: string; loai: "HDMB" | "HDGV"; pgcId: string };
export type SigningState = "PENDING" | "CONFIRMED" | "REJECTED";

export const STATUS_OPTIONS: {
  value: SigningState;
  label: string;
  color: string;
}[] = [
  { value: "PENDING", label: "Chờ xác nhận", color: "gold" },
  { value: "CONFIRMED", label: "Đã xác nhận", color: "green" },
  { value: "REJECTED", label: "Từ chối", color: "red" },
];

/** `APPROVED` (máy chủ vẫn nhận ở fn_signing_appointment_set_state, DB có dòng cũ) hiển thị như `CONFIRMED` */
export const statusMeta = (s?: string) => {
  const v = String(s || "PENDING").toUpperCase();
  const key = (v === "APPROVED" ? "CONFIRMED" : v) as SigningState;
  return STATUS_OPTIONS.find((o) => o.value === key) || STATUS_OPTIONS[0];
};

export interface SigningRow {
  ID: number;
  IsPersonal: boolean;
  State?: string;
  MaCan?: string;
  TenKH?: string;
  DienThoai?: string;
  Email?: string;
  SoGiayTo?: string;
  NgaySinh?: string;
  ThuongTru?: string;
  /** Địa chỉ liên hệ — doanh nghiệp ưu tiên địa chỉ công ty */
  DiaChiLH?: string;
  PhanLoai?: string;
  DaiLy?: string;
  /** Điểm ký (theo bộ cấu hình của ca) */
  TenDiemKy?: string;
  MaSan?: any;
  MaPhuongAnTT?: any;
  PhuongAnTT?: string;
  HinhThucTT?: string;
  BaoLanh?: string;
  NgayBookKy?: string;
  GhiChu?: string;
  SoPhieu?: string | null;
  /** Nguồn lịch; null = lịch cũ chưa gán nguồn */
  Nguon?: SigningSourceKind | null;
  HopDongId?: string | null;
  SoHopDong?: string | null;
  raw: Record<string, any>;
}


export const PHAN_LOAI_CN: SelectOption[] = [
  { value: 1, label: "Khách hàng cá nhân" },
  { value: 2, label: "Khách hàng đồng sở hữu vợ chồng" },
];
export const PHAN_LOAI_DN: SelectOption[] = [
  { value: 3, label: "Khách hàng doanh nghiệp" },
];
export const GIOI_TINH: SelectOption[] = [
  { value: "Nam", label: "Nam" },
  { value: "Nữ", label: "Nữ" },
  { value: "Khác", label: "Khác" },
];
/** Hình thức thanh toán lưu boolean: true = chuyển khoản, false = tiền mặt */
export const HINH_THUC_TT_FALLBACK: SelectOption[] = [
  { value: false, label: "Tiền mặt" },
  { value: true, label: "Chuyển khoản" },
];
/** Bảo lãnh lưu boolean: true = có, false = không */
export const BAO_LANH: SelectOption[] = [
  { value: true, label: "Có bảo lãnh" },
  { value: false, label: "Không bảo lãnh" },
];

export const PHAN_LOAI_ALL: SelectOption[] = [...PHAN_LOAI_CN, ...PHAN_LOAI_DN];

export const labelOf = (list: SelectOption[], v: any) =>
  list.find((o) => String(o.value) === String(v))?.label;

export const mapRow = (it: any): SigningRow => {
  const isPersonal = it?.IsPersonal ?? true;
  return {
    ID: it?.ID ?? it?.Id ?? it?.MaDLK,
    IsPersonal: isPersonal,
    State: it?.State ?? "PENDING",
    MaCan: it?.MaCan ?? it?.KyHieu,
    TenKH: isPersonal
      ? it?.TenKH ?? it?.KhachHang
      : it?.TenCongTy ?? it?.TenKH ?? it?.KhachHang,
    DienThoai: isPersonal
      ? it?.DiDong ?? it?.DienThoai
      : it?.DienThoaiCT ?? it?.DienThoaiCongTy ?? it?.DiDong ?? it?.DienThoai,
    Email: isPersonal ? it?.Email : it?.EmailCT ?? it?.EmailCongTy ?? it?.Email,
    SoGiayTo: isPersonal
      ? it?.SoCMND ?? it?.SoCCCD ?? it?.CCCD
      : it?.SoDKKD ?? it?.MaSoThueCT ?? it?.MaSoThue,
    NgaySinh: it?.NgaySinh || undefined,
    ThuongTru: it?.ThuongTru || undefined,
    DiaChiLH: (isPersonal ? it?.DiaChi : it?.DiaChiCT || it?.DiaChi) || undefined,
    PhanLoai:
      it?.TenPhanLoaiKH ??
      it?.PhanLoaiKH ??
      labelOf(PHAN_LOAI_ALL, it?.MaPhanLoaiKH),
    DaiLy: it?.TenSan ?? it?.TenCTVT ?? it?.DaiLy,
    TenDiemKy: it?.TenDiemKy ?? undefined,
    MaSan: it?.MaSan ?? it?.MaCTVT ?? null,
    MaPhuongAnTT: it?.MaPhuongAnTT ?? it?.MaPATT ?? null,
    PhuongAnTT: it?.TenPhuongAnTT ?? it?.PhuongAnTT,

    HinhThucTT:
      it?.TenHinhThucTT ??
      it?.HinhThucTT ??
      labelOf(HINH_THUC_TT_FALLBACK, it?.MaHinhThucTT),
    BaoLanh: it?.TenBaoLanh ?? it?.BaoLanh ?? labelOf(BAO_LANH, it?.MaBaoLanh),
    NgayBookKy: it?.NgayBookKy,
    GhiChu: it?.GhiChu,
    SoPhieu: it?.SoPhieu ?? null,
    Nguon: it?.Nguon === "DAT_COC" || it?.Nguon === "HOP_DONG" ? it.Nguon : null,
    HopDongId: it?.HopDongId ?? null,
    SoHopDong: it?.SoHopDong ?? null,
    raw: it || {},
  };
};
