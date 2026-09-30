/**
 * Trạng thái căn/dự án – làm theo WEB (chuẩn nghiệp vụ):
 *  - Mã trạng thái sản phẩm: beeland/src/services/ProductTransactionStatus.ts (PRODUCT_STATUS)
 *  - 4 nhóm hiển thị sơ đồ: beeland/src/pages/Products/FloorPlanOverview.tsx (mapStatus)
 *  - Điều kiện Lock/Booking: beeland/src/utils/productSaleStatus.ts (isOpenForSale)
 * Nhãn hiển thị luôn là TÊN trong danh mục (item_name), màu là color_code – như web.
 * Không import gì để test nạp trực tiếp được.
 */

export type StatusTone = 'success' | 'info' | 'warning' | 'brand' | 'danger' | 'neutral';

/** 4 nhóm của sơ đồ căn trên web: available / hold / sold / maintenance ("Khóa"). */
export type WebGroup = 'available' | 'hold' | 'sold' | 'blocked';

export const GROUP_META: Record<WebGroup, { label: string; tone: StatusTone }> = {
  available: { label: 'Mở bán', tone: 'success' },
  hold: { label: 'Giữ chỗ', tone: 'warning' },
  sold: { label: 'Đã bán', tone: 'danger' },
  blocked: { label: 'Khóa', tone: 'neutral' },
};

/**
 * Mã trạng thái SẢN PHẨM (item_code) → nhóm. Theo đặc tả nghiệp vụ web (tên mã ở chú thích).
 * Mã 4 không có trong đặc tả (web khai 0..18, bỏ 4) → coi là mã lạ.
 */
const CODE_GROUP: Record<string, WebGroup> = {
  '0': 'blocked', // Thanh lý chờ duyệt (web sơ đồ: Khóa)
  '1': 'blocked', // Chưa bán – chưa mở bán, không được Lock/Booking
  '2': 'available', // Mở bán – trạng thái duy nhất được Lock/Booking/Cọc
  '3': 'hold', // Booking
  '5': 'hold', // Đã đặt cọc
  '6': 'sold', // HĐMB
  '7': 'hold', // Giữ chỗ
  '8': 'sold', // Bàn giao
  '9': 'sold', // Cấp sổ đỏ
  '10': 'sold', // Góp vốn
  '11': 'hold', // Booking chờ duyệt
  '12': 'hold', // ĐC (đặt cọc) chờ duyệt
  '13': 'sold', // Góp vốn chờ duyệt
  '14': 'sold', // HĐMB chờ duyệt
  '15': 'sold', // Bàn giao chờ duyệt
  '16': 'blocked', // Khác
  '17': 'hold', // Giữ chỗ ưu tiên
  '18': 'blocked', // Đã Lock
};

/** Nhóm theo mã; mã lạ/thiếu → null (người gọi xử lý tiếp, không bao giờ mặc định "Mở bán"). */
export function groupFromCode(code: unknown): WebGroup | null {
  if (code === null || code === undefined) return null;
  return CODE_GROUP[String(code).trim()] ?? null;
}

/** Bỏ dấu + chữ thường (giống norm() của web). */
function fold(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nhóm theo TÊN – dùng khi không có mã. Theo thứ tự luật mapStatus của web, bổ sung các tên
 * hợp đồng/bàn giao mà đặc tả nghiệp vụ coi là đã bán; không nhận ra → "Khóa".
 */
export function groupFromName(name: unknown): WebGroup {
  const raw = String(name ?? '').toLowerCase();
  const t = fold(name);
  if (!t) return 'blocked';
  // Huỷ (vd "Hủy HĐMB") không phải căn đã bán (web: không khớp luật nào → Khóa)
  if (/\bhuy\b/.test(t)) return 'blocked';
  // Web: "đã bán", "đã ký", "hợp đồng" → Đã bán
  if (/\bda ban\b/.test(t) || /\bda ky\b/.test(t) || /\bhop dong\b/.test(t)) return 'sold';
  // Web: "giữ chỗ", "booking", "đặt cọc", "cọc" → Giữ chỗ (+ viết tắt "ĐC")
  if (/\bgiu cho\b/.test(t) || t.includes('booking') || /\bdat coc\b/.test(t) || /\bcoc\b/.test(t) || /\bdc\b/.test(t))
    return 'hold';
  // Đặc tả nghiệp vụ: HĐMB / bàn giao / sổ đỏ / góp vốn là đã bán
  if (/hdmb/.test(t) || /\bhd\s*(mb|mua ban)\b/.test(t) || /\bban giao\b/.test(t) || /\bso do\b/.test(t) || /\bgop von\b/.test(t))
    return 'sold';
  // Web: "khóa", "ngừng", "bảo trì" → Khóa (+ "lock")
  if (/\bkhoa\b/.test(t) || /\bngung\b/.test(t) || /\bbao tri\b/.test(t) || /\block\b/.test(t)) return 'blocked';
  // Web: "mở bán", "sẵn", "trống" → Mở bán (so trên chữ có dấu để "sẵn" không trùng "sàn")
  if (/\bmo ban\b/.test(t) || raw.includes('sẵn') || raw.includes('trống')) return 'available';
  return 'blocked';
}

const OPEN_FOR_SALE_CODE = '2';
const OPEN_FOR_SALE_NAMES = new Set(['mo ban', 'moban', 'open', 'open_for_sale']);

/**
 * Được Lock căn / Booking / Đặt cọc hay không – y hệt web isOpenForSale:
 * chỉ khi trạng thái là mã 2 hoặc tên "Mở bán".
 */
export function isOpenForSale(status: unknown): boolean {
  const s = String(status ?? '').trim();
  if (!s) return false;
  if (/^\d+$/.test(s)) return s === OPEN_FOR_SALE_CODE;
  return OPEN_FOR_SALE_NAMES.has(fold(s));
}

export const OPEN_FOR_SALE_MESSAGE = 'Chỉ có thể thực hiện khi sản phẩm ở trạng thái "Mở bán"';

/** Trạng thái dự án → badge (nhận diện theo TenTT/MaTT như trang chủ cũ). */
export function projectStatus(p: any): { label: string; tone: StatusTone } {
  const tt = String(p?.TenTT || p?.ten_tt || '').trim();
  const ma = String(p?.MaTT ?? p?.ma_tt ?? '');
  if (tt === 'Đã bán' || ma === '2') return { label: tt || 'Đã bán', tone: 'danger' };
  if (tt === 'Đầu tư' || ma === '3') return { label: tt || 'Đầu tư', tone: 'brand' };
  return { label: tt || 'Đang bán', tone: 'success' };
}
