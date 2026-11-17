/**
 * Đọc kết quả các hàm danh sách máy chủ (không import — test nạp được).
 *
 * Web đổi hàng loạt hàm danh sách sang bản mới (2026-10-14): công ty + phạm vi dự án lấy từ JWT, tham số
 * `p_project_id` (1 uuid), `p_search`, `p_page`, `p_size`; trả `{ rows, total }`:
 *   fn_booking_list, fn_deposit_list, fn_signing_appointment_list (web `src/services/sales/booking-list`, …).
 * Bản cũ trả mảng dòng kèm `total_count` hoặc `{ rows, total_count }` — vẫn đọc được.
 */

/** `{ rows, total }` từ mọi dạng trả về của hàm danh sách. */
export function listResult(data: unknown): { rows: any[]; total: number } {
  if (Array.isArray(data)) {
    const t = Number(data[0]?.total_count);
    return { rows: data, total: Number.isFinite(t) && t > 0 ? t : data.length };
  }
  const d: any = data ?? {};
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const t = Number(d.total ?? d.total_count);
  return { rows, total: Number.isFinite(t) ? t : rows.length };
}

/** Tham số phân trang của hàm bản mới. */
export function pageArgs(pageIndex: unknown, pageSize: unknown) {
  const page = Math.max(1, Math.floor(Number(pageIndex)) || 1);
  const sizeRaw = Number(pageSize);
  const size = Number.isFinite(sizeRaw) ? Math.max(1, Math.floor(sizeRaw)) : 50;
  return { p_page: page, p_size: size };
}

/**
 * App cho chọn nhiều dự án, hàm bản mới chỉ nhận 1 dự án: gọi từng dự án với trang 1 cỡ `pageIndex × pageSize`,
 * rồi gộp ở đây — bỏ trùng id, mới nhất trước (như thứ tự máy chủ), dòng thiếu ngày xếp cuối, cắt đúng trang.
 */
export function mergeProjectPages<T extends { id?: any }>(
  pages: { rows: T[]; total: number }[],
  pageIndex: number,
  pageSize: number,
  dateOf: (row: T) => unknown
): { rows: T[]; total: number } {
  const seen = new Set<string>();
  const all: T[] = [];
  let total = 0;
  for (const p of pages || []) {
    total += Number(p?.total) || 0;
    for (const r of p?.rows || []) {
      const key = r?.id != null ? String(r.id) : "";
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      all.push(r);
    }
  }
  const time = (r: T) => {
    const t = Date.parse(String(dateOf(r) ?? ""));
    return Number.isFinite(t) ? t : null;
  };
  all.sort((a, b) => {
    const ta = time(a);
    const tb = time(b);
    if (ta === tb) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb - ta;
  });
  const size = Math.max(1, Number(pageSize) || 1);
  const start = (Math.max(1, Number(pageIndex) || 1) - 1) * size;
  return { rows: all.slice(start, start + size), total };
}

/**
 * Màn phân trang theo offset (vd Khách hàng) gọi hàm bản mới theo trang: offset chia hết cho limit ⇒ trang tương ứng;
 * lệch ⇒ lấy trang 1 cỡ offset + limit rồi bỏ `skip` dòng đầu.
 */
export function pageWindow(offset: unknown, limit: unknown): { p_page: number; p_size: number; skip: number } {
  const size = Math.max(1, Math.floor(Number(limit)) || 1);
  const off = Math.max(0, Math.floor(Number(offset)) || 0);
  if (off % size === 0) return { p_page: off / size + 1, p_size: size, skip: 0 };
  return { p_page: 1, p_size: off + size, skip: off };
}
