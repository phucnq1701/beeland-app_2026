/**
 * Đặt lịch ký – logic thuần cho màn Danh sách / Chi tiết / ô chọn phiếu cọc (như web dat-lich-ky/types.ts + mapper của
 * SigningAppointmentCloudService: trạng thái, giờ VN, map dòng fn_signing_appointment_list / fn_signing_deposit_search, lịch).
 * Form Thêm / Sửa dùng thẳng logic web chép (lib/web — useWebSigningForm / useWebShiftPicker), không dùng tệp này.
 * Không import gì để test nạp trực tiếp được.
 */

export type SigningState = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type StatusTone = 'warning' | 'success' | 'danger';

export const STATUS_OPTIONS: { value: SigningState; label: string; tone: StatusTone }[] = [
  { value: 'PENDING', label: 'Chờ xác nhận', tone: 'warning' },
  { value: 'CONFIRMED', label: 'Đã xác nhận', tone: 'success' },
  { value: 'REJECTED', label: 'Từ chối', tone: 'danger' },
];

export function statusMeta(s: unknown) {
  const v = String(s || 'PENDING').toUpperCase();
  return STATUS_OPTIONS.find((o) => o.value === v) || STATUS_OPTIONS[0];
}

export type Option<T = any> = { value: T; label: string };

export const PHAN_LOAI_CN: Option<number>[] = [
  { value: 1, label: 'Khách hàng cá nhân' },
  { value: 2, label: 'Khách hàng đồng sở hữu vợ chồng' },
];
export const PHAN_LOAI_DN: Option<number>[] = [{ value: 3, label: 'Khách hàng doanh nghiệp' }];
export const PHAN_LOAI_ALL: Option<number>[] = [...PHAN_LOAI_CN, ...PHAN_LOAI_DN];
/** Lưu boolean: true = chuyển khoản, false = tiền mặt */
export const HINH_THUC_TT: Option<boolean>[] = [
  { value: false, label: 'Tiền mặt' },
  { value: true, label: 'Chuyển khoản' },
];
/** Lưu boolean: true = có, false = không */
export const BAO_LANH: Option<boolean>[] = [
  { value: true, label: 'Có bảo lãnh' },
  { value: false, label: 'Không bảo lãnh' },
];

export const labelOf = (list: Option[], v: unknown): string | undefined =>
  v == null ? undefined : list.find((o) => String(o.value) === String(v))?.label;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Chỉ nhận uuid – mã cũ dạng số/chuỗi → null (web uid()). */
export const uid = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return UUID_RE.test(s) ? s : null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean | null => (v === true || v === false ? v : null);

/* ---------------- Giờ Việt Nam ---------------- */

const VN_OFFSET = 7 * 3600 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Giữ nguyên giờ người dùng nhập theo +07:00 khi lưu. */
export function toVNStore(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:(\d{2}))?/);
  if (m) return `${m[1]}T${m[2]}:${m[4] ?? '00'}+07:00`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Giờ VN dạng naive "YYYY-MM-DDTHH:mm:ss" để hiển thị đúng giờ đã nhập. */
export function fromVNStore(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return new Date(d.getTime() + VN_OFFSET).toISOString().slice(0, 19);
}

export const dateKey = (naive: unknown): string => String(naive ?? '').slice(0, 10);
export const timeOf = (naive: unknown): string => String(naive ?? '').slice(11, 16);

/** "YYYY-MM-DD" theo giờ VN của thời điểm `nowMs`. */
export const todayVN = (nowMs: number): string => new Date(nowMs + VN_OFFSET).toISOString().slice(0, 10);

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export const quickDays = (from: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => addDays(from, i));

/** 0 = Thứ 2 … 6 = Chủ nhật */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Lưới tháng 6×7 bắt đầu Thứ 2 chứa ngày `anyDay`. */
export function monthGrid(anyDay: string): string[] {
  const first = `${anyDay.slice(0, 7)}-01`;
  const start = addDays(first, -weekdayIndex(first));
  return quickDays(start, 42);
}

export function addMonths(anyDay: string, n: number): string {
  const [y, m] = anyDay.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-01`;
}

/* ---------------- Dòng dữ liệu ---------------- */

export type SigningRow = {
  ID: number;
  UID: string | null;
  State: SigningState;
  IsPersonal: boolean;
  NgayBookKy: string | null;
  MaDA: string | null;
  TenDA: string | null;
  MaSP: string | null;
  MaCan: string | null;
  MaPGC: string | null;
  SoPhieu: string | null;
  MaKH: string | null;
  TenKH: string | null;
  SoGiayTo: string | null;
  DienThoai: string | null;
  Email: string | null;
  MaSan: string | null;
  DaiLy: string | null;
  MaPhanLoaiKH: number | null;
  PhanLoai: string | null;
  MaPhuongAnTT: unknown;
  LaChuyenKhoan: boolean | null;
  HinhThucTT: string | null;
  CoBaoLanh: boolean | null;
  BaoLanh: string | null;
  MaCa: string | null;
  TenCa: string | null;
  LoaiThuTuc: string | null;
  TenLoaiThuTuc: string | null;
  GhiChu: string | null;
  CreatedAt: string | null;
};

/** 1 dòng fn_signing_appointment_list / fn_signing_appointment_get → dữ liệu hiển thị. */
export function mapListRow(r: any): SigningRow {
  const isPersonal = !!r?.is_personal;
  const lck = bool(r?.la_chuyen_khoan);
  const cbl = bool(r?.co_bao_lanh);
  const phanLoai = num(r?.ma_phan_loai_kh);
  return {
    ID: Number(r?.seq),
    UID: r?.id ?? null,
    State: statusMeta(r?.state).value,
    IsPersonal: isPersonal,
    NgayBookKy: fromVNStore(r?.ngay_book_ky),
    MaDA: r?.project_id ?? null,
    TenDA: r?.ten_da ?? null,
    MaSP: r?.san_pham_id ?? null,
    MaCan: r?.ma_can ?? null,
    MaPGC: r?.phieu_giu_cho_id ?? null,
    SoPhieu: r?.so_phieu ?? null,
    MaKH: r?.khach_hang_id ?? null,
    TenKH: r?.ten_kh ?? null,
    SoGiayTo: r?.so_giay_to ?? r?.cccd ?? null,
    DienThoai: r?.dien_thoai ?? null,
    Email: r?.email ?? null,
    MaSan: r?.san_id ?? null,
    DaiLy: r?.ten_san ?? null,
    MaPhanLoaiKH: phanLoai,
    PhanLoai: labelOf(PHAN_LOAI_ALL, phanLoai) ?? null,
    MaPhuongAnTT: r?.ma_phuong_an_tt ?? null,
    LaChuyenKhoan: lck,
    HinhThucTT: labelOf(HINH_THUC_TT, lck) ?? null,
    CoBaoLanh: cbl,
    BaoLanh: labelOf(BAO_LANH, cbl) ?? null,
    MaCa: r?.ca_lam_viec_id ?? null,
    TenCa: r?.ten_ca ?? null,
    LoaiThuTuc: r?.loai_thu_tuc_id ?? null,
    TenLoaiThuTuc: r?.ten_loai_thu_tuc ?? null,
    GhiChu: r?.ghi_chu ?? null,
    CreatedAt: r?.created_at ?? null,
  };
}

export type Attachment = { fileName: string; url: string; uploadedAt?: string };

export const isImageFile = (name: unknown): boolean =>
  /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(String(name ?? '').split('?')[0]);

/** Link tệp: URL đầy đủ giữ nguyên, link tương đối (.NET) gắn máy chủ upload.beesky.vn (như DocumentService). */
export function fileUrl(raw: unknown): string {
  const link = String(raw ?? '').trim();
  if (!link) return '';
  return /^https?:\/\//i.test(link) ? link : `https://upload.beesky.vn/${link.replace(/^\/+/, '')}`;
}

export const fileExt = (name: unknown): string =>
  (String(name ?? '').split('?')[0].split('.').pop() || '').toLowerCase();

/** Phiếu đặt cọc (fn_signing_deposit_search) → dữ liệu dùng trong form. */
export function mapDeposit(d: any) {
  return {
    MaPGC: d?.id ?? null,
    SoPhieu: d?.so_phieu ?? d?.so_phieu_gc ?? null,
    SoPhieuGC: d?.so_phieu_gc ?? null,
    MaDA: d?.project_id ?? null,
    TenDA: d?.ten_da ?? null,
    MaSP: d?.san_pham_id ?? null,
    MaCan: d?.ma_can ?? null,
    MaKH: d?.khach_hang_id ?? null,
    KhachHang: d?.ten_kh ?? d?.ten_cong_ty ?? '',
    DienThoai: d?.dien_thoai ?? null,
    SoCCCD: d?.cccd ?? null,
    IsPersonal: d?.is_personal !== false,
    MaSan: d?.san_id ?? null,
    TenSan: d?.ten_san ?? null,
    /** Người đồng đứng tên lấy từ tt_khach_hang.ListKhachHang của phiếu giữ chỗ */
    CoOwners: (Array.isArray(d?.co_owners) ? d.co_owners : []) as any[],
  };
}
export type Deposit = ReturnType<typeof mapDeposit>;

/* ---------------- Lịch ---------------- */

export function groupByDay<T extends { NgayBookKy?: string | null }>(rows: T[]) {
  const byDay: Record<string, T[]> = {};
  const noDate: T[] = [];
  for (const r of rows) {
    const k = r?.NgayBookKy ? dateKey(r.NgayBookKy) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) {
      noDate.push(r);
      continue;
    }
    (byDay[k] ||= []).push(r);
  }
  for (const k of Object.keys(byDay)) byDay[k].sort((a, b) => String(a.NgayBookKy).localeCompare(String(b.NgayBookKy)));
  return { byDay, noDate };
}
