// ⚠️ TỰ SINH — trích nguyên văn từ web src/services/system/permitted-company/index.ts (scripts/sync-web-pricing.cjs): cleanCompanyIds, isUid. KHÔNG SỬA TAY.
/**
 * Danh sách công ty nhân viên đăng nhập được quyền xem.
 * Truy vấn 1 lần qua hàm CSDL `fn_ds_company_tree` (trần phạm vi: công ty của mình
 * + "Quyền xem công ty" + mọi công ty con) thay vì tải toàn bộ dm_companies rồi lọc ở client.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUid = (v: any) => UUID_RE.test(String(v ?? "").trim());

/** Danh sách công ty lọc gửi `p_company_ids`: chỉ giữ uuid hợp lệ; rỗng / không phải mảng ⇒ null (không lọc) */
export const cleanCompanyIds = (ids: any): string[] | null => {
  const list = (Array.isArray(ids) ? ids : []).map((v) => String(v).trim()).filter(isUid);
  return list.length ? list : null;
};
