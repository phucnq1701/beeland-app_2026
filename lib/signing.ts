/**
 * Đặt lịch ký – logic thuần, như web:
 *  - beeland/src/pages/sales/giao-dich/dat-lich-ky/types.ts (trạng thái, phân loại, hình thức TT, bảo lãnh)
 *  - beeland/src/services/SigningAppointmentCloudService.ts (giờ VN, map dòng, toRow/upcert)
 *  - beeland/src/services/SigningShiftConfigService.ts (availabilityByDate)
 *  - beeland/src/pages/sales/giao-dich/dat-lich-ky/ShiftPickerFields.tsx (ca còn lượt, ca sắp hết)
 *  - beeland/src/config/requiredFieldCatalog.ts (signing / agency_signing)
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

/** Ghép ngày + "HH:mm" thành giờ naive. */
export const withTime = (key: string, hhmm: string | null | undefined): string =>
  `${key}T${/^\d{2}:\d{2}/.test(String(hhmm ?? '')) ? String(hhmm).slice(0, 5) : '00:00'}:00`;

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

/** "DD/MM" */
export const ddmm = (key: string): string => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : '');

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

export const depositLabel = (d: Partial<Deposit>): string =>
  `${d.SoPhieu || '—'} | ${d.KhachHang || ''}${d.MaCan ? ` | ${d.MaCan}` : ''}`;

/** Có người đồng đứng tên → 2, khách doanh nghiệp → 3, còn lại 1 (web phanLoaiFromDeposit). */
export const phanLoaiFromDeposit = (d: { IsPersonal?: boolean } | null | undefined, coOwners: number): number =>
  coOwners > 0 ? 2 : d?.IsPersonal === false ? 3 : 1;

/* ---------------- Ca làm việc ---------------- */

export type ShiftSlot = {
  id: string;
  name: string;
  from: string;
  to: string;
  capacity: number;
  used: number;
  remaining: number;
};

/** Chỉ hiện ca còn lượt; luôn giữ ca đang chọn (máy chủ có thể loại ca mà chính phiếu này đã đặt). */
export function shiftOptions(slots: ShiftSlot[], selectedId: string | null | undefined, selectedName: string | null | undefined) {
  const out = slots
    .filter((s) => s.remaining > 0 || s.id === selectedId)
    .map((s) => ({ id: s.id, label: `${s.name} (${s.from}-${s.to})`, slot: s as ShiftSlot | null }));
  if (selectedId && !out.some((o) => o.id === selectedId)) {
    out.unshift({ id: selectedId, label: selectedName || 'Ca đã chọn', slot: null });
  }
  return out;
}

/** Ca sắp hết: còn ≤ 20% sức chứa (tối thiểu 1). */
export const isLowSlot = (s: { capacity: number; remaining: number }): boolean =>
  s.remaining <= Math.max(1, Math.round(s.capacity * 0.2));

/**
 * Số lượt còn trống theo ngày (web availabilityByDate): tổng sức chứa ca đang dùng có khai báo loại thủ tục,
 * trừ lịch ký (không tính Từ chối) rơi vào các ca đó trong ngày (giờ VN).
 */
export function availabilityFrom(shifts: any[], appointments: any[], procedureId: string | null, days: string[]) {
  const out: Record<string, number> = {};
  if (!procedureId) return out;
  const valid = shifts.filter(
    (s) => s?.is_active !== false && Array.isArray(s?.procedure_ids) && s.procedure_ids.map(String).includes(String(procedureId))
  );
  const allow = new Set(valid.map((s) => String(s.id)));
  const capacity = valid.reduce((sum, s) => sum + (Number(s.so_khach) || 0), 0);
  const used: Record<string, number> = {};
  for (const a of appointments) {
    if (String(a?.state || '').toUpperCase() === 'REJECTED') continue;
    if (!a?.ca_lam_viec_id || !allow.has(String(a.ca_lam_viec_id))) continue;
    const k = dateKey(fromVNStore(a.ngay_book_ky));
    used[k] = (used[k] || 0) + 1;
  }
  for (const k of days) out[k] = Math.max(0, capacity - (used[k] || 0));
  return out;
}

export const canQuerySlots = (f: { NgayBookKy?: unknown; MaPGC?: unknown; LoaiThuTuc?: unknown }): boolean =>
  !!f?.NgayBookKy && !!f?.MaPGC && !!f?.LoaiThuTuc;

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

/* ---------------- Lưu ---------------- */

export type SaveContext = {
  tenantId: string;
  employeeId: string;
  /** Sàn của tài khoản đại lý (null = tài khoản hệ thống) */
  agencySanId: string | null;
  actorId: string;
  actorName: string;
};

/** Khách đồng đứng tên: chỉ lưu uuid khi khách cá nhân + phân loại đồng sở hữu (2). */
export const coOwnerIdsToSave = (isPersonal: boolean, phanLoai: unknown, list: { MaKH?: unknown }[]): string[] =>
  isPersonal && Number(phanLoai) === 2 ? list.map((c) => c?.MaKH).filter(Boolean).map(String) : [];

/** p_payload cho fn_signing_appointment_upsert – như web toRow + upcert. */
export function buildUpsertPayload(f: any, ctx: SaveContext) {
  return {
    ma_ctdk_uid: uid(ctx.tenantId),
    project_id: uid(f?.MaDA),
    phieu_giu_cho_id: uid(f?.MaPGC),
    san_pham_id: uid(f?.MaSP),
    khach_hang_id: uid(f?.MaKH),
    nguoi_nhap_id: uid(ctx.employeeId),
    san_id: uid(ctx.agencySanId ?? f?.MaSan),
    is_personal: f?.IsPersonal !== false,
    ngay_book_ky: toVNStore(f?.NgayBookKy),
    ma_phan_loai_kh: num(f?.MaPhanLoaiKH),
    ma_phuong_an_tt: num(f?.MaPhuongAnTT),
    la_chuyen_khoan: bool(f?.LaChuyenKhoan),
    co_bao_lanh: bool(f?.CoBaoLanh),
    ca_lam_viec_id: uid(f?.MaCa),
    loai_thu_tuc_id: uid(f?.LoaiThuTuc),
    dong_so_huu_ids: (Array.isArray(f?.DongSoHuuIds) ? f.DongSoHuuIds : []).map(uid).filter(Boolean),
    ghi_chu: f?.GhiChu ?? null,
    tai_lieu: Array.isArray(f?.TaiLieu) ? f.TaiLieu : [],
    seq: f?.ID ? Number(f.ID) : null,
    state: String(f?.State || 'PENDING').toUpperCase(),
    actor_id: ctx.actorId,
    actor_name: ctx.actorName,
  };
}

/* ---------------- Bắt buộc nhập ---------------- */

const SIGNING_FIELDS: Record<string, string> = {
  MaPGC: 'Phiếu đặt cọc',
  MaDA: 'Dự án',
  MaSan: 'Đại lý phụ trách',
  MaCan: 'Mã căn',
  NgayBookKy: 'Ngày giờ book ký',
  MaCa: 'Ca book ký',
  LoaiThuTuc: 'Loại thủ tục',
  MaPhanLoaiKH: 'Phân loại khách hàng',
  TenKH: 'Họ và tên / Tên công ty',
  GioiTinh: 'Giới tính',
  NgaySinh: 'Ngày sinh',
  SoCMND: 'Số CCCD / Hộ chiếu',
  NgayCap: 'Ngày cấp',
  NoiCap: 'Nơi cấp',
  MST: 'Mã số thuế',
  DienThoai: 'Điện thoại',
  Email: 'Email',
  DiaChiTT: 'Địa chỉ thường trú',
  DiaChiLH: 'Địa chỉ liên hệ',
  SoDKKD: 'Số ĐKKD',
  DkkdNgayCap: 'Ngày cấp ĐKKD',
  DkkdNoiCap: 'Nơi cấp ĐKKD',
  TruSo: 'Trụ sở',
  NguoiDaiDien: 'Người đại diện',
  ChucVu: 'Chức vụ',
  DongSoHuu: 'Đồng sở hữu',
  MaPhuongAnTT: 'Phương án thanh toán',
  MaHinhThucTT: 'Hình thức thanh toán',
  MaBaoLanh: 'Bảo lãnh',
  GhiChu: 'Ghi chú',
};
/** Form đại lý không có các trường này trong danh mục web. */
const AGENCY_EXCLUDED = new Set(['MaDA', 'LoaiThuTuc', 'DongSoHuu', 'GhiChu']);

export const signingFormKey = (isAgency: boolean): string => (isAgency ? 'agency_signing' : 'signing');

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/**
 * Trường bắt buộc còn trống (web validateRequiredFields): bỏ trường bị ẩn và trường không có trong danh mục form.
 * Giá trị lấy từ `requiredValues` (form + hồ sơ khách).
 */
export function missingRequired(required: string[], hidden: Set<string>, values: Record<string, unknown>, formKey = 'signing') {
  const agency = formKey === 'agency_signing';
  return required
    .filter((k) => !hidden.has(k))
    .filter((k) => k in SIGNING_FIELDS && !(agency && AGENCY_EXCLUDED.has(k)))
    .filter((k) => isEmpty(values?.[k]))
    .map((k) => ({ key: k, label: SIGNING_FIELDS[k] }));
}

/**
 * Giá trị để kiểm tra bắt buộc nhập: trường của form lịch ký + thông tin khách lấy từ hồ sơ (web điền form
 * khách từ danh mục khách hàng – CustomerSection toFormPatch). Như web: form lưu `LaChuyenKhoan` / `CoBaoLanh` nên
 * cấu hình bắt buộc `MaHinhThucTT` / `MaBaoLanh` luôn báo thiếu (spec 0.2 mục 7).
 */
export function requiredValues(f: any, c: any): Record<string, unknown> {
  const t = (v: unknown) => (v == null ? '' : String(v));
  return {
    ...f,
    TenKH: t(c?.tenKH ?? c?.ten_kh ?? c?.ten_cong_ty),
    GioiTinh: t(c?.gioi_tinh),
    NgaySinh: t(c?.ngay_sinh),
    SoCMND: t(c?.cccd ?? c?.so_cmnd),
    NgayCap: t(c?.ngay_cap),
    NoiCap: t(c?.noi_cap),
    MST: t(c?.ma_so_thue_ct || c?.ma_so_ttncn || c?.ma_so_thue),
    DienThoai: t(c?.dien_thoai ?? c?.di_dong),
    Email: t(c?.email),
    DiaChiTT: t(c?.thuong_tru),
    DiaChiLH: t(c?.dia_chi),
    SoDKKD: t(c?.so_dkkd),
    DkkdNgayCap: t(c?.ngay_cap_dkkd),
    DkkdNoiCap: t(c?.noi_cap_dkkd),
    TruSo: t(c?.dia_chi_ct),
    NguoiDaiDien: t(c?.nguoi_dai_dien_pl),
    ChucVu: t(c?.chuc_vu),
    DongSoHuu: Array.isArray(f?.CoOwners) ? f.CoOwners : [],
  };
}
