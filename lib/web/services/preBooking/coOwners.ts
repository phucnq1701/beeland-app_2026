// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/coOwners.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Người đồng đứng tên khi đổi tên (spec docs/superpowers/specs/2026-10-27-doi-ten-dong-dung-ten-design.md).
 * - Yêu cầu đổi tên lưu `dong_so_huu_cu` / `dong_so_huu_moi` = mảng uuid khách (`null` = yêu cầu cũ, không đổi đồng đứng tên).
 * - Dòng vòng đời (`tt_khach_hang`, `payload.TTKhachHang`) lưu `ListKhachHang = [{ STT, MaKH }]`.
 */

/** Trim, bỏ rỗng, bỏ trùng (giữ thứ tự), bỏ khách chính `excludeId`. */
export const normalizeCoOwnerIds = (ids: unknown, excludeId?: string | null): string[] => {
  const skip = String(excludeId ?? "").trim();
  const out: string[] = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = String(raw ?? "").trim();
    if (!id || id === skip || out.includes(id)) continue;
    out.push(id);
  }
  return out;
};

/** MaKH của người đồng đứng tên trong `tt_khach_hang` / `TTKhachHang` (mảng hoặc object đơn của dữ liệu cũ). */
export const coOwnerIdsFromCustomerJson = (tt: unknown): string[] => {
  const list = (tt as { ListKhachHang?: unknown } | null | undefined)?.ListKhachHang;
  const arr: unknown[] = Array.isArray(list) ? list : list ? [list] : [];
  return normalizeCoOwnerIds(arr.map((c) => (c as { MaKH?: unknown } | null)?.MaKH));
};

/** Người đồng đứng tên hiện tại của dòng vòng đời: `tt_khach_hang`, thiếu `ListKhachHang` thì `payload.TTKhachHang`. */
export const lifecycleCoOwnerIds = (
  life: { tt_khach_hang?: unknown; payload?: unknown } | null | undefined
): string[] => {
  const tt = life?.tt_khach_hang as { ListKhachHang?: unknown } | null | undefined;
  return coOwnerIdsFromCustomerJson(
    tt?.ListKhachHang != null ? tt : (life?.payload as { TTKhachHang?: unknown } | null | undefined)?.TTKhachHang
  );
};

/** Bản sao `tt` với `ListKhachHang` thay bằng `ids`; `ids === null` ⇒ giữ nguyên. */
export const applyCoOwnersToCustomerJson = <T extends Record<string, unknown>>(
  tt: T | null | undefined,
  ids: string[] | null
): T => {
  const out = { ...((tt || {}) as T) };
  if (ids === null) return out;
  return { ...out, ListKhachHang: ids.map((MaKH, STT) => ({ STT, MaKH })) };
};
