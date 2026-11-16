/**
 * SHIM VIẾT TAY (không tự sinh) — thay `@/integrations/supabase/client` của web cho các module web chép nguyên văn ở lib/web.
 *
 * App không dùng Supabase: chỉ cho phép đúng các hàm máy chủ CHỈ ĐỌC mà module chép cần, đối chiếu sang bộ API riêng app
 * (fn_nv_app_* trả cùng dữ liệu với hàm web — đã so HTTP app ↔ web). Hàm lạ ⇒ trả { error } (module web tự xử lý như lỗi máy chủ).
 * `.from(bảng)`: chỉ `da_projects` (tên dự án để hiển thị, đọc qua fn_nv_app_du_an_list); bảng khác ⇒ { error }.
 */
import { callNv, errorMessage } from "@/services/nvApi";
import { DuAnApi } from "@/services/SanPhamApi";

type RpcResult = { data: any; error: { message: string; code?: string } | null };

/** Tên hàm web ⇒ endpoint app (tham số giữ nguyên tên trừ khi khai báo `args`) */
export const RPC_MAP: Record<string, { fn: string; args?: (a: any) => Record<string, unknown> }> = {
  fn_get_byid_sales_policy: { fn: "fn_nv_app_chinh_sach_chi_tiet", args: (a) => ({ p_id: a?.p_id ?? null }) },
  fn_get_byid_payment_schedule: { fn: "fn_nv_app_lich_tt_chi_tiet", args: (a) => ({ p_id: a?.p_id ?? null }) },
};

async function rpc(name: string, args?: any): Promise<RpcResult> {
  const m = RPC_MAP[name];
  if (!m) return { data: null, error: { message: `App không hỗ trợ ${name}`, code: "APP_UNSUPPORTED" } };
  try {
    return { data: await callNv(m.fn, m.args ? m.args(args) : args ?? {}), error: null };
  } catch (e: any) {
    return { data: null, error: { message: errorMessage(e), code: e?.code } };
  }
}

/** Bộ dựng truy vấn tối giản cho `.from("da_projects").select(…).eq(…).order(…)` (await được); bộ lọc khác bỏ qua */
function from(table: string) {
  const filters: Record<string, unknown> = {};
  const run = async (): Promise<RpcResult> => {
    if (table !== "da_projects") return { data: null, error: { message: `App không đọc thẳng bảng ${table}`, code: "APP_UNSUPPORTED" } };
    try {
      const { rows } = await DuAnApi.list({ size: 1000 });
      let data = rows.map((p: any) => ({ id: p.id, ten_da: p.ten_da ?? p.TenDA ?? "", ma_da_code: p.ma_da_code ?? p.MaDA ?? null }));
      if (filters.id != null) data = data.filter((r: any) => String(r.id) === String(filters.id));
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: errorMessage(e) } };
    }
  };
  const q: any = {
    select: () => q,
    order: () => q,
    limit: () => q,
    in: () => q,
    eq: (col: string, v: unknown) => {
      if (col === "id") filters.id = v;
      return q;
    },
    maybeSingle: async () => {
      const r = await run();
      return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data };
    },
    single: async () => {
      const r = await run();
      return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data };
    },
    then: (ok: (r: RpcResult) => unknown, fail?: (e: unknown) => unknown) => run().then(ok, fail),
  };
  return q;
}

export const supabase = { rpc, from };
