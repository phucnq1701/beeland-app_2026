/**
 * Yêu cầu khách hàng (nhân viên tiếp nhận / xử lý) – logic thuần, như web:
 *  - beeland/src/services/CustomerRequest.js (map trường _ccr_json ↔ UI, toStored, payload lưu)
 *  - beeland/src/lib/customerRequestRefs.ts (catKey, withCatalogKeys, projectCodeOf)
 *  - beeland/src/lib/customerRequestCatalogs.ts (bộ danh mục cố định)
 *  - beeland/src/lib/customerRequestReport.ts (quá hạn = hạn đã qua, chưa completed/closed/cancelled)
 * Máy chủ: fn_customer_request_list/get/save/delete/process/logs (beeland/scripts/selfhost/0140_cloud_customer_requests.sql).
 * Chỉ import `./signing` (thuần) để test nạp được.
 */
import { fromVNStore, toVNStore } from './signing';

export type YcCatalogType =
  | 'dm_loai_yeu_cau'
  | 'dm_nguon_yeu_cau'
  | 'dm_uu_tien_yeu_cau'
  | 'dm_trang_thai_yeu_cau';

export const YC_CATALOG_TYPES: YcCatalogType[] = [
  'dm_loai_yeu_cau',
  'dm_nguon_yeu_cau',
  'dm_uu_tien_yeu_cau',
  'dm_trang_thai_yeu_cau',
];

/** Khoá mã của từng loại danh mục (web `CustomerService.DanhMucYC.get*`). */
const CODE_KEY: Record<YcCatalogType, string> = {
  dm_loai_yeu_cau: 'MaLoai',
  dm_nguon_yeu_cau: 'MaNguon',
  dm_uu_tien_yeu_cau: 'MucUuTien',
  dm_trang_thai_yeu_cau: 'State',
};

export type YcCat = { ID: string; Name: string; Color: string | null; GhiChu: string | null };

type Fixed = { Code: string; Name: string; Color?: string; GhiChu: string };

/** Bộ cố định của web (`YC_FIXED_CATALOGS`). App chỉ ĐỌC – web tự ghi mục thiếu; app dùng khi Cloud chưa có mục nào. */
export const YC_FIXED: Record<YcCatalogType, Fixed[]> = {
  dm_loai_yeu_cau: [
    { Code: 'consult', Name: 'Tư vấn – hỏi đáp', GhiChu: 'Hỏi thông tin sản phẩm, chính sách, tiến độ' },
    { Code: 'document', Name: 'Hồ sơ – pháp lý', GhiChu: 'Hợp đồng, sổ hồng, giấy tờ, thủ tục' },
    { Code: 'finance', Name: 'Thanh toán – công nợ', GhiChu: 'Tiến độ thanh toán, công nợ, hóa đơn' },
    { Code: 'handover', Name: 'Bàn giao căn hộ', GhiChu: 'Lịch, thủ tục, biên bản bàn giao' },
    { Code: 'warranty', Name: 'Bảo hành – sửa chữa', GhiChu: 'Lỗi căn hộ, bảo trì, tiện ích' },
    { Code: 'complaint', Name: 'Khiếu nại', GhiChu: 'Phản ánh sự cố, chất lượng, thái độ phục vụ' },
    { Code: 'feedback', Name: 'Góp ý', GhiChu: 'Ý kiến đóng góp, đề xuất' },
    { Code: 'other', Name: 'Khác', GhiChu: 'Yêu cầu không thuộc các loại trên' },
  ],
  dm_nguon_yeu_cau: [
    { Code: 'hotline', Name: 'Hotline', GhiChu: 'Tổng đài CSKH' },
    { Code: 'direct', Name: 'Trực tiếp', GhiChu: 'Tại văn phòng / ban quản lý' },
    { Code: 'app', Name: 'App khách hàng', GhiChu: 'Khách gửi từ ứng dụng di động' },
    { Code: 'website', Name: 'Web khách hàng', GhiChu: 'Khách gửi từ web khách hàng' },
    { Code: 'email', Name: 'Email', GhiChu: 'Gửi qua email công ty' },
    { Code: 'zalo', Name: 'Zalo OA', GhiChu: 'Zalo Official Account' },
    { Code: 'facebook', Name: 'Facebook', GhiChu: 'Fanpage / Messenger' },
    { Code: 'staff', Name: 'Nhân viên tạo hộ', GhiChu: 'Nhân viên ghi nhận thay khách' },
  ],
  dm_uu_tien_yeu_cau: [
    { Code: 'low', Name: 'Thấp', Color: 'default', GhiChu: 'Không gấp — xử lý trong 7 ngày' },
    { Code: 'normal', Name: 'Bình thường', Color: 'blue', GhiChu: 'Mặc định — xử lý trong 3 ngày' },
    { Code: 'high', Name: 'Cao', Color: 'orange', GhiChu: 'Cần xử lý sớm — trong 24 giờ' },
    { Code: 'urgent', Name: 'Khẩn cấp', Color: 'red', GhiChu: 'Xử lý ngay — trong 4 giờ' },
  ],
  dm_trang_thai_yeu_cau: [
    { Code: 'new', Name: 'Mới tiếp nhận', Color: 'blue', GhiChu: 'Mặc định khi khách gửi từ app / web' },
    { Code: 'assigned', Name: 'Đã phân công', Color: 'cyan', GhiChu: 'Đã giao người xử lý' },
    { Code: 'processing', Name: 'Đang xử lý', Color: 'orange', GhiChu: 'Đang xử lý nội bộ' },
    { Code: 'waiting', Name: 'Chờ khách phản hồi', Color: 'gold', GhiChu: 'Thiếu thông tin, chờ khách bổ sung' },
    { Code: 'completed', Name: 'Đã xử lý', Color: 'green', GhiChu: 'Đã giải quyết xong' },
    { Code: 'closed', Name: 'Đã đóng', Color: 'default', GhiChu: 'Khách xác nhận / tự đóng' },
    { Code: 'cancelled', Name: 'Đã huỷ', Color: 'red', GhiChu: 'Khách hoặc đơn vị huỷ yêu cầu' },
  ],
};

/** Mã trạng thái coi là đã kết thúc (báo cáo web: không tính quá hạn). */
export const DONE_STATUSES = ['completed', 'closed', 'cancelled'];
/** Mặc định khi tiếp nhận mới trên app (web để trống – xem docs/requests.md). */
export const DEFAULT_NEW_STATUS = 'new';
export const DEFAULT_PRIORITY = 'normal';

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/** Mã danh mục → chuỗi để so khớp; rỗng / null / NaN → null (web `catKey`). */
export const catKey = (v: unknown): string | null => {
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return str(v);
};

/**
 * Dòng `cloud_catalogs` (id, item_code, item_name, raw) → mục danh mục.
 * ID = raw.ID ?? item_code ?? raw[mã theo loại] ?? raw.Code – cùng khoá `_ccr_json` trả về (MaLoai/MaNguon/MucUuTien/State).
 * Bỏ trùng ID (giữ mục đầu), mục cố định lên đầu theo thứ tự web; rỗng → bộ cố định.
 */
export function mapCatalog(rows: any[] | null | undefined, type: YcCatalogType): YcCat[] {
  const fixed = YC_FIXED[type];
  const codeKey = CODE_KEY[type];
  const seen = new Set<string>();
  const out: YcCat[] = [];
  for (const row of rows ?? []) {
    const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
    const id = catKey(raw.ID) ?? catKey(row?.item_code) ?? catKey(raw[codeKey]) ?? catKey(raw.Code);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      ID: id,
      Name: str(row?.item_name) ?? str(raw.Name) ?? id,
      Color: str(raw.Color),
      GhiChu: str(raw.GhiChu),
    });
  }
  if (!out.length) {
    return fixed.map((f) => ({ ID: f.Code, Name: f.Name, Color: f.Color ?? null, GhiChu: f.GhiChu }));
  }
  const order = new Map(fixed.map((f, i) => [f.Code, i]));
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (order.get(a.c.ID) ?? fixed.length) - (order.get(b.c.ID) ?? fixed.length) || a.i - b.i)
    .map((x) => x.c);
}

export type CustomerRequest = {
  id: string;
  code: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  /** Giá trị dự án đã lưu (`ma_da` = mã dự án hoặc uuid). */
  projectCode: string | null;
  projectUuid: string | null;
  projectName: string;
  /** `ma_hd` hoặc uuid phiếu giữ chỗ (yêu cầu khách gửi từ app/web). */
  contractId: string | null;
  title: string;
  content: string;
  category: string | null;
  categoryName: string;
  source: string | null;
  sourceName: string;
  priority: string | null;
  priorityName: string;
  status: string | null;
  statusName: string;
  /** timestamptz máy chủ (ISO). */
  dueDate: string | null;
  receiverId: string | null;
  receiverName: string;
  assigneeId: string | null;
  assigneeName: string;
  internalNote: string;
  /** Giá trị lưu: URL hoặc `drive-files:<path>` (tệp khách tải lên, cần ký link để xem). */
  attachments: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

const s = (v: unknown): string => (v == null ? '' : String(v));

/** Dòng `_ccr_json` → app (web `fromApiItem`). */
export function fromApiItem(it: any): CustomerRequest {
  const id = s(it?.ID ?? it?.id);
  const list = Array.isArray(it?.ListAttach) ? it.ListAttach : [];
  return {
    id,
    code: s(it?.MaYC || it?.Code) || (id ? `YC${id.padStart(5, '0')}` : ''),
    customerId: str(it?.MaKH),
    customerName: s(it?.TenKH),
    customerPhone: s(it?.DienThoai),
    customerEmail: s(it?.Email),
    projectCode: str(it?.MaDA),
    projectUuid: str(it?.ProjectId),
    projectName: s(it?.TenDA),
    contractId: str(it?.MaHD),
    title: s(it?.TieuDe),
    content: s(it?.NoiDung),
    category: catKey(it?.MaLoai),
    categoryName: s(it?.TenLoai),
    source: catKey(it?.MaNguon),
    sourceName: s(it?.TenNguon),
    priority: catKey(it?.MucUuTien),
    priorityName: s(it?.TenUuTien),
    status: catKey(it?.State),
    statusName: s(it?.TenTrangThai),
    dueDate: str(it?.ThoiHan),
    receiverId: str(it?.MaNVTN),
    receiverName: s(it?.TenNVTN),
    assigneeId: str(it?.MaNVXL),
    assigneeName: s(it?.HoTenNVXL),
    internalNote: s(it?.GhiChu),
    attachments: list.map((a: unknown) => (typeof a === 'string' ? a.trim() : '')).filter(Boolean),
    createdAt: str(it?.NgayTao),
    updatedAt: str(it?.NgayCapNhat),
  };
}

const STORE = 'drive-files:';
export const isStoredFile = (v: unknown): boolean => String(v ?? '').startsWith(STORE);
export const storedPath = (v: unknown): string => String(v ?? '').slice(STORE.length);

/** URL ký của tệp riêng tư (…/object/sign/drive-files/<path>?token) → chuỗi lưu 'drive-files:<path>' (web `toStored`). */
export function toStored(u: unknown): string {
  const v = String(u ?? '');
  if (v.startsWith(STORE)) return v;
  const m = v.match(/\/storage\/v1\/object\/sign\/drive-files\/([^?]+)/);
  return m ? STORE + decodeURIComponent(m[1]) : v;
}

/** Tên tệp hiển thị: đoạn cuối đường dẫn, đã giải mã. */
export function attachmentName(v: unknown): string {
  const last = String(v ?? '').split('?')[0].split('/').pop() || '';
  try {
    return decodeURIComponent(last) || 'Tệp';
  } catch {
    return last || 'Tệp';
  }
}

export type RequestForm = {
  id?: string | null;
  /** Giá trị gửi `MaDA` (mã dự án, thiếu thì uuid). */
  projectCode?: string | null;
  contractId?: string | null;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  title?: string;
  content?: string;
  category?: string | null;
  source?: string | null;
  priority?: string | null;
  status?: string | null;
  /** Giờ VN dạng naive `YYYY-MM-DDTHH:mm:ss`. */
  dueDate?: string | null;
  receiverId?: string | null;
  assigneeId?: string | null;
  internalNote?: string;
  /** Giá trị lưu hoặc URL ký (tự đổi về `drive-files:`). */
  attachments?: string[];
};

/** Payload `fn_customer_request_save(p)` – khoá JSON kiểu cũ như web `toApiPayload`. Lưu đè toàn bộ trường. */
export function toApiPayload(f: RequestForm) {
  return {
    ID: str(f.id),
    MaKH: str(f.customerId),
    MaHD: str(f.contractId),
    TenKH: str(f.customerName),
    DienThoai: str(f.customerPhone),
    Email: str(f.customerEmail),
    TieuDe: str(f.title),
    NoiDung: str(f.content),
    MaLoai: catKey(f.category),
    MaNguon: catKey(f.source),
    MucUuTien: catKey(f.priority),
    State: catKey(f.status),
    // Gửi kèm +07:00 để máy chủ hiểu đúng giờ VN (web gửi giờ không múi – docs/requests.md)
    ThoiHan: toVNStore(f.dueDate),
    MaNVTN: str(f.receiverId),
    MaNVXL: str(f.assigneeId),
    GhiChu: str(f.internalNote),
    MaDA: str(f.projectCode),
    ListAttach: (f.attachments ?? []).map(toStored).filter(Boolean),
  };
}

export type RequestFormErrors = { projectCode?: string; customerName?: string; title?: string };

/** Bắt buộc như form web (RequestFormDrawer): Dự án, Tên khách hàng, Tiêu đề. */
export function validateRequestForm(f: { projectCode?: string | null; customerName?: string; title?: string }): RequestFormErrors {
  const out: RequestFormErrors = {};
  if (!str(f.projectCode)) out.projectCode = 'Vui lòng chọn dự án';
  if (!str(f.customerName)) out.customerName = 'Vui lòng nhập tên khách hàng';
  if (!str(f.title)) out.title = 'Vui lòng nhập tiêu đề';
  return out;
}

/** Quá hạn: có hạn, hạn đã qua, trạng thái chưa kết thúc (web `buildRequestReport`). */
export function isOverdue(r: { dueDate: string | null; status: string | null }, nowMs: number): boolean {
  if (!r.dueDate) return false;
  const t = Date.parse(r.dueDate);
  if (!Number.isFinite(t) || t >= nowMs) return false;
  return !DONE_STATUSES.includes(String(r.status ?? ''));
}

export type RequestLog = {
  id: string;
  status: string | null;
  statusName: string | null;
  color: string | null;
  note: string;
  at: string | null;
  by: string;
};

/** Dòng `fn_customer_request_logs` (mới nhất trước). */
export function mapLog(l: any): RequestLog {
  return {
    id: s(l?.ID),
    status: catKey(l?.State),
    statusName: str(l?.Name),
    color: str(l?.Color),
    note: s(l?.NoiDung),
    at: str(l?.NgayXL),
    by: s(l?.HoTen),
  };
}

type ProjectRef = { id?: unknown; ma_da_code?: unknown };

/**
 * Giá trị đã lưu (`MaDA` = mã dự án hoặc uuid; yêu cầu từ app khách chỉ có uuid) → uuid dự án của ô chọn
 * (web `projectCodeOf`). Không khớp dự án nào → null.
 */
export function projectValueOf(projects: ProjectRef[], value: unknown, projectUuid: unknown): string | null {
  const v = str(value);
  const u = str(projectUuid);
  const hit =
    (v && projects.find((p) => str(p.ma_da_code) === v || str(p.id) === v)) ||
    (u && projects.find((p) => str(p.id) === u));
  return hit ? str(hit.id) : null;
}

/** uuid dự án đã chọn → giá trị gửi `MaDA` (mã dự án như web, thiếu mã thì uuid). */
export function projectSaveCode(projects: ProjectRef[], projectId: string | null): string | null {
  if (!projectId) return null;
  const p = projects.find((x) => str(x.id) === projectId);
  return str(p?.ma_da_code) ?? projectId;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Giờ hạn xử lý: mỗi 30 phút. */
export function timeOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const v = `${pad(h)}:${pad(m)}`;
      out.push({ value: v, label: v });
    }
  }
  return out;
}

/** Hạn xử lý máy chủ (ISO) → ngày + giờ VN. */
export function splitDue(iso: string | null | undefined): { day: string | null; time: string | null } {
  const naive = fromVNStore(iso);
  if (!naive) return { day: null, time: null };
  return { day: naive.slice(0, 10), time: naive.slice(11, 16) };
}

/** Ngày + giờ VN → naive `YYYY-MM-DDTHH:mm:00` (thiếu giờ → 17:00). */
export function joinDue(day: string | null, time: string | null): string | null {
  if (!day) return null;
  return `${day}T${time || '17:00'}:00`;
}
