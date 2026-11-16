/**
 * SHIM VIẾT TAY (không tự sinh) — thay `@/integrations/supabase/client` của web cho các module web chép nguyên văn ở lib/web.
 *
 * App không dùng Supabase. `.rpc(tên web, tham số web)` chỉ cho các hàm có trong RPC_MAP: đối chiếu sang bộ API riêng app
 * (fn_nv_app_* bọc ĐÚNG SP web, công ty lấy từ phiên — đã so HTTP app ↔ web). Hàm lạ ⇒ { error } (module web xử lý như lỗi máy chủ)
 * và ghi log để biết thiếu gì. `.from(bảng)`: chỉ bảng trong TABLES (đọc qua endpoint app trả đúng cột thô); bảng khác ⇒ { error }.
 */
import { callNv, errorMessage } from "@/services/nvApi";
import { DuAnApi } from "@/services/SanPhamApi";

type RpcResult = { data: any; error: { message: string; code?: string } | null };
type Args = Record<string, any>;

const pick = (a: Args | undefined, map: Record<string, string>) => {
  const out: Args = {};
  for (const [to, from] of Object.entries(map)) out[to] = a?.[from] ?? null;
  return out;
};

/** Tên hàm web ⇒ endpoint app + đổi tham số (tham số công ty của web bỏ: máy chủ app lấy từ phiên) */
export const RPC_MAP: Record<string, { fn: string; args: (a: Args | undefined) => Args }> = {
  fn_get_byid_sales_policy: { fn: "fn_nv_app_chinh_sach_chi_tiet", args: (a) => pick(a, { p_id: "p_id" }) },
  fn_get_byid_payment_schedule: { fn: "fn_nv_app_lich_tt_chi_tiet", args: (a) => pick(a, { p_id: "p_id" }) },
  fn_get_current_price_lists: {
    fn: "fn_nv_app_bang_gia_hien_hanh",
    args: (a) => pick(a, { p_du_an_id: "p_da_project_id", p_loai: "p_type", p_san_pham_id: "p_product_id" }),
  },
  fn_get_sales_policies: { fn: "fn_nv_app_chinh_sach_list", args: (a) => pick(a, { p_du_an_id: "p_da_project_id", p_form_code: "p_form_code" }) },
  fn_get_payment_schedules: { fn: "fn_nv_app_lich_tt_list", args: (a) => pick(a, { p_du_an_id: "p_company_id", p_form_code: "p_form_code" }) },
  fn_get_promotions: { fn: "fn_nv_app_khuyen_mai_list", args: (a) => pick(a, { p_du_an_id: "p_da_project_id" }) },
  fn_sales_setting_resolve: { fn: "fn_nv_app_cai_dat_ban_hang", args: (a) => pick(a, { p_du_an_id: "p_ma_da", p_ngay: "p_at" }) },
  fn_price_list_quy_can_options: { fn: "fn_nv_app_quy_can_list", args: (a) => pick(a, { p_du_an_id: "p_project_id" }) },
  fn_caller_sales_company: { fn: "fn_nv_app_cong_ty_ban_hang_cua_toi", args: () => ({}) },
  fn_company_agency_map: { fn: "fn_nv_app_cong_ty_dai_ly", args: () => ({}) },
  fn_sales_policy_option_usage: {
    fn: "fn_nv_app_tuy_chon_da_dung",
    args: (a) => pick(a, { p_chinh_sach_id: "p_policy_id", p_tru_pgc_id: "p_exclude_pgc_id" }),
  },
  fn_gift_warehouse_stock_for_policy: {
    fn: "fn_nv_app_ton_kho_qua",
    args: (a) => pick(a, { p_chinh_sach_id: "p_policy_id", p_tru_pgc_id: "p_exclude_pgc" }),
  },
  fn_exception_request_active: { fn: "fn_nv_app_ngoai_le_hieu_luc", args: (a) => pick(a, { p_pgc_id: "p_pgc_id" }) },
  fn_customer_get_by_ids: { fn: "fn_nv_app_khach_hang_theo_id", args: (a) => pick(a, { p_ids: "p_ids", p_ma: "p_refs", p_co_anh: "p_with_images" }) },
  fn_customer_picker: {
    fn: "fn_nv_app_khach_hang_chon",
    args: (a) => pick(a, { p_tu_khoa: "p_search", p_so_dong: "p_limit", p_ca_nhan: "p_is_personal" }),
  },
  fn_status_catalog_list: { fn: "fn_nv_app_trang_thai_list", args: (a) => pick(a, { p_loai: "p_type" }) },
  fn_price_sheet_get: { fn: "fn_nv_app_ptg_chi_tiet", args: (a) => pick(a, { p_id: "p_id" }) },
  // Căn cho form (web BdsProductService.getBdsProductById) — = fn_get_product_by_id, công ty từ phiên
  fn_get_product_by_id: { fn: "fn_nv_app_san_pham_tinh_gia", args: (a) => pick(a, { p_id: "p_id" }) },
  // Lưu phiếu: duyệt vẫn trên web; p_host_form web (màn nhúng) app không dùng
  fn_price_sheet_save: { fn: "fn_nv_app_ptg_luu", args: (a) => pick(a, { p_row: "p_row" }) },
  // Form booking: giá căn theo bảng giá (SP 77 = đúng SP web, cùng bộ cột)
  fn_get_price_list_item_by_product: {
    fn: "fn_nv_app_gia_can_bang_gia",
    args: (a) => pick(a, { p_price_list_id: "p_price_list_id", p_product_id: "p_product_id" }),
  },
};

const unsupported = (what: string): RpcResult => {
  console.log(`[lib/web shim] app không hỗ trợ ${what}`);
  return { data: null, error: { message: `App không hỗ trợ ${what}`, code: "APP_UNSUPPORTED" } };
};

async function call(fn: string, args: Args): Promise<RpcResult> {
  try {
    return { data: await callNv(fn, args), error: null };
  } catch (e: any) {
    return { data: null, error: { message: errorMessage(e), code: e?.code } };
  }
}

async function rpc(name: string, args?: Args): Promise<RpcResult> {
  const m = RPC_MAP[name];
  if (!m) return unsupported(name);
  return call(m.fn, m.args(args));
}

type Filters = { eq: Record<string, unknown>; in: Record<string, unknown[]>; or: [string, string][] };

/** Bảng đọc được: dựng từ endpoint app trả đúng cột thô của bảng (lọc lại theo eq/in phía máy cho chắc) */
const TABLES: Record<string, (f: Filters) => Promise<RpcResult>> = {
  // Tên dự án để hiển thị (web DaPaymentScheduleService / DaSalesPolicyService.projectName)
  da_projects: async () => {
    try {
      const { rows } = await DuAnApi.list({ size: 1000 });
      return {
        data: rows.map((p: any) => ({
          id: p.id,
          ten_da: p.ten_da ?? p.TenDA ?? "",
          ten_viet_tat: p.ten_viet_tat ?? null,
          ma_da_code: p.ma_da_code ?? p.MaDA ?? null,
        })),
        error: null,
      };
    } catch (e: any) {
      return { data: null, error: { message: errorMessage(e) } };
    }
  },
  // PricingConfigCloudService.list: công ty + dự án + form_code (mẫu chung la_mau_chung: app không đọc ⇒ rỗng)
  cloud_pricing_configs: async (f) => {
    if (f.eq.la_mau_chung === true) return { data: [], error: null };
    if (!f.eq.ma_da || !f.eq.form_code) return unsupported("cloud_pricing_configs (thiếu dự án / biểu mẫu)");
    return call("fn_nv_app_cau_hinh_tinh_gia_list", { p_du_an_id: f.eq.ma_da, p_form_codes: [f.eq.form_code] });
  },
  // PricingConfigCloudService.listRounds (cau_hinh_id) / getRound (id)
  cloud_pricing_config_rounds: async (f) => {
    if (f.eq.id) return call("fn_nv_app_cau_hinh_tinh_gia_dot", { p_id: f.eq.id });
    if (f.eq.cau_hinh_id) return call("fn_nv_app_cau_hinh_tinh_gia_dot", { p_cau_hinh_id: f.eq.cau_hinh_id });
    return unsupported("cloud_pricing_config_rounds (thiếu khoá)");
  },
  // Công ty hệ thống (mẫu chung) — app không đọc mẫu chung
  cloud_companies: async () => ({ data: [], error: null }),
  // Quy tắc đánh mã đọc phía máy (utils/codePattern.loadCodeRules — nhánh dự phòng khi máy chủ không trả số phiếu): app không đọc,
  // số phiếu xem trước luôn lấy ở máy chủ (fn_nv_app_ma_phieu); trống ⇒ máy chủ cấp khi lưu
  cloud_code_rules: async () => ({ data: [], error: null }),
  // Căn theo uuid / ma_sp / ký hiệu (salesDocsCloud.resolveProductUid / resolveProjectUidByProduct, BdsProductService.resolveBdsProductId):
  // fn_get_product_by_id của web (cột thô bds_products, công ty + phạm vi đại lý ở SP) — lọc lại eq / or phía máy
  bds_products: async (f) => {
    const keys = [f.eq.id, ...f.or.map(([, v]) => v)].filter((v) => v != null && String(v).trim() !== "");
    for (const k of keys) {
      const r = await call("fn_nv_app_san_pham_tinh_gia", { p_id: String(k) });
      if (r.error) return r;
      if (r.data) return { data: [r.data], error: null };
    }
    return keys.length ? { data: [], error: null } : unsupported("bds_products (thiếu khoá)");
  },
};

const applyFilters = (rows: any[], f: Filters) =>
  rows.filter(
    (r) =>
      Object.entries(f.eq).every(([k, v]) => r?.[k] === undefined || String(r[k]).toLowerCase() === String(v).toLowerCase()) &&
      Object.entries(f.in).every(([k, vs]) => r?.[k] === undefined || vs.map((v) => String(v).toLowerCase()).includes(String(r[k]).toLowerCase())) &&
      (f.or.length === 0 || f.or.some(([k, v]) => r?.[k] !== undefined && String(r[k]).toLowerCase() === String(v).toLowerCase()))
  );

/** `.or("a.eq.x,b.eq.y")` của PostgREST — chỉ dạng eq */
const parseOr = (expr: string): [string, string][] =>
  String(expr || "")
    .split(",")
    .map((p) => p.match(/^([\w]+)\.eq\.(.*)$/))
    .filter(Boolean)
    .map((m) => [m![1], m![2]] as [string, string]);

/** Bộ dựng truy vấn tối giản: select / eq / in / order / limit / maybeSingle / single / await — chỉ đọc */
function from(table: string) {
  const f: Filters = { eq: {}, in: {}, or: [] };
  let write = false;
  const run = async (): Promise<RpcResult> => {
    if (write) return unsupported(`ghi bảng ${table}`);
    const h = TABLES[table];
    if (!h) return unsupported(`đọc thẳng bảng ${table}`);
    const r = await h(f);
    return r.error || !Array.isArray(r.data) ? r : { data: applyFilters(r.data, f), error: null };
  };
  const one = async () => {
    const r = await run();
    return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data };
  };
  const q: any = {
    select: () => q,
    order: () => q,
    limit: () => q,
    range: () => q,
    eq: (col: string, v: unknown) => ((f.eq[col] = v), q),
    in: (col: string, vs: unknown[]) => ((f.in[col] = Array.isArray(vs) ? vs : []), q),
    or: (expr: string) => ((f.or = [...f.or, ...parseOr(expr)]), q),
    insert: () => ((write = true), q),
    update: () => ((write = true), q),
    upsert: () => ((write = true), q),
    delete: () => ((write = true), q),
    maybeSingle: one,
    single: one,
    then: (ok: (r: RpcResult) => unknown, fail?: (e: unknown) => unknown) => run().then(ok, fail),
  };
  return q;
}

export const supabase = { rpc, from };
