// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/customers/customer-lookup/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";

/**
 * ĐỌC KHÁCH HÀNG QUA RPC (Đợt 5 — bảng cloud_customers đã khoá đọc / ghi thẳng qua PostgREST).
 *
 * - `fn_customer_get_by_ids(p_ids, p_refs, p_with_images)`: khách trong ① (công ty được xem) ⇒ dòng đầy đủ; khách công ty khác
 *   nhưng nằm trên chứng từ người gọi thấy ⇒ bản giới hạn (`limited: true` — tên, SĐT, địa chỉ, CCCD che 4 số cuối). Ngoài cả hai
 *   ⇒ không có trong kết quả. ≤ 500 id, ≤ 50 mã / SĐT mỗi lần.
 * - `fn_customer_picker(p_search, p_limit, …)`: ô chọn khách ở màn khác (① , không áp "Theo nhân viên"), từ khoá ≥ 2 ký tự, ≤ 50 dòng.
 * - `fn_customer_count()`: số khách trong ①.
 * Thay cho embed `kh:cloud_customers!khach_hang_id(...)` và `.from("cloud_customers")`.
 */

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

/** Dòng khách (cột bảng + `cty`, `creator`, `updater`, `limited`) theo danh sách uuid — lỗi máy chủ ném ra */
export const getCustomersByIds = async (
  ids: unknown[],
  opts: { withImages?: boolean } = {},
): Promise<any[]> => {
  const list = Array.from(new Set(ids.map(asUid).filter(Boolean) as string[]));
  if (!list.length) return [];
  const parts = await Promise.all(
    chunk(list, BATCH_IDS).map((p) =>
      rpcRaw<any[]>(
        "fn_customer_get_by_ids",
        { p_ids: p, p_refs: null, p_with_images: !!opts.withImages },
        { fallback: "Không tải được khách hàng" },
      ),
    ),
  );
  return parts.flatMap((p) => (Array.isArray(p) ? p : []));
};

/** Dòng khách theo mã khách hàng (`ma_so_kh`) hoặc số di động (`di_dong`), so khớp đúng */
export const getCustomersByRefs = async (refs: unknown[]): Promise<any[]> => {
  const list = Array.from(new Set(refs.map((r) => String(r ?? "").trim()).filter(Boolean)));
  if (!list.length) return [];
  const parts = await Promise.all(
    chunk(list, BATCH_REFS).map((p) =>
      rpcRaw<any[]>(
        "fn_customer_get_by_ids",
        { p_ids: null, p_refs: p, p_with_images: false },
        { fallback: "Không tải được khách hàng" },
      ),
    ),
  );
  return parts.flatMap((p) => (Array.isArray(p) ? p : []));
};

/** Map uuid → dòng khách (lỗi ⇒ map rỗng: màn chứng từ vẫn hiện, chỉ thiếu tên khách) */
export const customerMapByIds = async (ids: unknown[]): Promise<Map<string, any>> => {
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
};

/** Tên hiển thị của khách: tên cá nhân, không có thì tên công ty */
export const customerDisplayName = (r: any): string =>
  String(r?.ten_kh ?? "").trim() || String(r?.ten_cong_ty ?? "").trim();

/** uuid → tên khách */
export const customerNameMap = async (ids: unknown[]): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  (await customerMapByIds(ids)).forEach((r, id) => {
    out[id] = customerDisplayName(r);
  });
  return out;
};

/**
 * Cột khách gắn vào chứng từ — cùng các cột embed `kh:cloud_customers!khach_hang_id(...)` cũ. Bản giới hạn: `cccd` = null
 * (CCCD đã che chỉ ở `cccd_masked`) để `mapSalesDoc.so_cmnd` / `SoCMND` không mang giá trị che vào form chứng từ.
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
        email: r.email ?? null,
        dia_chi: r.dia_chi ?? null,
        limited: r.limited === true,
      }
    : null;

/**
 * Gắn `kh` (khách) cho từng dòng chứng từ và cho các object lồng (`pgc` …) có `khach_hang_id` — 1 lần gọi RPC cho cả trang.
 * Thay embed PostgREST `kh:cloud_customers!khach_hang_id(...)`. Lỗi ⇒ `kh = null` (không chặn danh sách).
 */
export const withCustomers = async <T,>(
  input: T,
  opts: { key?: string; as?: string; nested?: string[] } = {},
): Promise<T> => {
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
};

/**
 * uuid khách khớp từ khoá (tìm chứng từ theo tên / SĐT / mã khách) — qua ô chọn `fn_customer_picker` (① , ≤ 50).
 * Từ khoá < 2 ký tự hoặc lỗi ⇒ [].
 */
export const searchCustomerIds = async (keyword: string, limit = 50): Promise<string[]> => {
  const kw = String(keyword ?? "").trim();
  if (kw.length < 2) return [];
  try {
    const res = await rpcRaw<any>("fn_customer_picker", {
      p_search: kw,
      p_limit: Math.min(50, Math.max(1, limit)),
      p_company_ids: null,
      p_is_personal: null,
      p_is_noxh: null,
    });
    return (Array.isArray(res?.rows) ? res.rows : []).map((r: any) => asUid(r?.id)).filter(Boolean) as string[];
  } catch {
    return [];
  }
};

/**
 * uuid khách cho ô tìm CHỨNG TỪ theo tên / SĐT / mã khách — `fn_sales_doc_customer_ids`: khách trong công ty được xem (mọi trường)
 * ∪ khách công ty khác nằm trên chứng từ người gọi thấy (chỉ tên / SĐT / mã), ≤ limit (mặc định 500, tối đa 2000).
 * Từ khoá < 2 ký tự hoặc lỗi ⇒ [].
 */
export const searchDocCustomerIds = async (keyword: string, limit = 500): Promise<string[]> => {
  const kw = String(keyword ?? "").trim();
  if (kw.length < 2) return [];
  try {
    const ids = await rpcRaw<string[]>("fn_sales_doc_customer_ids", {
      p_search: kw,
      p_limit: Math.min(2000, Math.max(1, limit)),
    });
    return (Array.isArray(ids) ? ids : []).map(asUid).filter(Boolean) as string[];
  } catch {
    return [];
  }
};

/** Số khách trong ① của người gọi (tab kiểm tra Cloud) */
export const countCustomers = async (): Promise<number> =>
  Number(await rpcRaw<number>("fn_customer_count", {}, { fallback: "Không đếm được khách hàng" })) || 0;
