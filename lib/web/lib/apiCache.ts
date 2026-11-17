// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/apiCache.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Bộ nhớ đệm ngắn hạn dùng chung cho các lời gọi danh mục / dự án.
 *
 * Mục tiêu: các module (phiếu thu, công nợ, hợp đồng, đặt cọc, khách hàng...)
 * đều gọi lại cùng một danh mục nền mỗi lần mở trang → gộp và tái sử dụng
 * kết quả trong một khoảng thời gian ngắn, đồng thời gộp các lời gọi song song
 * (in-flight dedupe) để chỉ đi mạng đúng 1 lần.
 */

type Entry = { at: number; ttl: number; value: any };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

/** TTL mặc định 60 giây — đủ để 1 phiên thao tác không gọi lại danh mục. */
export const DEFAULT_TTL = 60_000;

/**
 * Gọi hàm bất đồng bộ có nhớ kết quả theo key trong `ttl` mili giây.
 * Lỗi không được cache (để lần sau còn thử lại).
 */
export const memoAsync = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> => {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      store.set(key, { at: Date.now(), ttl, value });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p as Promise<T>;
};

/** Xóa cache theo tiền tố key (bỏ trống = xóa tất cả). */
export const clearApiCache = (prefix?: string) => {
  if (!prefix) {
    store.clear();
    inflight.clear();
    return;
  }
  for (const k of Array.from(store.keys()))
    if (k.startsWith(prefix)) store.delete(k);
  for (const k of Array.from(inflight.keys()))
    if (k.startsWith(prefix)) inflight.delete(k);
};
