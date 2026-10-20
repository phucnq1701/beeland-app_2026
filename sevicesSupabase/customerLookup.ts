/**
 * Đọc khách hàng qua RPC — như web beeland/src/services/customers/customer-lookup (Đợt 5, migration
 * 20261020000510_ds_dot5_customer_revoke: bảng cloud_customers đã khoá đọc / ghi thẳng qua PostgREST).
 *
 * - `fn_customer_get_by_ids(p_ids, p_refs, p_with_images)`: khách trong công ty được xem ⇒ dòng đầy đủ; khách công ty khác
 *   nằm trên chứng từ người gọi thấy ⇒ bản giới hạn (`limited: true`). Ngoài cả hai ⇒ không có trong kết quả.
 *   ≤ 500 id, ≤ 50 mã / SĐT mỗi lần.
 * - `fn_customer_picker(p_search, p_limit, …)`: ô chọn khách ở màn khác, từ khoá ≥ 2 ký tự, ≤ 50 dòng.
 * Thay cho embed `kh:cloud_customers!khach_hang_id(...)` và `rest/v1/cloud_customers`.
 */
import axiosApiSupabase from "./axiosApiSupabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUid = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s.toLowerCase() : null;
};

const BATCH_IDS = 500;
const BATCH_REFS = 50;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const errorMessage = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.hint || (e instanceof Error && e.message) || fallback;

async function rpc<T = any>(fn: string, body: Record<string, any>, fallback: string): Promise<T> {
  try {
    const res = await axiosApiSupabase.post(`rest/v1/rpc/${fn}`, body);
    return res.data as T;
  } catch (e) {
    throw new Error(errorMessage(e, fallback));
  }
}

/** Dòng khách (cột bảng + `cty`, `creator`, `updater`, `limited`) theo danh sách uuid — lỗi máy chủ ném ra */
export async function getCustomersByIds(ids: unknown[], opts: { withImages?: boolean } = {}): Promise<any[]> {
  const list = Array.from(new Set(ids.map(asUid).filter(Boolean) as string[]));
  if (!list.length) return [];
  const parts = await Promise.all(
    chunk(list, BATCH_IDS).map((p) =>
      rpc<any[]>(
        "fn_customer_get_by_ids",
        { p_ids: p, p_refs: null, p_with_images: !!opts.withImages },
        "Không tải được khách hàng"
      )
    )
  );
  return parts.flatMap((p) => (Array.isArray(p) ? p : []));
}

/** Dòng khách theo mã khách hàng (`ma_so_kh`) hoặc số di động (`di_dong`), so khớp đúng */
export async function getCustomersByRefs(refs: unknown[]): Promise<any[]> {
  const list = Array.from(new Set(refs.map((r) => String(r ?? "").trim()).filter(Boolean)));
  if (!list.length) return [];
  const parts = await Promise.all(
    chunk(list, BATCH_REFS).map((p) =>
      rpc<any[]>("fn_customer_get_by_ids", { p_ids: null, p_refs: p, p_with_images: false }, "Không tải được khách hàng")
    )
  );
  return parts.flatMap((p) => (Array.isArray(p) ? p : []));
}

/** Map uuid → dòng khách (lỗi ⇒ map rỗng: màn chứng từ vẫn hiện, chỉ thiếu tên khách) */
export async function customerMapByIds(ids: unknown[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  try {
    (await getCustomersByIds(ids)).forEach((r) => {
      const id = asUid(r?.id);
      if (id) map.set(id, r);
    });
  } catch {
    /* thiếu tên khách không chặn màn hình */
  }
  return map;
}

/** Tên hiển thị của khách: tên cá nhân, không có thì tên công ty */
export const customerDisplayName = (r: any): string =>
  String(r?.ten_kh ?? "").trim() || String(r?.ten_cong_ty ?? "").trim();

/**
 * Cột khách gắn vào chứng từ — cùng các cột embed `kh:cloud_customers!khach_hang_id(...)` cũ. Bản giới hạn: `cccd` = null
 * (CCCD đã che chỉ ở `cccd_masked`).
 */
export const slimCustomer = (r: any) =>
  r
    ? {
        id: r.id,
        ma_so_kh: r.ma_so_kh ?? null,
        ten_kh: r.ten_kh ?? null,
        ten_cong_ty: r.ten_cong_ty ?? null,
        cccd: r.limited === true ? null : r.cccd ?? null,
        cccd_masked: r.limited === true ? r.cccd ?? null : null,
        dien_thoai: r.dien_thoai ?? null,
        di_dong: r.di_dong ?? null,
        email: r.email ?? null,
        dia_chi: r.dia_chi ?? null,
        limited: r.limited === true,
      }
    : null;

/**
 * Gắn `kh` (khách) cho từng dòng chứng từ và cho các object lồng (`pgc` …) có `khach_hang_id` — 1 lần gọi RPC cho cả trang.
 * Thay embed `kh:cloud_customers!khach_hang_id(...)`. Lỗi ⇒ `kh = null` (không chặn danh sách).
 */
export async function withCustomers<T>(
  input: T,
  opts: { key?: string; as?: string; nested?: string[] } = {}
): Promise<T> {
  const key = opts.key ?? "khach_hang_id";
  const as = opts.as ?? "kh";
  const nested = opts.nested ?? ["pgc"];
  const rows: any[] = (Array.isArray(input) ? input : [input]).filter((r) => r && typeof r === "object");
  const holders: any[] = [];
  rows.forEach((r) => {
    holders.push(r);
    nested.forEach((n) => {
      const v = r?.[n];
      (Array.isArray(v) ? v : [v]).forEach((x) => {
        if (x && typeof x === "object") holders.push(x);
      });
    });
  });
  const ids = holders.map((h) => h?.[key]).filter((v) => asUid(v));
  const map = ids.length ? await customerMapByIds(ids) : new Map<string, any>();
  holders.forEach((h) => {
    if (!(key in h) && !(as in h)) return;
    const id = asUid(h?.[key]);
    h[as] = id ? slimCustomer(map.get(id)) : null;
  });
  return input;
}

/** Ô chọn khách ở màn khác — `fn_customer_picker` (từ khoá ≥ 2 ký tự, ≤ 50 dòng). Lỗi máy chủ ném ra. */
export async function pickCustomers(
  keyword: string,
  opts: { limit?: number; companyIds?: string[]; isPersonal?: boolean | null; isNoxh?: boolean | null } = {}
): Promise<any[]> {
  const kw = String(keyword ?? "").trim();
  if (kw.length < 2) return [];
  const companyIds = (opts.companyIds || []).map(asUid).filter(Boolean) as string[];
  const res = await rpc<any>(
    "fn_customer_picker",
    {
      p_search: kw,
      p_limit: Math.min(50, Math.max(1, opts.limit ?? 20)),
      p_company_ids: companyIds.length ? companyIds : null,
      p_is_personal: opts.isPersonal == null ? null : !!opts.isPersonal,
      p_is_noxh: opts.isNoxh == null ? null : !!opts.isNoxh,
    },
    "Không thể tìm khách hàng"
  );
  return Array.isArray(res?.rows) ? res.rows : [];
}
