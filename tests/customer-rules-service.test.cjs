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
  map["./customerLookup"] = run("sevicesSupabase/customerLookup.ts", map);
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

const rpcCalls = (h, fn) => h.calls.filter((c) => c.method === "post" && c.table === `rpc/${fn}`);

test("duplicate check: 1 RPC fn_customer_duplicate_check; contract stats → blocked; no locked tables read", async () => {
  const h = harness({}, {
    rpc: {
      fn_customer_duplicate_check: () => [
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
  assert.equal(m.isPersonal, true);
  const [call] = rpcCalls(h, "fn_customer_duplicate_check");
  assert.deepEqual([...call.body.p_fields], ["cccd", "phone", "email"].filter((k) => call.body.p_values[k]));
  assert.equal(call.body.p_values.phone, "0901");
  assert.equal(call.body.p_exclude_id, null);
  for (const t of ["cloud_customers", "cloud_customer_activities", "cloud_pgc_phieu_giucho", "dm_employees"]) {
    assert.equal(h.calls.some((c) => c.table === t), false, `${t} is not read directly`);
  }
});

test("editing passes p_exclude_id and 'allow' fields are not sent", async () => {
  const h = harness(
    { cloud_catalogs: [{ raw: { defaultMode: "allow", rules: { phone: "block" } } }] },
    { rpc: { fn_customer_duplicate_check: () => [] } }
  );
  const res = await h.rulesService.checkDuplicate(form({ name: "A", phone: "0901", email: "a@b.c" }), uid(1));
  assert.equal(res.mode, "allow");
  const q = rpcCalls(h, "fn_customer_duplicate_check");
  assert.equal(q.length, 1);
  assert.deepEqual([...q[0].body.p_fields], ["phone"], "only the phone rule is checked");
  assert.equal(q[0].body.p_exclude_id, uid(1));
});

test("same name alone is not a duplicate (many people share a name) – no RPC call", async () => {
  const h = harness({}, { rpc: { fn_customer_duplicate_check: () => [{ id: uid(1), fields: ["full_name"] }] } });
  const res = await h.rulesService.checkDuplicate(form({ name: "Nguyễn Quang Phúc" }));
  assert.equal(res.mode, "allow");
  assert.equal(rpcCalls(h, "fn_customer_duplicate_check").length, 0);
});

test("own duplicate follows ownDuplicateMode", async () => {
  const h = harness(
    { cloud_catalogs: [{ raw: { ownDuplicateMode: "allow" } }] },
    {
      rpc: {
        fn_customer_duplicate_check: () => [
          { id: uid(1), ten_kh: "Của tôi", in_scope: true, created_by_id: ME, fields: ["phone"], has_contract: true, txn_total: 1 },
        ],
      },
    }
  );
  const res = await h.rulesService.checkDuplicate(form({ name: "Của tôi", phone: "0901" }));
  assert.equal(res.mode, "allow");
  assert.equal(res.matches[0].isOwn, true);
});

test("out-of-scope duplicate: masked, no owner; scoped save → request (transfer), always probes CCCD/phone", async () => {
  const outRow = () => [{ id: uid(3), in_scope: false, ten_kh: "N***", company_name: "Chi nhánh B", fields: ["phone"] }];
  const cfg = { cloud_catalogs: [{ raw: { defaultMode: "allow", rules: { phone: "allow" } } }] };
  const scoped = harness(cfg, { rpc: { fn_customer_duplicate_check: outRow } });
  const res = await scoped.rulesService.checkDuplicate(form({ name: "A", phone: "0901" }), null, { scoped: true });
  assert.equal(res.mode, "request");
  const m = res.matches[0];
  assert.equal(m.outOfScope, true);
  assert.equal(m.ownerName, null);
  assert.equal(m.ownerId, null);
  assert.equal(m.companyName, "Chi nhánh B");
  assert.deepEqual([...rpcCalls(scoped, "fn_customer_duplicate_check")[0].body.p_fields], ["phone"]);
  // Không scoped + tiêu chí "cho phép" ⇒ không dò
  const plain = harness(cfg, { rpc: { fn_customer_duplicate_check: outRow } });
  assert.equal((await plain.rulesService.checkDuplicate(form({ name: "A", phone: "0901" }))).mode, "allow");
  assert.equal(rpcCalls(plain, "fn_customer_duplicate_check").length, 0);
});

test("duplicate check: server error message is surfaced", async () => {
  const http = harness({}, {
    rpc: {
      fn_customer_duplicate_check: () => {
        throw Object.assign(new Error("400"), { response: { data: { message: "Phiên đăng nhập không hợp lệ" } } });
      },
    },
  });
  await assert.rejects(() => http.rulesService.checkDuplicate(form({ name: "A", phone: "0901" })), /Phiên đăng nhập không hợp lệ/);
});

test("duplicate request goes through fn_customer_dup_request_create like the web (no direct table writes)", async () => {
  const h = harness({}, { rpc: { fn_customer_dup_request_create: () => ({ ok: true, id: uid(77) }) } });
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
  assert.equal(posts[0].table, "rpc/fn_customer_dup_request_create");
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

test("duplicate request RAISE message reaches the user; other dup RPCs use web names/params", async () => {
  const fail = harness({}, {
    rpc: {
      fn_customer_dup_request_create: () => {
        throw Object.assign(new Error("400"), { response: { data: { message: "Khách đã có yêu cầu chờ" } } });
      },
    },
  });
  const r = await fail.rulesService.createDuplicateRequest(
    { customerId: uid(1), fields: [], values: {}, protection: {} }, form({ name: "A" })
  );
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { ok: false, message: "Khách đã có yêu cầu chờ" });

  const h = harness({}, {
    rpc: {
      fn_customer_dup_request_list: () => [{ id: uid(5) }],
      fn_customer_dup_request_logs: () => [{ id: uid(6) }],
      fn_customer_dup_decide: () => ({ ok: true }),
      fn_customer_dup_request_comment: () => ({ ok: true }),
      fn_customer_dup_request_cancel: () => ({ ok: true }),
      fn_customer_dup_request_find_approval: () => null,
    },
  });
  const svc = h.rulesService;
  assert.equal((await svc.listDuplicateRequests({ status: "all", keyword: " a " })).length, 1);
  assert.equal((await svc.duplicateRequestLogs(uid(5))).length, 1);
  assert.equal((await svc.decideDuplicateRequest(uid(5), "transfer", "ok")).ok, true);
  assert.equal((await svc.commentDuplicateRequest(uid(5), "ý kiến")).ok, true);
  assert.equal((await svc.cancelDuplicateRequest(uid(5))).ok, true);
  assert.equal(await svc.findDuplicateApproval(uid(1)), null);
  const body = (fn) => JSON.parse(JSON.stringify(rpcCalls(h, fn)[0].body));
  assert.deepEqual(body("fn_customer_dup_request_list"), { p_status: null, p_keyword: "a" });
  assert.deepEqual(body("fn_customer_dup_request_logs"), { p_id: uid(5) });
  assert.deepEqual(body("fn_customer_dup_decide"), { p_id: uid(5), p_decision: "transfer", p_note: "ok" });
  assert.deepEqual(body("fn_customer_dup_request_comment"), { p_id: uid(5), p_note: "ý kiến" });
  assert.deepEqual(body("fn_customer_dup_request_cancel"), { p_id: uid(5), p_note: null });
  assert.deepEqual(body("fn_customer_dup_request_find_approval"), { p_customer_id: uid(1) });
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

/** Lỗi RAISE của hàm SQL như axios trả (error.response.data.message) */
const raise = (message) => () => {
  throw Object.assign(new Error("Request failed with status code 400"), { response: { data: { message } } });
};
const noTableAccess = (h) =>
  assert.equal(
    h.calls.some((c) => /^(cloud_customers|cloud_customer_activities)$/.test(c.table)),
    false,
    "Đợt 5: không đọc / ghi thẳng bảng khách"
  );

test("deleting a customer goes through fn_customer_delete; the server refusal reaches the user", async () => {
  const h = harness({}, { rpc: { fn_customer_delete: raise("Khách hàng đã có 2 phiếu booking, không được phép xóa.") } });
  const res = await h.customerService().deleteCustomer(uid(1));
  assert.equal(res.status, 400);
  assert.equal(res.message, "Khách hàng đã có 2 phiếu booking, không được phép xóa.");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls(h, "fn_customer_delete")[0].body)), { p_id: uid(1) });
  assert.equal(h.calls.some((c) => c.method === "delete"), false);
  noTableAccess(h);
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

test("care notes go through fn_customer_activity_save (staff name, customer resolved from code)", async () => {
  const h = harness({}, {
    rpc: {
      fn_customer_get_by_ids: (b) => (b.p_refs?.includes("KH-1") ? [{ id: uid(1), ma_so_kh: "KH-1" }] : []),
      fn_customer_activity_save: () => uid(77),
    },
  });
  const res = await h.customerService().addCustomerActivity({ customerId: "KH-1", content: "Gọi tư vấn", loai: "note" });
  assert.equal(res.status, 2000);
  assert.equal(res.data, uid(77));
  const p = rpcCalls(h, "fn_customer_activity_save")[0].body.p;
  assert.equal(p.khach_hang_id, uid(1));
  assert.equal(p.nguoi_thuc_hien, "NV Test");
  assert.equal(p.loai, "note");
  assert.equal("ma_ctdk" in p, false, "máy chủ tự đặt công ty");
  const fail = harness({}, { rpc: { fn_customer_activity_save: raise("Không có quyền với bản ghi này") } });
  const bad = await fail.customerService().addCustomerActivity({ customerId: uid(1), content: "x" });
  assert.equal(bad.message, "Không có quyền với bản ghi này");
  noTableAccess(h);
});

test("care notes list uses fn_customer_activity_list", async () => {
  const h = harness({}, { rpc: { fn_customer_activity_list: () => [{ id: "a1", loai: "call", noi_dung: "Hi", thoi_gian: "2026-10-01" }] } });
  const list = await h.customerService().getCustomerActivities(uid(1));
  assert.equal(list.length, 1);
  assert.equal(list[0].noiDung, "Hi");
  assert.equal(rpcCalls(h, "fn_customer_activity_list")[0].body.p_khach_hang_id, uid(1));
  noTableAccess(h);
});

test("detail uses fn_customer_get; code → fn_customer_get_by_ids first; nested status/source/company", async () => {
  const row = {
    id: uid(1), ma_so_kh: "KH-1", ten_kh: "A", is_personal: true, ma_tt_id: uid(3),
    trang_thai: { id: uid(3), item_name: "Tiềm năng", color_code: "gold" }, nguon: { id: uid(4), item_name: "Facebook" },
    cty: { id: uid(8), ten_ct: "Công ty X", ten_ct_vt: "CTX" },
  };
  const h = harness({}, {
    rpc: {
      fn_customer_get_by_ids: (b) => (b.p_refs?.includes("KH-1") ? [{ id: uid(1), ma_so_kh: "KH-1" }] : []),
      fn_customer_get: (b) => (b.p_id === uid(1) ? row : null),
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
  const bad = harness({}, { rpc: { fn_customer_get: raise("Bạn không có quyền xem khách hàng") } });
  await assert.rejects(bad.customerService().getCustomerDetailCloud(uid(1)), /Bạn không có quyền xem khách hàng/);
  const lim = harness({}, { rpc: { fn_customer_get: () => ({ id: uid(1), ten_kh: "B", cccd: "********1234", limited: true }) } });
  const d = await lim.customerService().getCustomerDetailCloud(uid(1));
  assert.equal(d.limited, true);
  assert.equal(d.cccd, "");
  assert.equal(d.cccd_masked, "********1234");
});

test("editing sends only the columns the app form manages to fn_customer_save (scoped), web-only data is kept", async () => {
  const h = harness({}, { rpc: { fn_customer_save: () => uid(1), fn_customer_get: () => ({ id: uid(1), ma_so_kh: "KH-9" }) } });
  const svc = h.customerService();
  const saved = await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", diaChi: "HCM" });
  assert.equal(saved.status, 2000);
  assert.equal(saved.data.ma_so_kh, "KH-9", "đọc lại dòng đã lưu");
  const call = rpcCalls(h, "fn_customer_save")[0].body;
  assert.equal(call.p_scoped, true);
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

test("creating: fn_customer_save without id / tenant / company / code (server assigns); server error reaches the user", async () => {
  const h = harness({}, { rpc: { fn_customer_save: () => uid(5), fn_customer_get: () => ({ id: uid(5), ma_so_kh: "KH-00005" }) } });
  const res = await h.customerService().saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal(res.status, 2000);
  assert.equal(res.data.id, uid(5));
  const body = rpcCalls(h, "fn_customer_save")[0].body.p_row;
  for (const k of ["id", "ma_ctdk", "company_id", "ma_so_kh", "created_by_id"]) assert.equal(k in body, false, k);
  assert.equal(body.ten_kh, "A");
  const bad = harness({}, { rpc: { fn_customer_save: raise("Bạn không có quyền thêm khách hàng") } });
  const r = await bad.customerService().saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal(r.status, 5000);
  assert.equal(r.message, "Bạn không có quyền thêm khách hàng");
});

test("note is saved to ghi_chu on create and edit; callers without a note keep the existing one", async () => {
  const h = harness({}, { rpc: { fn_customer_save: () => uid(1), fn_customer_get: () => ({ id: uid(1) }) } });
  const svc = h.customerService();
  const rows = () => rpcCalls(h, "fn_customer_save").map((c) => c.body.p_row);
  await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", ghiChu: "Khách VIP" });
  assert.equal(rows()[0].ghi_chu, "Khách VIP");
  await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901", ghiChu: null });
  assert.equal(rows()[1].ghi_chu, null, "clearing the note writes null");
  await svc.saveCustomerCloud({ id: uid(1), isPersonal: true, tenKh: "A", diDong: "0901" });
  assert.equal("ghi_chu" in rows()[2], false, "no note in payload → untouched");
  await svc.saveCustomerCloud({ isPersonal: true, tenKh: "A", diDong: "0901", ghiChu: "Mới" });
  assert.equal(rows()[3].ghi_chu, "Mới");
});

test("delete reports success when fn_customer_delete returns", async () => {
  const ok = harness({}, { rpc: { fn_customer_delete: () => null } });
  const res = await ok.customerService().deleteCustomer(uid(1));
  assert.equal(res.status, 2000);
  const blocked = await harness({}, { rpc: { fn_customer_delete: raise("Bạn không có quyền xóa khách hàng") } })
    .customerService()
    .deleteCustomer(uid(1));
  assert.notEqual(blocked.status, 2000);
  assert.equal(blocked.message, "Bạn không có quyền xóa khách hàng");
});

test("pickers use fn_customer_picker (≥ 2 chars, no call below)", async () => {
  const h = harness({}, { rpc: { fn_customer_picker: () => ({ rows: [{ id: uid(1), ten_kh: "A", ten_tt: "Mới", mau_tt: "blue" }] }) } });
  const svc = h.customerService();
  assert.equal((await svc.pickCustomers({ search: "a" })).data.length, 0);
  assert.equal(rpcCalls(h, "fn_customer_picker").length, 0);
  const r = await svc.pickCustomers({ search: "an", limit: 10 });
  assert.equal(r.data[0].tenKH, "A");
  assert.equal(r.data[0].status, "Mới");
  assert.equal(rpcCalls(h, "fn_customer_picker")[0].body.p_limit, 10);
});

test("a failed transactions load is reported as an error, not as 'no transactions'", async () => {
  const h = harness({}, { failGet: { cloud_pgc_phieu_giucho: true } });
  const res = await h.customerService().getHopDong({ MaKH: uid(1) });
  assert.equal(res.error, true);
  assert.equal(res.data.length, 0);
  const fine = await harness({ cloud_pgc_phieu_giucho: [] }).customerService().getHopDong({ MaKH: uid(1) });
  assert.equal(fine.error, false);
});
