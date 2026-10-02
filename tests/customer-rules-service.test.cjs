/* global __dirname */
// Luật khách hàng phía dữ liệu – so với web:
//  CustomerDuplicateService / CustomerDupRequestService / RequiredFieldService / FieldVisibilityService /
//  preBooking.countByKH / CustomerActivityCloudService.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tenant = uid(99);
const ME = uid(7);

function compile(file) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function run(file, requireMap) {
  const exports = {};
  vm.runInNewContext(compile(file), {
    exports, console: { log() {} }, Date, Promise,
    require: (name) => requireMap[name] ?? { default: {} },
  });
  return exports;
}

const rules = run("lib/customerRules.ts", {});

/** HTTP giả: tables[table] = rows | (params) => rows; ghi lại mọi lời gọi */
function harness(tables = {}, { failGet = {}, claims = {}, deleted = [] } = {}) {
  const calls = [];
  const http = {
    get: async (url, opts = {}) => {
      const table = url.replace("rest/v1/", "");
      calls.push({ method: "get", table, params: opts.params || {} });
      if (failGet[table]) throw new Error("boom");
      const t = tables[table];
      const data = typeof t === "function" ? t(opts.params || {}) : t ?? [];
      return { data, headers: { "content-range": `0-0/${Array.isArray(data) ? data.length : 0}` } };
    },
    post: async (url, body) => {
      const table = url.replace("rest/v1/", "");
      calls.push({ method: "post", table, body });
      return { data: [{ id: uid(500 + calls.length) }] };
    },
    patch: async (url, body) => {
      calls.push({ method: "patch", table: url.replace("rest/v1/", ""), body });
      return { data: [{ id: uid(1), ...body }] };
    },
    delete: async (url, opts) => {
      calls.push({ method: "delete", table: url.replace("rest/v1/", ""), params: opts?.params, headers: opts?.headers });
      return { data: deleted };
    },
  };
  const cloudTenant = {
    getCompanyId: async () => tenant,
    getTenantId: async () => tenant,
    getEmployeeId: async () => ME,
    getBranchId: async () => uid(8),
    getCompanyCode: async () => "BeeSky1",
    getMaNv: async () => "NV01",
    getTypeAccount: async () => "SYSTEM",
    getValidSupabaseJwt: async () => "jwt",
    decodeJwtPayload: () => claims,
    getUserCompanyId: async () => uid(8),
    getUserCompanyIds: async () => uid(8),
  };
  const map = {
    "./axiosApiSupabase": { default: http },
    "./axiosApi": { default: {} },
    "./cloudTenant": cloudTenant,
    "../lib/customerRules": rules,
    "@react-native-async-storage/async-storage": {
      default: { getItem: async (k) => (k === "@user" ? JSON.stringify({ ho_ten: "NV Test" }) : null) },
    },
  };
  const rulesExports = run("sevicesSupabase/CustomerRulesService.ts", map);
  map["./CustomerRulesService"] = rulesExports;
  return {
    calls,
    rulesService: rulesExports.CustomerRulesService,
    customerService: () => run("sevicesSupabase/CustomerService.ts", map).CustomerService,
  };
}

const form = (over = {}) => ({ ...rules.EMPTY_CUSTOMER_FORM, ...over });

test("duplicate config: missing row or read error → web defaults", async () => {
  const a = await harness().rulesService.getDuplicateConfig();
  assert.equal(a.defaultMode, "block");
  const b = await harness({}, { failGet: { cloud_catalogs: true } }).rulesService.getDuplicateConfig();
  assert.equal(b.ownDuplicateMode, "block");
  const h = harness({ cloud_catalogs: [{ raw: { defaultMode: "allow" } }] });
  assert.equal((await h.rulesService.getDuplicateConfig()).defaultMode, "allow");
  const q = h.calls[0].params;
  assert.equal(q.ma_ctdk_uid, `eq.${tenant}`);
  assert.equal(q.catalog_type, "eq.customer_duplicate");
  assert.equal(q.item_code, "eq.default");
});

test("phone duplicate of a customer with a sales contract is blocked", async () => {
  const h = harness({
    cloud_customers: (p) => (p.or.includes("di_dong.eq.0901") ? [{ id: uid(1), ten_kh: "Khách cũ", created_by_id: uid(2), created_at: "2026-01-01T00:00:00Z" }] : []),
    cloud_pgc_phieu_giucho: [{ giai_doan: "HDMB" }],
    dm_employees: [{ ho_ten: "NV Khác" }],
  });
  const res = await h.rulesService.checkDuplicate(form({ name: "A", phone: "0901" }));
  assert.equal(res.mode, "block");
  assert.equal(res.matches.length, 1);
  const m = res.matches[0];
  assert.equal(m.protection.level, "high");
  assert.equal(m.ownerName, "NV Khác");
  assert.equal(m.isOwn, false);
  assert.deepEqual([...m.fields], ["phone"]);
  assert.equal(m.isPersonal, true);
  const sel = h.calls.find((c) => c.table === "cloud_customers").params.select;
  assert.match(sel, /is_personal/);
  assert.match(sel, /email/);
  const care = h.calls.find((c) => c.table === "cloud_customer_activities");
  assert.equal(care.params.ma_ctdk, "eq.beesky1", "activities are scoped by the lowercase company code like the web");
});

test("editing skips the customer itself and 'allow' fields are not queried", async () => {
  const h = harness({ cloud_catalogs: [{ raw: { defaultMode: "allow", rules: { phone: "block" } } }] });
  const res = await h.rulesService.checkDuplicate(form({ name: "A", phone: "0901", email: "a@b.c" }), uid(1));
  assert.equal(res.mode, "allow");
  const q = h.calls.filter((c) => c.table === "cloud_customers");
  assert.equal(q.length, 1, "only the phone rule is checked");
  assert.equal(q[0].params.id, `neq.${uid(1)}`);
  assert.equal(q[0].params.ma_ctdk, `eq.${tenant}`);
});

test("same name alone is not a duplicate (many people share a name)", async () => {
  const h = harness({ cloud_customers: [{ id: uid(1), ten_kh: "Nguyễn Quang Phúc" }] });
  const res = await h.rulesService.checkDuplicate(form({ name: "Nguyễn Quang Phúc" }));
  assert.equal(res.mode, "allow");
  assert.equal(h.calls.filter((c) => c.table === "cloud_customers").length, 0);
});

test("own duplicate follows ownDuplicateMode", async () => {
  const h = harness({
    cloud_catalogs: [{ raw: { ownDuplicateMode: "allow" } }],
    cloud_customers: [{ id: uid(1), ten_kh: "Của tôi", created_by_id: ME }],
    cloud_pgc_phieu_giucho: [{ giai_doan: "HDMB" }],
  });
  const res = await h.rulesService.checkDuplicate(form({ name: "Của tôi", phone: "0901" }));
  assert.equal(res.mode, "allow");
  assert.equal(res.matches[0].isOwn, true);
});

test("duplicate request is written like the web (code tenant, pending, PascalCase payload) with a log", async () => {
  const h = harness();
  const match = {
    customerId: uid(1), customerName: "Khách cũ", customerCode: "KH-1", phone: "0901", cccd: null,
    ownerId: uid(2), ownerName: "NV Khác", fields: ["phone"], values: { phone: "0901" },
    protection: { level: "medium", score: 50, lastCareAt: null, hasTransaction: true, reasons: [] },
    isOwn: false, mode: "request",
  };
  const res = await h.rulesService.createDuplicateRequest(match, form({ name: "Khách mới", phone: "0901" }), "xin tạo");
  assert.equal(res.ok, true);
  const [req, log] = h.calls.filter((c) => c.method === "post");
  assert.equal(req.table, "cloud_customer_dup_requests");
  assert.equal(req.body.ma_ctdk, "beesky1");
  assert.equal(req.body.trang_thai, "pending");
  assert.equal(req.body.company_id, uid(8));
  assert.equal(req.body.match_value, "0901");
  assert.equal(req.body.requester_id, ME);
  assert.equal(req.body.requester_name, "NV Test");
  assert.equal(req.body.new_customer_payload.TenKH, "Khách mới");
  assert.equal(req.body.new_customer_payload.DiDong, "0901");
  assert.equal(req.body.new_customer_name, "Khách mới");
  assert.equal(log.table, "cloud_customer_dup_request_logs");
  assert.equal(log.body.hanh_dong, "create");
});

test("form rules: required + visibility by permission group, full access sees everything", async () => {
  const tables = {
    cloud_required_field_configs: [
      { form_key: "customer", required_fields: ["TenKH", "Email"], is_active: true },
      { form_key: "customer_org", required_fields: ["MaSoThueCT"], is_active: false },
    ],
    cloud_field_visibility_configs: [
      { group_uid: null, form_key: "customer", hidden_fields: ["Email"], readonly_fields: [] },
      { group_uid: uid(30), form_key: "customer", hidden_fields: ["DiaChi"], readonly_fields: ["TenKH"] },
      { group_uid: uid(31), form_key: "customer", hidden_fields: ["DiDong"], readonly_fields: [] },
    ],
  };
  const h = harness(tables, { claims: { per_id: uid(30) } });
  const r = await h.rulesService.getFormRules(true);
  assert.equal(r.formKey, "customer");
  assert.deepEqual([...r.required], ["TenKH", "Email"]);
  assert.deepEqual([...r.hidden], ["DiaChi"], "group config overrides the common one");
  assert.deepEqual([...r.readonly], ["TenKH"]);
  assert.equal(h.calls[0].params.ma_ctdk, "eq.beesky1");
  const org = await harness(tables).rulesService.getFormRules(false);
  assert.deepEqual([...org.required], [], "inactive config is ignored");
  const full = await harness(tables, { claims: { is_full_access: true } }).rulesService.getFormRules(true);
  assert.equal(full.hidden.size, 0);
  const broken = await harness({}, { failGet: { cloud_required_field_configs: true } }).rulesService.getFormRules(true);
  assert.deepEqual([...broken.required], []);
});

test("identity lock: personal signing appointment locks name and CCCD", async () => {
  assert.equal(await harness({ cloud_signing_appointments: [{ seq: 1 }] }).rulesService.hasIdentityLock(uid(1)), true);
  assert.equal(await harness().rulesService.hasIdentityLock(uid(1)), false);
  assert.equal(await harness({}, { failGet: { cloud_signing_appointments: true } }).rulesService.hasIdentityLock(uid(1)), false);
});

test("deleting a customer with pre-bookings is refused with the web message", async () => {
  const h = harness({ cloud_pre_bookings: [{ id: "a" }, { id: "b" }] });
  const res = await h.customerService().deleteCustomer(uid(1));
  assert.equal(res.status, 400);
  assert.equal(res.message, "Khách hàng đã có 2 phiếu booking, không được phép xóa.");
  assert.equal(h.calls.some((c) => c.method === "delete"), false);
  const pre = h.calls.find((c) => c.table === "cloud_pre_bookings");
  assert.equal(pre.params.ma_ctdk_uid, `eq.${tenant}`);
  assert.equal(pre.params.deleted_at, "is.null");
});

test("customer transactions use real columns and lookups (no FK embeds)", async () => {
  const h = harness({
    cloud_pgc_phieu_giucho: [
      { id: "p1", so_phieu_gc: "BK-1", giai_doan: "DATCOC", gia_tri_hd: 900, gia_tri_hd_sau_ck: 800, tien_coc: 50, da_thu: 20,
        san_pham_id: "s1", project_id: "d1", trang_thai_id: "t1", created_at: "2026-09-01T00:00:00Z" },
    ],
    bds_products: [{ id: "s1", ky_hieu: "B2-608" }],
    da_projects: [{ id: "d1", ten_da: "Dự án A" }],
    cloud_catalogs: [{ id: "t1", item_name: "Đã cọc", color_code: "#123456" }],
  });
  const list = await h.customerService().getCustomerTransactions(uid(1));
  const q = h.calls.find((c) => c.table === "cloud_pgc_phieu_giucho");
  assert.equal(q.params.select.includes("!"), false);
  assert.equal(q.params.select.includes("tong_gia_tri"), false);
  assert.equal(q.params.deleted_at, "is.null");
  assert.equal(list.length, 1);
  assert.equal(list[0].giaTri, 800);
  assert.equal(list[0].tenDA, "Dự án A");
  assert.equal(list[0].kyHieu, "B2-608");
  assert.equal(list[0].stageLabel, "Đặt cọc");
  assert.equal(list[0].status, "Đã cọc");
});

test("care notes are written like the web (company code, staff name)", async () => {
  const h = harness({ cloud_customers: [{ id: uid(1) }] });
  const res = await h.customerService().addCustomerActivity({ customerId: uid(1), content: "Gọi tư vấn", loai: "note" });
  assert.equal(res.status, 2000);
  const post = h.calls.find((c) => c.method === "post" && c.table === "cloud_customer_activities");
  assert.equal(post.body.ma_ctdk, "beesky1");
  assert.equal(post.body.nguoi_thuc_hien, "NV Test");
  assert.equal(post.body.loai, "note");
});

test("editing only patches the columns the app form manages (web-only data is kept)", async () => {
  const existing = { id: uid(1), ma_ctdk: tenant, ma_so_kh: "KH-1", company_id: uid(8), ngay_sinh: "1990-01-01", thuong_tru: "Hà Nội" };
  const h = harness({ cloud_customers: [existing] });
  const svc = h.customerService();
  svc.getCustomerDetailCloud = async () => existing;
  const patched = await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", diaChi: "HCM" });
  assert.equal(patched.status, 2000);
  const body = h.calls.find((c) => c.method === "patch").body;
  for (const k of ["ngay_sinh", "ngay_cap", "noi_cap", "so_tai_khoan", "ten_ngan_hang", "email2", "thuong_tru", "ma_qd", "ten_qd"]) {
    assert.equal(k in body, false, `${k} must not be overwritten`);
  }
  assert.equal(body.dia_chi, "HCM");
  assert.equal(body.di_dong, "0901");
});

test("delete reports success only when a row was really deleted", async () => {
  const ok = harness({}, { deleted: [{ id: uid(1) }] });
  const res = await ok.customerService().deleteCustomer(uid(1));
  assert.equal(res.status, 2000);
  const del = ok.calls.find((c) => c.method === "delete");
  assert.match(String(del.headers?.Prefer), /return=representation/);
  // Máy chủ chặn (RLS) → 0 dòng bị xoá → báo lỗi, không báo "Đã xoá"
  const blocked = await harness({}, { deleted: [] }).customerService().deleteCustomer(uid(1));
  assert.notEqual(blocked.status, 2000);
  assert.match(blocked.message, /Không xoá được khách hàng/);
});

test("a failed transactions load is reported as an error, not as 'no transactions'", async () => {
  const h = harness({}, { failGet: { cloud_pgc_phieu_giucho: true } });
  const res = await h.customerService().getHopDong({ MaKH: uid(1) });
  assert.equal(res.error, true);
  assert.equal(res.data.length, 0);
  const fine = await harness({ cloud_pgc_phieu_giucho: [] }).customerService().getHopDong({ MaKH: uid(1) });
  assert.equal(fine.error, false);
});
