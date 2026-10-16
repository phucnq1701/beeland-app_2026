/**
 * Phạm vi dự án / sản phẩm theo đúng hàm máy chủ web dùng (không import — test nạp được).
 *
 * - Dự án: `fn_da_project_list(p_keyword, p_page, p_size)` → `{ rows, total, company_empty }`
 *   (web `src/services/ProjectDaCloudService.ts` listManagedProjects). Máy chủ tự áp phạm vi `_da_project_scope()`:
 *   nhân viên đại lý ⇒ dự án gán cho đại lý ở tab Đại lý (`da_project_agencies`); nội bộ ⇒ dự án được gán
 *   (`dm_employee_projects`), full access / admin ⇒ mọi dự án công ty.
 * - Danh sách sản phẩm: `fn_bds_product_list(...)` → `{ rows, total_count }` (web màn Cao tầng / Thấp tầng):
 *   nhân viên đại lý ⇒ chỉ căn trong giỏ hàng hợp lệ; người khác ⇒ căn thuộc dự án trong phạm vi.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : null;
}

/** Dòng dự án từ `fn_da_project_list`; giữ quy tắc cũ của app: chỉ dự án `ap_dung = true`. */
export function projectRowsFromRpc(res: unknown): any[] {
  const rows = (res as any)?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter((r: any) => r && r.id && r.ap_dung === true);
}

/** offSet cũ của app tính từ 1 theo số bản ghi (1, 31, 61…) → trang (1, 2, 3…). */
export function pageIndexFromOffset(offSet: unknown, limit: number): number {
  const n = Number(offSet);
  const size = Math.max(1, Number(limit) || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor((n - 1) / size) + 1;
}

/** Tham số `fn_bds_product_list` từ payload cũ { MaKhu, MaPK, MaTT, FormCode, KyHieu, Limit, offSet }. */
export function productListRpcArgs(payload: any, projectUuid: string | null) {
  const p = payload || {};
  const limit = Math.max(1, Number(p.Limit ?? p.limit ?? 50) || 50);
  const offSet = p.offSet ?? p.offset ?? 1;
  const form = String(p.FormCode ?? p.formCode ?? "").trim();
  const kw = String(p.InputSearch ?? p.KyHieu ?? p.kyHieu ?? p.keyword ?? "").trim();
  return {
    p_ma_da: projectUuid,
    p_ma_khu: uuidOrNull(p.MaKhu ?? p.maKhu),
    p_ma_pk: uuidOrNull(p.MaPK ?? p.maPK),
    p_ma_tang: uuidOrNull(p.MaTang ?? p.maTang),
    p_ma_tt: uuidOrNull(p.MaTT ?? p.maTT),
    p_form_code: form || null,
    p_input_search: kw || null,
    p_page_index: pageIndexFromOffset(offSet, limit),
    p_page_size: limit,
    p_trash: false,
  };
}

/** id sản phẩm (đúng thứ tự máy chủ) + tổng số từ `fn_bds_product_list`. */
export function productIdsFromRpc(res: unknown): { ids: string[]; total: number } {
  const rows = (res as any)?.rows;
  const ids = Array.isArray(rows)
    ? rows.map((r: any) => uuidOrNull(r?.id)).filter((id: string | null): id is string => !!id)
    : [];
  const total = Number((res as any)?.total_count ?? 0);
  return { ids, total: Number.isFinite(total) ? total : 0 };
}

/** Xếp các dòng đọc lại theo thứ tự id của máy chủ; dòng không có trong `ids` bị bỏ. */
export function orderByIds<T extends { id?: any }>(ids: string[], rows: T[]): T[] {
  const byId = new Map<string, T>();
  (rows || []).forEach((r) => {
    if (r && r.id != null) byId.set(String(r.id), r);
  });
  return ids.map((id) => byId.get(id)).filter((r): r is T => !!r);
}
