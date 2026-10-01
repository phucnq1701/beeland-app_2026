/**
 * Luật nghiệp vụ khách hàng – CHÉP TỪ WEB (web là chuẩn), tách khỏi phần truy vấn để test được:
 *  - Trùng khách hàng: beeland/src/services/CustomerDuplicateConfigService.ts, CustomerDuplicateService.ts
 *  - Bắt buộc nhập:   beeland/src/services/RequiredFieldService.ts, config/requiredFieldCatalog.ts
 *  - Giai đoạn chứng từ: beeland/src/services/SalesDocListService.ts
 * Không import gì để test nạp trực tiếp được.
 */

/* ---------------- Trùng khách hàng ---------------- */

export type DuplicateMode = 'allow' | 'request' | 'block';
export type DuplicateField = 'cccd' | 'phone' | 'email' | 'tax_code' | 'full_name';
export type ProtectionRuleKey = 'contract' | 'deposit' | 'booking' | 'care_recent' | 'care_old' | 'new_contact';
export type ProtectionLevel = 'none' | 'low' | 'medium' | 'high';

export type ProtectionRule = { enabled: boolean; mode: DuplicateMode; days?: number };

export type CustomerDuplicateConfig = {
  defaultMode: DuplicateMode;
  rules: Partial<Record<DuplicateField, DuplicateMode>>;
  ignoreInactive: boolean;
  ownDuplicateMode: DuplicateMode;
  protectionEnabled: boolean;
  protection: Record<ProtectionRuleKey, ProtectionRule>;
};

export const DUPLICATE_FIELDS: { key: DuplicateField; label: string }[] = [
  { key: 'cccd', label: 'CCCD / CMND / Hộ chiếu' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'tax_code', label: 'Mã số thuế' },
  { key: 'full_name', label: 'Họ tên / Tên công ty' },
];

export const duplicateFieldLabel = (f: DuplicateField) => DUPLICATE_FIELDS.find((x) => x.key === f)?.label || f;

/** Cột tương ứng trên cloud_customers (web FIELD_COLUMNS). */
export const DUPLICATE_FIELD_COLUMNS: Record<DuplicateField, string[]> = {
  cccd: ['cccd', 'so_cmnd'],
  phone: ['di_dong', 'dien_thoai'],
  email: ['email'],
  tax_code: ['ma_so_thue_ct'],
  full_name: ['ten_kh', 'ten_cong_ty'],
};

/** Các cấp độ bảo vệ, xếp mạnh → yếu (áp dụng cấp đầu tiên khớp). */
export const PROTECTION_RULES: { key: ProtectionRuleKey; label: string; hasDays?: boolean }[] = [
  { key: 'contract', label: 'Đã có hợp đồng (HĐGV / HĐMB)' },
  { key: 'deposit', label: 'Đã đặt cọc' },
  { key: 'booking', label: 'Đã giữ chỗ / booking' },
  { key: 'care_recent', label: 'Đang được chăm sóc', hasDays: true },
  { key: 'care_old', label: 'Đã chăm sóc nhưng lâu ngày', hasDays: true },
  { key: 'new_contact', label: 'Khách mới có tương tác', hasDays: true },
];

export const DEFAULT_PROTECTION_RULES: Record<ProtectionRuleKey, ProtectionRule> = {
  contract: { enabled: true, mode: 'block' },
  deposit: { enabled: true, mode: 'block' },
  booking: { enabled: true, mode: 'request' },
  care_recent: { enabled: true, mode: 'request', days: 30 },
  care_old: { enabled: false, mode: 'request', days: 90 },
  new_contact: { enabled: true, mode: 'request', days: 7 },
};

export const DEFAULT_CUSTOMER_DUPLICATE: CustomerDuplicateConfig = {
  defaultMode: 'block',
  rules: {},
  ignoreInactive: false,
  ownDuplicateMode: 'block',
  protectionEnabled: true,
  protection: DEFAULT_PROTECTION_RULES,
};

const asMode = (v: unknown): DuplicateMode | undefined =>
  v === 'allow' || v === 'request' || v === 'block' ? v : undefined;

export function normalizeDuplicateConfig(raw: unknown): CustomerDuplicateConfig {
  const src: any = raw && typeof raw === 'object' ? raw : {};
  const rules: Partial<Record<DuplicateField, DuplicateMode>> = {};
  const srcRules = src.rules && typeof src.rules === 'object' ? src.rules : {};
  DUPLICATE_FIELDS.forEach(({ key }) => {
    const m = asMode(srcRules[key]);
    if (m) rules[key] = m;
  });

  const srcProt = src.protection && typeof src.protection === 'object' ? src.protection : {};
  const protection = {} as Record<ProtectionRuleKey, ProtectionRule>;
  PROTECTION_RULES.forEach(({ key, hasDays }) => {
    const def = DEFAULT_PROTECTION_RULES[key];
    const cur = srcProt[key] && typeof srcProt[key] === 'object' ? srcProt[key] : {};
    const days = Number(cur.days);
    protection[key] = {
      enabled: typeof cur.enabled === 'boolean' ? cur.enabled : def.enabled,
      mode: asMode(cur.mode) ?? def.mode,
      ...(hasDays ? { days: Number.isFinite(days) && days > 0 ? Math.round(days) : def.days } : {}),
    };
  });

  return {
    defaultMode: asMode(src.defaultMode) ?? 'block',
    rules,
    ignoreInactive: !!src.ignoreInactive,
    ownDuplicateMode: asMode(src.ownDuplicateMode) ?? 'block',
    protectionEnabled: typeof src.protectionEnabled === 'boolean' ? src.protectionEnabled : true,
    protection,
  };
}

/** Cách xử lý cho 1 tiêu chí (chưa cài đặt → mặc định). */
export const modeOf = (cfg: CustomerDuplicateConfig, field: DuplicateField): DuplicateMode =>
  cfg.rules[field] ?? cfg.defaultMode;

const STRICTNESS: Record<DuplicateMode, number> = { allow: 0, request: 1, block: 2 };
export const strictest = (a: DuplicateMode, b: DuplicateMode): DuplicateMode => (STRICTNESS[a] >= STRICTNESS[b] ? a : b);

const RULE_LEVEL: Record<ProtectionRuleKey, ProtectionLevel> = {
  contract: 'high',
  deposit: 'high',
  booking: 'medium',
  care_recent: 'medium',
  care_old: 'low',
  new_contact: 'low',
};

export type DuplicateProtection = {
  level: ProtectionLevel;
  score: number;
  activityCount: number;
  lastCareAt: string | null;
  daysSinceCare: number | null;
  hasTransaction: boolean;
  transactionCount: number;
  reasons: string[];
  ruleKey: ProtectionRuleKey | null;
  ruleLabel: string | null;
  ruleMode: DuplicateMode | null;
};

export const PROTECTION_LABEL: Record<ProtectionLevel, string> = {
  none: 'Không bảo vệ',
  low: 'Bảo vệ thấp',
  medium: 'Bảo vệ vừa',
  high: 'Bảo vệ cao',
};

/**
 * Mức bảo vệ của khách đang trùng – thân hàm evaluateProtection của web, phần truy vấn tách ra:
 * stages = giai_doan các phiếu (cloud_pgc_phieu_giucho), care = nhật ký chăm sóc, createdAt = ngày tạo khách.
 */
export function evaluateProtection(
  input: { stages: string[]; careCount: number; lastCareAt: string | null; createdAt: string | null; now: number },
  cfg: CustomerDuplicateConfig
): DuplicateProtection {
  let hasContract = false;
  let hasDeposit = false;
  let hasBooking = false;
  for (const s of input.stages) {
    const g = String(s || '').toUpperCase();
    if (g === 'HDGV' || g === 'HDMB' || g === 'THANHLY') hasContract = true;
    else if (g === 'DATCOC') hasDeposit = true;
    else hasBooking = true;
  }
  const daysFrom = (v: string | null): number | null => {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? Math.floor((input.now - t) / 86400000) : null;
  };
  const careDays = daysFrom(input.lastCareAt);
  const ageDays = daysFrom(input.createdAt);

  const out: DuplicateProtection = {
    level: 'none',
    score: 0,
    activityCount: input.careCount,
    lastCareAt: input.lastCareAt,
    daysSinceCare: careDays,
    hasTransaction: input.stages.length > 0,
    transactionCount: input.stages.length,
    reasons: [],
    ruleKey: null,
    ruleLabel: null,
    ruleMode: null,
  };

  if (hasContract) out.reasons.push('Đã có hợp đồng (HĐGV/HĐMB)');
  if (hasDeposit) out.reasons.push('Đã phát sinh đặt cọc');
  if (hasBooking) out.reasons.push('Đã có phiếu giữ chỗ / booking');
  if (input.careCount > 0) out.reasons.push(`Có ${input.careCount} nhật ký chăm sóc`);
  if (careDays != null) out.reasons.push(`Chăm sóc gần nhất cách đây ${careDays} ngày`);
  if (ageDays != null) out.reasons.push(`Khách được tạo ${ageDays} ngày trước`);

  out.score =
    (hasContract ? 100 : 0) +
    (hasDeposit ? 80 : 0) +
    (hasBooking ? 50 : 0) +
    Math.min(input.careCount, 10) * 3 +
    (careDays != null && careDays <= 30 ? 40 : 0);

  if (!cfg.protectionEnabled) return out;

  const matched = (key: ProtectionRuleKey): boolean => {
    const rule = cfg.protection[key];
    if (!rule?.enabled) return false;
    const days = Number(rule.days ?? 0);
    switch (key) {
      case 'contract':
        return hasContract;
      case 'deposit':
        return hasDeposit;
      case 'booking':
        return hasBooking;
      case 'care_recent':
        return careDays != null && careDays <= days;
      case 'care_old':
        return careDays != null && careDays > days;
      case 'new_contact':
        return ageDays != null && ageDays <= days && input.careCount > 0;
      default:
        return false;
    }
  };

  for (const { key, label } of PROTECTION_RULES) {
    if (!matched(key)) continue;
    out.ruleKey = key;
    out.ruleLabel = label;
    out.ruleMode = cfg.protection[key].mode;
    out.level = RULE_LEVEL[key];
    break;
  }
  return out;
}

/**
 * Cách xử lý của một khách trùng (web checkCustomerDuplicate):
 * khách do chính mình tạo → ownDuplicateMode; còn lại → nghiêm nhất các tiêu chí, nâng theo mức bảo vệ.
 */
export function finalDuplicateMode(
  fieldModes: DuplicateMode[],
  protection: { ruleMode: DuplicateMode | null },
  isOwn: boolean,
  cfg: CustomerDuplicateConfig
): DuplicateMode {
  if (isOwn) return cfg.ownDuplicateMode;
  const mode = fieldModes.reduce<DuplicateMode>((acc, m) => strictest(acc, m), 'allow');
  return protection.ruleMode ? strictest(mode, protection.ruleMode) : mode;
}

/* ---------------- Form khách hàng ---------------- */

export type CustomerFormValues = {
  isPersonal: boolean;
  name: string;
  phone: string;
  phone2: string;
  email: string;
  cccd: string;
  taxCode: string;
  diaChi: string;
  statusId: string;
  sourceId: string;
  notes: string;
  nguoiDaiDienPl: string;
  chucVu: string;
  nddDienThoai: string;
  nddEmail: string;
  nddSoCccd: string;
};

export type CustomerFormField = Exclude<keyof CustomerFormValues, 'isPersonal'>;

export const EMPTY_CUSTOMER_FORM: CustomerFormValues = {
  isPersonal: true,
  name: '',
  phone: '',
  phone2: '',
  email: '',
  cccd: '',
  taxCode: '',
  diaChi: '',
  statusId: '',
  sourceId: '',
  notes: '',
  nguoiDaiDienPl: '',
  chucVu: '',
  nddDienThoai: '',
  nddEmail: '',
  nddSoCccd: '',
};

const t = (v: unknown) => String(v ?? '').trim();

/**
 * Giá trị từng tiêu chí trùng lấy từ form (web duplicateValuesFromPayload đọc DiDong/Email/SoCMND/MaSoThueCT/TenKH|TenCongTy).
 * Tab Doanh nghiệp của web nhập SĐT/email vào DienThoaiCT/EmailCT → web không kiểm SĐT/email/CCCD của doanh nghiệp.
 */
export function duplicateValues(f: CustomerFormValues): Record<DuplicateField, string> {
  return {
    cccd: f.isPersonal ? t(f.cccd) : '',
    phone: f.isPersonal ? t(f.phone) : '',
    email: f.isPersonal ? t(f.email) : '',
    tax_code: f.isPersonal ? '' : t(f.taxCode),
    full_name: t(f.name),
  };
}

/**
 * Dữ liệu gửi CustomerService.saveCustomerCloud – chỉ trường của loại khách đang chọn
 * (CCCD gõ trước khi đổi sang Doanh nghiệp không bị lưu nhầm).
 */
export function customerSavePayload(v: CustomerFormValues, mode: 'create' | 'edit'): Record<string, any> {
  const n = (x: string) => t(x) || null;
  return {
    isPersonal: v.isPersonal,
    tenKh: t(v.name),
    tenCongTy: v.isPersonal ? null : t(v.name),
    diDong: t(v.phone),
    diDong2: n(v.phone2),
    email: n(v.email),
    cccd: v.isPersonal ? n(v.cccd) : null,
    diaChi: n(v.diaChi),
    // Tạo mới: cá nhân không nhập MST (như màn cũ); sửa: giữ MST TNCN đang có
    taxCode: mode === 'create' && v.isPersonal ? null : n(v.taxCode),
    maTtId: n(v.statusId),
    maNguonId: n(v.sourceId),
    ...(v.isPersonal
      ? {}
      : {
          nguoiDaiDienPl: n(v.nguoiDaiDienPl),
          chucVu: n(v.chucVu),
          nddDienThoai: n(v.nddDienThoai),
          nddEmail: n(v.nddEmail),
          nddSoCccd: n(v.nddSoCccd),
        }),
  };
}

/**
 * form_key cấu hình (web RequiredFieldService.resolveKey + agencyFormKey): đại lý dùng bản agency_* khi danh mục web
 * có bản đó – hiện chỉ có agency_customer (cá nhân); doanh nghiệp luôn customer_org.
 */
export function customerFormKey(isPersonal: boolean, isAgency: boolean): string {
  if (!isPersonal) return 'customer_org';
  return isAgency ? 'agency_customer' : 'customer';
}

/** Các trường có trên form web theo danh mục (requiredFieldCatalog) – key ngoài danh mục web tự bỏ qua. */
const PERSONAL_CATALOG = new Set([
  'TenKH', 'MaQD', 'MaSoKH', 'NgaySinh', 'SoCMND', 'NgayCap', 'NoiCap', 'MaSoTTNCN', 'SoTaiKhoan', 'TenNganHang',
  'DiDong', 'DiDong2', 'Email', 'Email2', 'ThuongTru', 'DiaChi', 'MaNguon', 'MaTT', 'AnhCCCDTruoc', 'AnhCCCDSau',
]);
const ORG_CATALOG = new Set([
  'MaSoKH', 'TenCongTy', 'MaSoThueCT', 'DiaChiCT', 'MaTT', 'MaNguon', 'DienThoaiCT', 'EmailCT', 'FaxCT', 'SoGPKD',
  'NoiCapGDKKD', 'NgayCapGDKKD', 'NguoiDaiDienPL', 'ChucVu', 'NDDDienThoai', 'NDDEmail', 'NDDSoCCCD', 'NDDNgayCap',
  'NDDNoiCap', 'NDDThuongTru', 'NDDDiaChiLH', 'NguoiUyQuyenList',
]);

/** Key cấu hình web → trường form app. Key web không có ở đây = app chưa có trường đó. */
const PERSONAL_FIELDS: Record<string, CustomerFormField | null> = {
  TenKH: 'name',
  DiDong: 'phone',
  DiDong2: 'phone2',
  Email: 'email',
  SoCMND: 'cccd',
  DiaChi: 'diaChi',
  ThuongTru: 'diaChi',
  MaTT: 'statusId',
  MaNguon: 'sourceId',
  MaSoKH: null, // app tự sinh mã
};
const ORG_FIELDS: Record<string, CustomerFormField | null> = {
  TenCongTy: 'name',
  DienThoaiCT: 'phone',
  EmailCT: 'email',
  MaSoThueCT: 'taxCode',
  DiaChiCT: 'diaChi',
  MaTT: 'statusId',
  MaNguon: 'sourceId',
  NguoiDaiDienPL: 'nguoiDaiDienPl',
  ChucVu: 'chucVu',
  NDDDienThoai: 'nddDienThoai',
  NDDEmail: 'nddEmail',
  NDDSoCCCD: 'nddSoCccd',
  MaSoKH: null,
};

export const appFieldOf = (isPersonal: boolean, key: string): CustomerFormField | null | undefined =>
  (isPersonal ? PERSONAL_FIELDS : ORG_FIELDS)[key];

/** Nhãn trường theo danh mục cấu hình của web (requiredFieldCatalog). */
export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  TenKH: 'Họ và tên',
  MaQD: 'Danh xưng',
  MaSoKH: 'Mã khách hàng',
  NgaySinh: 'Ngày sinh',
  SoCMND: 'Số CMND/CCCD',
  NgayCap: 'Ngày cấp',
  NoiCap: 'Nơi cấp',
  MaSoTTNCN: 'Số thuế TNCN',
  SoTaiKhoan: 'Số tài khoản',
  TenNganHang: 'Ngân hàng',
  DiDong: 'Số điện thoại',
  DiDong2: 'Số điện thoại phụ',
  Email2: 'Email phụ',
  Email: 'Email',
  ThuongTru: 'Địa chỉ thường trú',
  DiaChi: 'Địa chỉ liên hệ',
  MaNguon: 'Nguồn khách hàng',
  MaTT: 'Trạng thái',
  AnhCCCDTruoc: 'Ảnh CCCD mặt trước',
  AnhCCCDSau: 'Ảnh CCCD mặt sau',
  TenCongTy: 'Tên doanh nghiệp',
  MaSoThueCT: 'Mã số thuế',
  DiaChiCT: 'Địa chỉ trụ sở',
  DienThoaiCT: 'Số điện thoại',
  EmailCT: 'Email',
  FaxCT: 'Fax',
  SoGPKD: 'Số GPKD',
  NoiCapGDKKD: 'Nơi cấp GDKKD',
  NgayCapGDKKD: 'Ngày cấp GDKKD',
  NguoiDaiDienPL: 'Họ và tên người đại diện',
  ChucVu: 'Chức vụ',
  NDDDienThoai: 'Số điện thoại người đại diện',
  NDDEmail: 'Email người đại diện',
  NDDSoCCCD: 'Số CCCD người đại diện',
  NDDNgayCap: 'Ngày cấp (người đại diện)',
  NDDNoiCap: 'Nơi cấp (người đại diện)',
  NDDThuongTru: 'Thường trú (người đại diện)',
  NDDDiaChiLH: 'Địa chỉ liên lạc (người đại diện)',
  NguoiUyQuyenList: 'Người được ủy quyền',
};

export type RequiredCheck = {
  ok: boolean;
  fieldErrors: Partial<Record<CustomerFormField, string>>;
  /** Nhãn các trường bắt buộc mà app chưa có trên form */
  unsupported: string[];
  message: string;
};

/**
 * Kiểm tra bắt buộc nhập theo cấu hình (web validateRequiredFields): trường bị ẩn thì bỏ qua.
 * Trường app có → lỗi ngay dưới trường; trường app chưa có → không cho lưu, hướng dẫn nhập trên web.
 */
export function checkRequired(
  requiredKeys: string[],
  hidden: Set<string>,
  values: CustomerFormValues,
  labels: Record<string, string>
): RequiredCheck {
  const fieldErrors: Partial<Record<CustomerFormField, string>> = {};
  const unsupported: string[] = [];
  const label = (k: string) => labels[k] || REQUIRED_FIELD_LABELS[k] || k;
  const catalog = values.isPersonal ? PERSONAL_CATALOG : ORG_CATALOG;
  for (const key of requiredKeys) {
    if (hidden.has(key) || !catalog.has(key)) continue;
    const field = appFieldOf(values.isPersonal, key);
    if (field === null) continue;
    if (field === undefined) {
      unsupported.push(label(key));
      continue;
    }
    if (!t(values[field]) && !fieldErrors[field]) fieldErrors[field] = `Vui lòng nhập ${label(key)}`;
  }
  const ok = Object.keys(fieldErrors).length === 0 && unsupported.length === 0;
  return {
    ok,
    fieldErrors,
    unsupported,
    message: unsupported.length
      ? `Công ty yêu cầu nhập: ${unsupported.join(', ')}. Mục này chưa có trên app – vui lòng nhập khách hàng trên web.`
      : '',
  };
}

/* ---------------- Giao dịch của khách ---------------- */

export const STAGE_LABEL: Record<string, string> = {
  GIUCHO: 'Giữ chỗ / booking',
  DATCOC: 'Đặt cọc',
  HDGV: 'HĐ góp vốn',
  HDMB: 'HĐ mua bán',
  THANHLY: 'Thanh lý',
};

export const stageLabel = (code: unknown): string => {
  const c = t(code).toUpperCase();
  return STAGE_LABEL[c] || t(code);
};

export type CustomerTransaction = {
  id: string;
  soPhieu: string;
  giaiDoan: string;
  stageLabel: string;
  tenDA: string;
  kyHieu: string;
  giaTri: number | null;
  tienCoc: number | null;
  daThu: number | null;
  status: string;
  statusColor: string | null;
  createdAt: string | null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Một dòng cloud_pgc_phieu_giucho → giao dịch hiển thị (tra tên qua bảng phụ theo id). */
export function mapCustomerTransaction(
  row: any,
  lookups: { products: Record<string, any>; projects: Record<string, any>; statuses: Record<string, any> }
): CustomerTransaction {
  const giaiDoan = t(row?.giai_doan).toUpperCase() || 'GIUCHO';
  const sp = lookups.products[row?.san_pham_id] || {};
  const da = lookups.projects[row?.project_id] || {};
  const tt = lookups.statuses[row?.trang_thai_id] || {};
  return {
    id: String(row?.id ?? ''),
    soPhieu: t(row?.so_phieu_gc),
    giaiDoan,
    stageLabel: stageLabel(giaiDoan),
    tenDA: t(da.ten_da),
    kyHieu: t(sp.ky_hieu) || t(sp.ma_sp),
    giaTri: num(row?.gia_tri_hd_sau_ck) ?? num(row?.gia_tri_hd),
    tienCoc: num(row?.tien_coc),
    daThu: num(row?.da_thu),
    status: t(tt.item_name),
    statusColor: t(tt.color_code) || null,
    createdAt: row?.created_at ?? null,
  };
}
