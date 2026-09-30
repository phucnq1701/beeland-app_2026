/**
 * Logic dùng chung cho các mục tính năng (Trang chủ, Tất cả quản lý, tab menu, Tài khoản).
 * Trước đây viết lặp ở từng màn. Không import gì để test nạp trực tiếp được.
 */

/** Màn tương ứng từng tính năng. Tính năng chưa có màn (vd Hoa hồng – id 7) không có ở đây. */
export const FEATURE_ROUTES: Record<string, string> = {
  '1': '/projects',
  '2': '/products',
  '3': '/appointments',
  '4': '/locked-units',
  '5': '/bookings',
  '6': '/customers',
  '8': '/contracts',
  '9': '/reports',
  '13': '/deposits',
};

export function routeForFeature(id: string): string | null {
  return FEATURE_ROUTES[id] ?? null;
}

/** Tài khoản đại lý chỉ dùng: Dự án, Sản phẩm, Booking, Đặt cọc. */
export const AGENCY_FEATURE_IDS = ['1', '2', '5', '13'] as const;

/**
 * Các tính năng được hiển thị/cho chọn. Luôn ẩn tính năng chưa có màn (quyết định Q4:
 * hiện lại khi có màn thật). Thứ tự giữ theo `allIds`.
 */
export function visibleFeatureIds(
  allIds: string[],
  opts: { isAgency: boolean; menuOnly: boolean; menuEligible: string[] }
): string[] {
  const agency: readonly string[] = AGENCY_FEATURE_IDS;
  return allIds.filter(
    (id) =>
      routeForFeature(id) !== null &&
      (!opts.isAgency || agency.includes(id)) &&
      (!opts.menuOnly || opts.menuEligible.includes(id))
  );
}

export type ToggleResult = { next: string[]; error: string | null };

/** Bật/tắt một mục trong danh sách đã chọn, tôn trọng số lượng tối thiểu/tối đa. */
export function toggleSelection(
  selected: string[],
  id: string,
  opts: { min: number; max: number; tooManyMessage: string; tooFewMessage: string }
): ToggleResult {
  if (selected.includes(id)) {
    if (selected.length <= opts.min) return { next: selected, error: opts.tooFewMessage };
    return { next: selected.filter((x) => x !== id), error: null };
  }
  if (selected.length >= opts.max) return { next: selected, error: opts.tooManyMessage };
  return { next: [...selected, id], error: null };
}

/** Đổi chỗ mục `id` với mục liền trước (-1) hoặc liền sau (1). */
export function moveItem(list: string[], id: string, dir: -1 | 1): string[] {
  const i = list.indexOf(id);
  const j = i + dir;
  const next = [...list];
  if (i < 0 || j < 0 || j >= list.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Đọc cấu hình đã lưu (đã JSON.parse, có thể hỏng/cũ): lấy `selectedIds`, bỏ id không còn
 * tồn tại và id trùng; rỗng → `fallback`.
 */
export function normalizeSelection(raw: unknown, allIds: string[], fallback: string[]): string[] {
  const ids =
    raw && typeof raw === 'object' && Array.isArray((raw as { selectedIds?: unknown }).selectedIds)
      ? ((raw as { selectedIds: unknown[] }).selectedIds as unknown[])
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of ids) {
    const id = String(v);
    if (allIds.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length ? out : fallback;
}

/**
 * Làm sạch cấu hình tab menu đọc từ bộ nhớ: bỏ id không được phép (tính năng ẩn như Hoa hồng,
 * hoặc ngoài quyền đại lý), bỏ trùng, rồi bù bằng mặc định (và tiếp theo là các id được phép)
 * cho đủ `max` tab.
 */
export function sanitizeMenuTabIds(raw: unknown, allowed: string[], defaults: string[], max: number): string[] {
  const out: string[] = [];
  const push = (id: unknown) => {
    if (out.length < max && typeof id === 'string' && allowed.includes(id) && !out.includes(id)) out.push(id);
  };
  if (Array.isArray(raw)) raw.forEach(push);
  defaults.forEach(push);
  allowed.forEach(push);
  return out;
}

/**
 * Các tính năng hiển thị trên Trang chủ (và tab "Trang chủ" của Tất cả quản lý).
 * - `stored`: cấu hình đã JSON.parse ({ selectedIds }), `undefined` nếu chưa lưu, rác nếu hỏng.
 * - `isAgency`: `null` khi không đọc được loại tài khoản → coi như đại lý (an toàn hơn là
 *   để lộ tính năng ngoài quyền).
 * - Chủ ý lưu 0 mục (tài khoản thường) được giữ; còn nếu mọi id đã lưu đều không còn hợp lệ
 *   (tính năng bị ẩn/xoá) thì dùng mặc định. Đại lý không bao giờ bị trống.
 */
export function resolveHomeFeatureIds(opts: {
  stored: unknown;
  isAgency: boolean | null;
  allIds: string[];
  menuEligible: string[];
  max: number;
}): string[] {
  const agency = opts.isAgency !== false;
  const visible = visibleFeatureIds(opts.allIds, { isAgency: agency, menuOnly: false, menuEligible: opts.menuEligible });
  const defaults = agency ? visible : visible.slice(0, opts.max);
  const saved = (opts.stored as { selectedIds?: unknown } | null | undefined)?.selectedIds;
  if (!Array.isArray(saved)) return defaults;
  if (saved.length === 0) return agency ? defaults : [];
  const valid = normalizeSelection({ selectedIds: saved }, visible, []);
  return valid.length ? valid.slice(0, opts.max) : defaults;
}
