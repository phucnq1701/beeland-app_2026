/* global __dirname */
// Luật khách hàng phía dữ liệu – so với web:
//  CustomerDuplicateService (fn_customer_duplicate_check) / CustomerDupRequestService (fn_customer_dup_*, Đợt 5) / RequiredFieldService / FieldVisibilityService /
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

/** Lỗi bộ API riêng app (services/nvApi NvApiError: message = thông báo máy chủ) */
class NvApiError extends Error {
  constructor(message, status = 400, code = "P0001") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** HTTP giả: tables[table] = rows | (params) => rows; ghi lại mọi lời gọi */
function harness(tables = {}, { failGet = {}, claims = {}, deleted = [], rpc = {} } = {}) {
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
      const fn = table.startsWith("rpc/") ? rpc[table.slice(4)] : undefined;
      if (fn) return { data: await fn(body) };
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
  // Bộ API riêng app (callNv): ghi như 1 lời gọi rpc để rpcCalls() dùng chung
  const nv = {
    NvApiError,
    errorMessage: (e, f) => (e && typeof e.message === "string" && e.message.trim() ? e.message : f || "lỗi"),
    callNv: async (fn, body) => {
      calls.push({ method: "post", table: `rpc/${fn}`, body });
      const f = rpc[fn];
      if (!f) throw new Error(`unexpected endpoint ${fn}`);
      return await f(body);
    },
  };
  const map = {
    "@/services/nvApi": nv,
    "./axiosApiSupabase": { default: http },
    "./axiosApi": { default: {} },
    "./cloudTenant": cloudTenant,
    "@/services/session": {
      getSessionInfo: async () => ({ companyId: tenant, employeeId: ME, maNv: "NV01", typeAccount: "SYSTEM", isAgency: false, companyCode: "beesky1" }),
    },
    "../lib/customerRules": rules,
    "../lib/listRpc": run("lib/listRpc.ts", {}),
    "@react-native-async-storage/async-storage": {
      default: { getItem: async (k) => (k === "@user" ? JSON.stringify({ ho_ten: "NV Test" }) : null) },
    },
  };
  const catalog = run("lib/web/config/fieldConfigCatalog.ts", {});
  map["@/lib/web/config/fieldConfigCatalog"] = catalog;
  map["@/lib/web/lib/fieldConfigRules"] = run("lib/web/lib/fieldConfigRules.ts", { "../config/fieldConfigCatalog": catalog });
  const rulesExports = run("services/CustomerRulesService.ts", map);
  map["./CustomerRulesService"] = rulesExports;
  map["./customerLookup"] = run("services/customerLookup.ts", map);
  return {
    calls,
    rulesService: rulesExports.CustomerRulesService,
    customerService: () => run("services/CustomerService.ts", map).CustomerService,
  };
}

const form = (over = {}) => ({ ...rules.EMPTY_CUSTOMER_FORM, ...over });

const rpcCalls = (h, fn) => h.calls.filter((c) => c.method === "post" && c.table === `rpc/${fn}`);
const noDirectTables = (h) => assert.equal(h.calls.some((c) => c.method !== "post"), false, "không đọc / ghi thẳng bảng");
/** Cấu hình trùng máy chủ (fn_customer_dup_config_get, snake_case) */
const dupCfg = (over = {}) => () => ({ rules: { cccd: null, phone: null, email: null, tax_code: null, full_name: null }, own_duplicate_mode: "block",
  protection_enabled: true, ...over });

test("duplicate config: fn_nv_app_trung_cau_hinh (= fn_customer_dup_config_get, snake_case); error / empty → web defaults", async () => {
  const h = harness({}, { rpc: { fn_nv_app_trung_cau_hinh: dupCfg({ rules: { cccd: "block" }, own_duplicate_mode: "allow" }) } });
  const a = await h.rulesService.getDuplicateConfig();
  assert.deepEqual(JSON.parse(JSON.stringify(a.rules)), { cccd: "block" });
  assert.equal(a.ownDuplicateMode, "allow");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_nv_app_trung_cau_hinh")[0].body)), {});
  const b = await harness({}, { rpc: { fn_nv_app_trung_cau_hinh: () => { throw new NvApiError("boom", 500); } } }).rulesService.getDuplicateConfig();
  assert.equal(b.ownDuplicateMode, "block");
  assert.equal(Object.keys(b.rules).length, 0);
  const c = await harness({}, { rpc: { fn_nv_app_trung_cau_hinh: () => null } }).rulesService.getDuplicateConfig();
  assert.equal(Object.keys(c.rules).length, 0);
  noDirectTables(h);
});

test("duplicate check: 1 call fn_nv_app_trung_kiem; only configured fields; contract stats → blocked", async () => {
  const h = harness({}, {
    rpc: {
      fn_nv_app_trung_cau_hinh: dupCfg({ rules: { cccd: "block", phone: "block", email: "request" } }),
      fn_nv_app_trung_kiem: () => [
        { id: uid(1), ten_kh: "Khách cũ", ma_so_kh: "KH-1", di_dong: "0901", in_scope: true, created_by_id: uid(2),
          owner_name: "NV Khác", created_at: "2026-01-01T00:00:00Z", fields: ["phone"],
          txn_total: 1, has_contract: true, has_deposit: false, has_booking: false, care_count: 2, last_care_at: null },
      ],
    },
  });
  const res = await h.rulesService.checkDuplicate(form({ name: "A", phone: "0901" }));
  assert.equal(res.mode, "block");
  assert.equal(res.matches.length, 1);
  const m = res.matches[0];
  assert.equal(m.protection.level, "high");
  assert.equal(m.protection.activityCount, 2);
  assert.equal(m.ownerName, "NV Khác");
  assert.equal(m.isOwn, false);
  assert.equal(m.outOfScope, false);
  assert.deepEqual([...m.fields], ["phone"]);
  const [call] = rpcCalls(h, "fn_nv_app_trung_kiem");
  assert.deepEqual([...call.body.p_fields], ["phone"], "chỉ tiêu chí có giá trị và đã cài");
  assert.equal(call.body.p_values.phone, "0901");
  assert.equal(call.body.p_exclude_id, null);
  noDirectTables(h);
});

test("unset criteria are not checked (web: no rule = allow) — app no longer blocks every field by default", async () => {
  const h = harness({}, { rpc: { fn_nv_app_trung_cau_hinh: dupCfg(), fn_nv_app_trung_kiem: () => [{ id: uid(1), fields: ["phone"] }] } });
  const res = await h.rulesService.checkDuplicate(form({ name: "A", phone: "0901", email: "a@b.c" }));
  assert.equal(res.mode, "allow");
  assert.equal(rpcCalls(h, "fn_nv_app_trung_kiem").length, 0);
});

test("editing passes p_exclude_id and 'allow' fields are not sent", async () => {
  const h = harness({}, { rpc: { fn_nv_app_trung_cau_hinh: dupCfg({ rules: { phone: "block" } }), fn_nv_app_trung_kiem: () => [] } });
  const res = await h.rulesService.checkDuplicate(form({ name: "A", phone: "0901", email: "a@b.c" }), uid(1));
  assert.equal(res.mode, "allow");
  const q = rpcCalls(h, "fn_nv_app_trung_kiem");
  assert.equal(q.length, 1);
  assert.deepEqual([...q[0].body.p_fields], ["phone"], "only the phone rule is checked");
  assert.equal(q[0].body.p_exclude_id, uid(1));
});

test("same name alone is not a duplicate (many people share a name) – no call", async () => {
  const h = harness({}, { rpc: { fn_nv_app_trung_cau_hinh: dupCfg(), fn_nv_app_trung_kiem: () => [{ id: uid(1), fields: ["full_name"] }] } });
  const res = await h.rulesService.checkDuplicate(form({ name: "Nguyễn Quang Phúc" }));
  assert.equal(res.mode, "allow");
  assert.equal(rpcCalls(h, "fn_nv_app_trung_kiem").length, 0);
});

test("own duplicate follows ownDuplicateMode", async () => {
  const h = harness({}, {
    rpc: {
      fn_nv_app_trung_cau_hinh: dupCfg({ rules: { phone: "block" }, own_duplicate_mode: "allow" }),
      fn_nv_app_trung_kiem: () => [
        { id: uid(1), ten_kh: "Của tôi", in_scope: true, created_by_id: ME, fields: ["phone"], has_contract: true, txn_total: 1 },
      ],
    },
  });
  const res = await h.rulesService.checkDuplicate(form({ name: "Của tôi", phone: "0901" }));
  assert.equal(res.mode, "allow");
  assert.equal(res.matches[0].isOwn, true);
});

test("out-of-scope duplicate: masked, no owner; scoped save → request (transfer), always probes CCCD/phone", async () => {
  const outRow = () => [{ id: uid(3), in_scope: false, ten_kh: "N***", company_name: "Chi nhánh B", fields: ["phone"] }];
  const rpc = { fn_nv_app_trung_cau_hinh: dupCfg(), fn_nv_app_trung_kiem: outRow };
  const scoped = harness({}, { rpc });
  const res = await scoped.rulesService.checkDuplicate(form({ name: "A", phone: "0901" }), null, { scoped: true });
  assert.equal(res.mode, "request");
  const m = res.matches[0];
  assert.equal(m.outOfScope, true);
  assert.equal(m.ownerName, null);
  assert.equal(m.ownerId, null);
  assert.equal(m.companyName, "Chi nhánh B");
  assert.deepEqual([...rpcCalls(scoped, "fn_nv_app_trung_kiem")[0].body.p_fields], ["phone"]);
  // Không scoped + tiêu chí chưa cài ⇒ không dò
  const plain = harness({}, { rpc });
  assert.equal((await plain.rulesService.checkDuplicate(form({ name: "A", phone: "0901" }))).mode, "allow");
  assert.equal(rpcCalls(plain, "fn_nv_app_trung_kiem").length, 0);
});

test("duplicate check: server error message is surfaced", async () => {
  const h = harness({}, {
    rpc: { fn_nv_app_trung_cau_hinh: dupCfg({ rules: { phone: "block" } }), fn_nv_app_trung_kiem: () => { throw new NvApiError("Phiên đăng nhập không hợp lệ", 401); } },
  });
  await assert.rejects(() => h.rulesService.checkDuplicate(form({ name: "A", phone: "0901" })), /Phiên đăng nhập không hợp lệ/);
});

test("duplicate request goes through fn_nv_app_trung_yeu_cau_tao (= fn_customer_dup_request_create, web params)", async () => {
  const h = harness({}, { rpc: { fn_nv_app_trung_yeu_cau_tao: () => ({ ok: true, id: uid(77) }) } });
  const match = {
    customerId: uid(1), customerName: "Khách cũ", customerCode: "KH-1", phone: "0901", cccd: null,
    ownerId: uid(2), ownerName: "NV Khác", fields: ["phone"], values: { phone: "0901" },
    protection: { level: "medium", score: 50, lastCareAt: null, hasTransaction: true, reasons: [] },
    isOwn: false, outOfScope: false, mode: "request",
  };
  const res = await h.rulesService.createDuplicateRequest(match, form({ name: "Khách mới", phone: "0901" }), "xin tạo");
  assert.equal(res.ok, true);
  assert.equal(res.id, uid(77));
  const posts = h.calls.filter((c) => c.method === "post");
  assert.equal(posts.length, 1);
  const { body } = posts[0];
  assert.equal(posts[0].table, "rpc/fn_nv_app_trung_yeu_cau_tao");
  assert.deepEqual(Object.keys(body).sort(), [
    "p_existing_customer_id", "p_match_fields", "p_match_value", "p_new_payload", "p_note", "p_protection",
  ]);
  assert.equal(body.p_existing_customer_id, uid(1));
  assert.equal(body.p_match_value, "0901");
  assert.equal(body.p_note, "xin tạo");
  assert.equal(body.p_new_payload.TenKH, "Khách mới");
  assert.equal(body.p_new_payload.DiDong, "0901");
  assert.equal(body.p_protection.level, "medium");
});

test("duplicate request RAISE message reaches the user", async () => {
  const fail = harness({}, { rpc: { fn_nv_app_trung_yeu_cau_tao: () => { throw new NvApiError("Khách đã có yêu cầu chờ"); } } });
  const r = await fail.rulesService.createDuplicateRequest({ customerId: uid(1), fields: [], values: {}, protection: {} }, form({ name: "A" }));
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { ok: false, message: "Khách đã có yêu cầu chờ" });
});

test("form rules: fn_nv_app_cau_hinh_truong (= fn_field_config_effective) + web rules; agency scope; load error is thrown", async () => {
  const eff = {
    scope: "SYSTEM",
    forms: {
      customer: { required: ["TenKH", "Email", "DiaChi", "KhongCo"], hidden: ["DiaChi"], readonly: ["SoCMND"] },
      customer_org: { required: ["MaSoThueCT"], hidden: [], readonly: [] },
    },
  };
  const h = harness({}, { rpc: { fn_nv_app_cau_hinh_truong: () => eff } });
  const r = await h.rulesService.getFormRules(true);
  assert.equal(r.formKey, "customer");
  assert.deepEqual([...r.required], ["TenKH", "Email"], "hidden field / field not on the web form is not required");
  assert.deepEqual([...r.hidden], ["DiaChi"]);
  assert.deepEqual([...r.readonly], ["SoCMND"]);
  const org = await h.rulesService.getFormRules(false);
  assert.equal(org.formKey, "customer_org");
  assert.deepEqual([...org.required], ["MaSoThueCT"]);
  assert.equal(rpcCalls(h, "fn_nv_app_cau_hinh_truong").length >= 1, true);
  noDirectTables(h);
  const none = await harness({}, { rpc: { fn_nv_app_cau_hinh_truong: () => ({ scope: "AGENCY", forms: {} }) } }).rulesService.getFormRules(true);
  assert.deepEqual([...none.required], []);
  // signing: key cũ đại lý ⇒ form web "signing"; trường có điều kiện (doanh nghiệp) không vào danh sách tĩnh, trường khoá luôn bắt buộc
  const sg = await harness({}, { rpc: { fn_nv_app_cau_hinh_truong: () => ({ scope: "AGENCY", forms: { signing: { required: ["SoDKKD"], hidden: [], readonly: [] } } }) } })
    .rulesService.getRulesForForm("agency_signing");
  assert.equal(sg.formKey, "signing");
  assert.equal(sg.required.includes("SoDKKD"), false);
  assert.equal(sg.required.includes("MaCa"), true);
});

test("form rules: load failure is thrown (save is blocked like the web)", async () => {
  const bad = harness({}, { rpc: { fn_nv_app_cau_hinh_truong: () => { throw new NvApiError("boom", 500); } } });
  await assert.rejects(bad.rulesService.getRulesForForm("customer_org"));
});

test("identity lock / transaction lock: fn_nv_app_khoa_dinh_danh / fn_nv_app_khoa_giao_dich; error → false", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khoa_dinh_danh: () => true, fn_nv_app_khoa_giao_dich: () => true } });
  assert.equal(await h.rulesService.hasIdentityLock(uid(1)), true);
  assert.equal(await h.rulesService.hasTxLock(uid(1)), true);
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_nv_app_khoa_giao_dich")[0].body)), { p_customer_id: uid(1) });
  const off = harness({}, { rpc: { fn_nv_app_khoa_dinh_danh: () => false, fn_nv_app_khoa_giao_dich: () => false } });
  assert.equal(await off.rulesService.hasIdentityLock(uid(1)), false);
  assert.equal(await off.rulesService.hasTxLock(uid(1)), false);
  const err = harness({}, { rpc: { fn_nv_app_khoa_dinh_danh: () => { throw new NvApiError("x"); }, fn_nv_app_khoa_giao_dich: () => { throw new NvApiError("x"); } } });
  assert.equal(await err.rulesService.hasIdentityLock(uid(1)), false);
  assert.equal(await err.rulesService.hasTxLock(uid(1)), false);
  assert.equal(await h.rulesService.hasTxLock("KH-1"), false, "chỉ nhận uuid");
  noDirectTables(h);
});

/** Lỗi RAISE của hàm SQL như axios trả (error.response.data.message) */
const raise = (message) => () => {
  throw Object.assign(new Error("Request failed with status code 400"), { response: { data: { message } } });
};
/** Lỗi RAISE qua bộ API riêng (callNv ⇒ NvApiError) */
const raiseNv = (message, status = 400) => () => {
  throw new NvApiError(message, status);
};
const noTableAccess = (h) =>
  assert.equal(
    h.calls.some((c) => /^(cloud_customers|cloud_customer_activities)$/.test(c.table)),
    false,
    "Đợt 5: không đọc / ghi thẳng bảng khách"
  );

test("deleting a customer goes through fn_nv_app_khach_hang_xoa (= fn_customer_delete); the server refusal reaches the user", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khach_hang_xoa: raiseNv("Khách hàng đã có 2 phiếu booking, không được phép xóa.") } });
  const res = await h.customerService().deleteCustomer(uid(1));
  assert.equal(res.status, 400);
  assert.equal(res.message, "Khách hàng đã có 2 phiếu booking, không được phép xóa.");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_nv_app_khach_hang_xoa")[0].body)), { p_id: uid(1) });
  assert.equal(h.calls.some((c) => c.method === "get" || c.method === "delete"), false, "không đọc / xoá thẳng bảng");
});

test("customer transactions: 1 call fn_nv_app_khach_hang_giao_dich (joined product / project / status), no table reads", async () => {
  const h = harness({}, {
    rpc: {
      fn_nv_app_khach_hang_giao_dich: (b) =>
        b.p_khach_hang_id === uid(1)
          ? [{ id: "p1", so_phieu_gc: "BK-1", giai_doan: "DATCOC", gia_tri_hd: 900, gia_tri_hd_sau_ck: 800, san_pham_id: "s1", ky_hieu: "B2-608",
               ma_sp: "M1", project_id: "d1", ten_da: "Dự án A", trang_thai_id: "t1", ten_tt: "Đã cọc", mau_tt: "#123456", created_at: "2026-09-01T00:00:00Z" }]
          : [],
    },
  });
  const list = await h.customerService().getCustomerTransactions(uid(1));
  assert.equal(list.length, 1);
  assert.equal(list[0].giaTri, 800);
  assert.equal(list[0].tenDA, "Dự án A");
  assert.equal(list[0].kyHieu, "B2-608");
  assert.equal(list[0].stageLabel, "Đặt cọc");
  assert.equal(list[0].status, "Đã cọc");
  assert.equal(list[0].statusColor, "#123456");
  assert.equal(h.calls.some((c) => c.method === "get"), false);
});

test("catalogs: fn_nv_app_danh_muc (company from session); empty source list ⇒ default sources; error ⇒ []", async () => {
  const h = harness({}, {
    rpc: {
      fn_nv_app_danh_muc: (b) =>
        b.p_loai === "trang_thai_kh" ? [{ id: uid(3), item_code: "NEW", item_name: "Mới", color_code: "blue", ghi_chu: "x" }] : [],
    },
  });
  const svc = h.customerService();
  const st = await svc.getTrangThaiCatalogs();
  assert.deepEqual(JSON.parse(JSON.stringify(st)), [{ id: uid(3), label: "Mới", value: uid(3), color: "blue", code: "NEW", ghiChu: "x" }]);
  const ng = await svc.getNguonCatalogs();
  assert.equal(ng[0].id, "facebook");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_nv_app_danh_muc").map((c) => c.body))), [{ p_loai: "trang_thai_kh" }, { p_loai: "nguon_kh" }]);
  const bad = harness({}, { rpc: { fn_nv_app_danh_muc: raiseNv("lỗi") } });
  assert.equal((await bad.customerService().getTrangThaiCatalogs()).length, 0);
  assert.equal(h.calls.some((c) => c.method === "get"), false);
});

test("list: fn_nv_app_khach_hang_list params; status code → uuid via catalog; 401 ⇒ authError; other errors are thrown", async () => {
  const h = harness({}, {
    rpc: {
      fn_nv_app_danh_muc: () => [{ id: uid(3), item_code: "NEW", item_name: "Mới" }],
      fn_nv_app_khach_hang_list: () => ({ rows: [{ id: uid(1), ten_kh: "A", ten_tt: "Mới", mau_tt: "blue" }], total: 41 }),
    },
  });
  const svc = h.customerService();
  const r = await svc.getCustomers({ search: " an ", isPersonal: true, limit: 20, offset: 0 });
  assert.equal(r.data[0].tenKH, "A");
  assert.equal(r.total, 41);
  assert.equal(r.hasMore, true);
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_nv_app_khach_hang_list")[0].body)),
    { p_tu_khoa: "an", p_ca_nhan: true, p_trang_thai_id: null, p_trang: 1, p_so_dong: 20 });
  await svc.getCustomers({ maTtId: "NEW", statusLabel: "Mới" });
  assert.equal(rpcCalls(h, "fn_nv_app_khach_hang_list")[1].body.p_trang_thai_id, uid(3), "mã trạng thái ⇒ uuid");
  const auth = await harness({}, { rpc: { fn_nv_app_khach_hang_list: raiseNv("Phiên đăng nhập hết hạn", 401) } }).customerService().getCustomers();
  assert.equal(auth.authError, true);
  await assert.rejects(
    harness({}, { rpc: { fn_nv_app_khach_hang_list: raiseNv('Bạn không có quyền "Xem" ở "Khách hàng"', 403) } }).customerService().getCustomers(),
    /không có quyền/
  );
});

test("detail uses fn_nv_app_khach_hang_chi_tiet (= fn_customer_get); code → fn_nv_app_khach_hang_theo_id first; nested status/source/company", async () => {
  const row = {
    id: uid(1), ma_so_kh: "KH-1", ten_kh: "A", is_personal: true, ma_tt_id: uid(3),
    trang_thai: { id: uid(3), item_name: "Tiềm năng", color_code: "gold" }, nguon: { id: uid(4), item_name: "Facebook" },
    cty: { id: uid(8), ten_ct: "Công ty X", ten_ct_vt: "CTX" },
  };
  const h = harness({}, {
    rpc: {
      fn_nv_app_khach_hang_theo_id: (b) => (b.p_ma?.includes("KH-1") ? [{ id: uid(1), ma_so_kh: "KH-1" }] : []),
      fn_nv_app_khach_hang_chi_tiet: (b) => (b.p_id === uid(1) ? row : null),
    },
  });
  const svc = h.customerService();
  const d = await svc.getCustomerDetailCloud("KH-1");
  assert.equal(d.id, uid(1));
  assert.equal(d.status, "Tiềm năng");
  assert.equal(d.statusColor, "gold");
  assert.equal(d.tenNguon, "Facebook");
  assert.equal(d.tenSan, "CTX");
  assert.equal(await svc.getCustomerDetailCloud(uid(2)), null, "ngoài phạm vi ⇒ null");
  noTableAccess(h);
});

test("detail: server error is thrown with the server message (not 'not found'); limited row hides CCCD", async () => {
  const bad = harness({}, { rpc: { fn_nv_app_khach_hang_chi_tiet: raiseNv("Bạn không có quyền xem khách hàng") } });
  await assert.rejects(bad.customerService().getCustomerDetailCloud(uid(1)), /Bạn không có quyền xem khách hàng/);
  const lim = harness({}, { rpc: { fn_nv_app_khach_hang_chi_tiet: () => ({ id: uid(1), ten_kh: "B", cccd: "********1234", limited: true }) } });
  const d = await lim.customerService().getCustomerDetailCloud(uid(1));
  assert.equal(d.limited, true);
  assert.equal(d.cccd, "");
  assert.equal(d.cccd_masked, "********1234");
});

test("editing sends only the columns the app form manages to fn_nv_app_khach_hang_luu (scoped on the server), web-only data is kept", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khach_hang_luu: () => uid(1), fn_nv_app_khach_hang_chi_tiet: () => ({ id: uid(1), ma_so_kh: "KH-9" }) } });
  const svc = h.customerService();
  const saved = await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", diaChi: "HCM" });
  assert.equal(saved.status, 2000);
  assert.equal(saved.data.ma_so_kh, "KH-9", "đọc lại dòng đã lưu");
  const call = rpcCalls(h, "fn_nv_app_khach_hang_luu")[0].body;
  assert.deepEqual(Object.keys(call), ["p_row"], "p_scoped do máy chủ app đặt");
  const body = call.p_row;
  assert.equal(body.id, uid(1));
  for (const k of ["ngay_sinh", "ngay_cap", "noi_cap", "so_tai_khoan", "ten_ngan_hang", "email2", "thuong_tru", "ma_qd", "ten_qd",
    "ma_ctdk", "company_id", "ma_so_kh", "created_by_id", "updated_by_id", "ngay_sua"]) {
    assert.equal(k in body, false, `${k} must not be sent`);
  }
  assert.equal(body.dia_chi, "HCM");
  assert.equal(body.di_dong, "0901");
  assert.equal(h.calls.some((c) => c.method === "patch"), false);
  noTableAccess(h);
});

test("creating: fn_nv_app_khach_hang_luu without id / tenant / company / code (server assigns); server error reaches the user; 401 ⇒ needLogin", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khach_hang_luu: () => uid(5), fn_nv_app_khach_hang_chi_tiet: () => ({ id: uid(5), ma_so_kh: "KH-00005" }) } });
  const res = await h.customerService().saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal(res.status, 2000);
  assert.equal(res.data.id, uid(5));
  const body = rpcCalls(h, "fn_nv_app_khach_hang_luu")[0].body.p_row;
  for (const k of ["id", "ma_ctdk", "company_id", "ma_so_kh", "created_by_id"]) assert.equal(k in body, false, k);
  assert.equal(body.ten_kh, "A");
  const bad = harness({}, { rpc: { fn_nv_app_khach_hang_luu: raiseNv("Bạn không có quyền thêm khách hàng") } });
  const r = await bad.customerService().saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal(r.status, 5000);
  assert.equal(r.message, "Bạn không có quyền thêm khách hàng");
  const exp = await harness({}, { rpc: { fn_nv_app_khach_hang_luu: raiseNv("Phiên đăng nhập hết hạn", 401) } })
    .customerService().saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal(exp.needLogin, true);
});

test("note is saved to ghi_chu on create and edit; callers without a note keep the existing one", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khach_hang_luu: () => uid(1), fn_nv_app_khach_hang_chi_tiet: () => ({ id: uid(1) }) } });
  const svc = h.customerService();
  const rows = () => rpcCalls(h, "fn_nv_app_khach_hang_luu").map((c) => c.body.p_row);
  await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", ghiChu: "Khách VIP" });
  assert.equal(rows()[0].ghi_chu, "Khách VIP");
  await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", ghiChu: null });
  assert.equal(rows()[1].ghi_chu, null, "clearing the note writes null");
  await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal("ghi_chu" in rows()[2], false, "no note in payload → untouched");
  await svc.saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901", ghiChu: "Mới" });
  assert.equal(rows()[3].ghi_chu, "Mới");
});

test("delete reports success when fn_nv_app_khach_hang_xoa returns", async () => {
  const ok = harness({}, { rpc: { fn_nv_app_khach_hang_xoa: () => null } });
  const res = await ok.customerService().deleteCustomer(uid(1));
  assert.equal(res.status, 2000);
  const blocked = await harness({}, { rpc: { fn_nv_app_khach_hang_xoa: raiseNv("Bạn không có quyền xóa khách hàng") } })
    .customerService()
    .deleteCustomer(uid(1));
  assert.notEqual(blocked.status, 2000);
  assert.equal(blocked.message, "Bạn không có quyền xóa khách hàng");
});

test("pickers use fn_nv_app_khach_hang_chon (= fn_customer_picker; ≥ 2 chars, no call below)", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khach_hang_chon: () => ({ rows: [{ id: uid(1), ten_kh: "A", ten_tt: "Mới", mau_tt: "blue" }] }) } });
  const svc = h.customerService();
  assert.equal((await svc.pickCustomers({ search: "a" })).data.length, 0);
  assert.equal(rpcCalls(h, "fn_nv_app_khach_hang_chon").length, 0);
  const r = await svc.pickCustomers({ search: " an ", limit: 10, isPersonal: true });
  assert.equal(r.data[0].tenKH, "A");
  assert.equal(r.data[0].status, "Mới");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_nv_app_khach_hang_chon")[0].body)), { p_tu_khoa: "an", p_so_dong: 10, p_ca_nhan: true });
});

test("a failed transactions load is reported as an error, not as 'no transactions'", async () => {
  const h = harness({}, { rpc: { fn_nv_app_khach_hang_giao_dich: raiseNv("boom", 500) } });
  const res = await h.customerService().getHopDong({ MaKH: uid(1) });
  assert.equal(res.error, true);
  assert.equal(res.data.length, 0);
  const fine = await harness({}, { rpc: { fn_nv_app_khach_hang_giao_dich: () => [] } }).customerService().getHopDong({ MaKH: uid(1) });
  assert.equal(fine.error, false);
});
