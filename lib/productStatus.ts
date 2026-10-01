/**
 * Trạng thái căn/dự án – làm theo WEB (chuẩn nghiệp vụ):
 *  - Mã trạng thái sản phẩm: beeland/src/services/ProductTransactionStatus.ts (PRODUCT_STATUS)
 *  - 4 nhóm hiển thị sơ đồ: beeland/src/pages/Products/FloorPlanOverview.tsx (mapStatus) – lấy sơ đồ web làm chuẩn
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

/** Bỏ dấu + chữ thường (giống norm() của web) – dùng cho isOpenForSale. */
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
 * Nhóm hiển thị của một căn – LẤY SƠ ĐỒ WEB LÀM CHUẨN: chép nguyên mapStatus trong
 * beeland/src/pages/Products/FloorPlanOverview.tsx (luật tên trên TenTT chữ thường, rồi switch MaTT).
 * Hệ quả giống web: tên không khớp luật (vd "HĐMB", "ĐC chờ duyệt", "Bàn giao") và MaTT là uuid → "Khóa".
 * Không tự "sửa" cho hợp lý hơn web; muốn đổi thì đổi ở web trước.
 */
export function webUnitStatus(detail: { TenTT?: unknown; MaTT?: unknown }): WebGroup {
  const ten = String(detail?.TenTT || '').toLowerCase();
  if (ten.includes('đã bán') || ten.includes('đã ký') || ten.includes('hợp đồng')) return 'sold';
  if (ten.includes('giữ chỗ') || ten.includes('booking') || ten.includes('đặt cọc') || ten.includes('cọc')) return 'hold';
  if (ten.includes('khóa') || ten.includes('ngừng') || ten.includes('bảo trì')) return 'blocked';
  if (ten.includes('mở bán') || ten.includes('sẵn') || ten.includes('trống')) return 'available';
  switch (Number(detail?.MaTT)) {
    case 2:
      return 'available';
    case 3:
      return 'hold';
    case 4:
    case 5:
      return 'sold';
    default:
      return 'blocked';
  }
}

/** Nhóm chỉ theo tên (không có MaTT) – cùng luật webUnitStatus. */
export function groupFromName(name: unknown): WebGroup {
  return webUnitStatus({ TenTT: name });
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
