// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/coOwnerRefs.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { resolveCustomerUid } from "../salesDocsCloud";
import { normalizeCoOwnerIds } from "./coOwners";

/**
 * Giải danh sách người đồng đứng tên (MaKH cũ / uuid) sang uuid khách, bỏ trùng và bỏ khách chính.
 * Một phần tử không giải được ⇒ lỗi (không lặng lẽ bỏ người đồng đứng tên).
 */
export const resolveCoOwnerUids = async (
  refs: unknown[] | null | undefined,
  mainRef?: unknown
): Promise<{ ok: boolean; ids: string[]; message: string | null }> => {
  const main = mainRef == null || mainRef === "" ? null : await resolveCustomerUid(mainRef);
  const ids: string[] = [];
  for (const ref of normalizeCoOwnerIds(refs)) {
    const id = await resolveCustomerUid(ref);
    if (!id) return { ok: false, ids: [], message: "Người đồng đứng tên chưa có trong danh mục khách hàng" };
    ids.push(id);
  }
  return { ok: true, ids: normalizeCoOwnerIds(ids, main), message: null };
};
