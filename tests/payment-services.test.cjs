/* global __dirname */
// Dịch vụ cọc / hợp đồng / báo cáo gọi đúng hàm máy chủ & bảng như web:
//  DepositListService (fn_deposit_list), ContractListService (fn_contract_list),
//  ContractScheduleService (fn_contract_payment_schedule), CashVoucherService (fn_cash_vouchers_by_pgc,
//  fn_cash_voucher_list), AccountingCloudService (listDebtsCloudFirst – TIENDO).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tenant = uid(99);
const plain = (v) => JSON.parse(JSON.stringify(v));

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function run(file, map) {
  const exports = {};
  vm.runInNewContext(compile(file), {
    exports, console: { log() {}, warn() {} }, Date, Promise,
    require: (name) => map[name] ?? { default: {} },
  });
  return exports;
}

const math = run("lib/paymentMath.ts", {});
const depositQr = run("lib/depositQr.ts", {});

function harness({ rpc = {}, tables = {}, failRpc = {}, typeAccount = "SYSTEM", scope = [] } = {}) {
  const calls = [];
  const http = {
    get: async (url, opts = {}) => {
      const table = url.replace(/^rest\/v1\//, "").split("?")[0];
      calls.push({ method: "get", table, params: opts.params || {} });
      const t = tables[table];
      const data = typeof t === "function" ? t(opts.params || {}) : t ?? [];
      return { data, headers: { "content-range": `0-0/${Array.isArray(data) ? data.length : 0}` } };
    },
    post: async (url, body) => {
      const fn = url.replace("rest/v1/rpc/", "");
      calls.push({ method: "rpc", fn, body });
      if (failRpc[fn]) throw new Error("boom");
      const r = rpc[fn];
      return { data: typeof r === "function" ? r(body) : r ?? [] };
    },
  };
  const cloudTenant = {
    getCompanyId: async () => tenant,
    getTenantId: async () => tenant,
    getValidSupabaseJwt: async () => "jwt",
    getTypeAccount: async () => typeAccount,
    getCompanyCode: async () => "BeeSky1",
    getEmployeeId: async () => uid(7),
  };
  const map = {
    "./axiosApiSupabase": { default: http },
    "./cloudTenant": cloudTenant,
    "../lib/paymentMath": math,
    "../lib/depositQr": depositQr,
    "./ProjectService": { ProjectService: { getProjects: async () => ({ data: scope }) } },
    "@react-native-async-storage/async-storage": { default: { getItem: async () => null } },
  };
  const progress = run("sevicesSupabase/PaymentProgressService.ts", map);
  map["./PaymentProgressService"] = progress;
  const dep = run("sevicesSupabase/DatCocService.ts", map);
  map["./DatCocService"] = dep;
  const hd = run("sevicesSupabase/HopDongService.ts", map);
  map["./HopDongService"] = hd;
  return {
    calls,
    progress: progress.PaymentProgressService,
    deposits: () => dep.DatCocService,
    contracts: () => hd.HopDongService,
    reports: () => run("sevicesSupabase/ReportService.ts", map).ReportService,
  };
}

test("deposit list: fn_deposit_list like the web, both response shapes", async () => {
  const row = { id: "dc1", pgc_id: "pgc1", so_phieu: "DC-1", ten_kh: "Khách", ky_hieu: "A-1", gia_tri_hd: 900, tien_coc: 50, da_thu: 20, total_count: 7 };
  for (const shape of [{ rows: [row], total_count: 7 }, [row]]) {
    const h = harness({ rpc: { fn_deposit_list: shape } });
    const res = await h.deposits().get({ Offset: 2, Limit: 10 });
    const body = h.calls.find((c) => c.fn === "fn_deposit_list").body;
    assert.equal(body.p_ma_ctdk_uid, tenant);
    assert.equal(body.p_tu_ngay, null, "no date filter → null like the web");
    assert.equal(body.p_den_ngay, null);
    assert.equal(body.p_offset, 10);
    assert.equal(body.p_limit, 10);
    assert.equal(res.totalRows, 7);
    const d = res.data[0];
    assert.equal(d.MaPGC, "pgc1");
    assert.equal(d.PhieuGiuChoId, "pgc1");
    assert.equal(d.TongGiaTriHDMB, 900, "falls back to gia_tri_hd");
    assert.equal(d.KhachHang, "Khách");
    assert.equal(d.MaSanPham, "A-1");
  }
  const h = harness({ rpc: { fn_deposit_list: [] } });
  await h.deposits().get({ TuNgay: "2026-09-01", DenNgay: "2026-09-30" });
  const body = h.calls.find((c) => c.fn === "fn_deposit_list").body;
  assert.equal(body.p_tu_ngay, "2026-09-01T00:00:00.000+07:00");
  assert.equal(body.p_den_ngay, "2026-09-30T23:59:59.999+07:00");
});

test("contract list: fn_contract_list (HĐMB gốc) with server-side paid amount", async () => {
  const h = harness({
    rpc: { fn_contract_list: { rows: [{ id: "hd1", pgc_id: "pgc1", so_hd: "HD-1", ten_kh: "Khách", gia_tri_hd_sau_ck: 800, gia_tri_hd: 900, da_thu: 300, ten_tt: "Đã ký", color_code: "#123456" }], total_count: 3 } },
  });
  const res = await h.contracts().get({ Offset: 1, Limit: 20, inputSearch: " HD " });
  const body = h.calls.find((c) => c.fn === "fn_contract_list").body;
  assert.equal(body.p_loai_ct, "HDMB");
  assert.equal(body.p_transfer_only, false);
  assert.equal(body.p_input_search, "HD");
  assert.equal(body.p_ma_ctdk_uid, tenant);
  assert.equal(res.totalRows, 3);
  assert.equal(res.data[0].SoHDMB, "HD-1");
  assert.equal(res.data[0].PhieuGiuChoId, "pgc1");
  assert.equal(res.data[0].TongGiaTriHDMB, 800);
  assert.equal(res.data[0].DaThu, 300);
});

test("payment schedule: server function first", async () => {
  const h = harness({ rpc: { fn_contract_payment_schedule: [{ dot_tt: 1, phai_thu: 100, da_thu: 40, con_lai: 60 }] } });
  const res = await h.progress.getSchedule("pgc1");
  assert.deepEqual(plain(h.calls[0].body), { p_ma_ctdk_uid: tenant, p_pgc_id: "pgc1" });
  assert.equal(res.rows[0].ConLai, 60);
  assert.equal(res.source, "server");
});

test("payment schedule fallback: stored schedule of the sales doc + web allocation of whole receipts", async () => {
  const h = harness({
    rpc: {
      fn_contract_payment_schedule: [],
      fn_cash_vouchers_by_pgc: [{ so_tien: 150, so_tien_pgc: 100 }],
    },
    tables: {
      cloud_catalogs: [{ raw: { DotTT: 2, SoTien: 200 } }, { raw: { DotTT: 1, SoTien: 100, PhaiThuPBT: 10 } }],
    },
  });
  const res = await h.progress.getSchedule("pgc1");
  const q = h.calls.find((c) => c.table === "cloud_catalogs").params;
  assert.equal(q.parent_code, "eq.pgc1", "parent is the sales doc (phiếu giữ chỗ) like the web");
  assert.equal(q.catalog_type, "eq.lich_tt_hd");
  assert.equal(q.ma_ctdk, "eq.beesky1", "web filters stored schedules by the lowercase company code");
  assert.equal(res.source, "fallback");
  assert.deepEqual(plain(res.rows.map((r) => [r.DotTT, r.DaThu, r.ConLai, r.DaThuPBT])), [[1, 100, 0, 0], [2, 50, 150, 0]]);
});

test("receipts of one sales doc: fn_cash_vouchers_by_pgc, own share only", async () => {
  const h = harness({
    rpc: { fn_cash_vouchers_by_pgc: [{ id: "v1", so_phieu: "PT-1", ngay_phieu: "2026-09-02", so_tien: 1000, so_tien_pgc: 300, dien_giai: "Đợt 1", hinh_thuc: "CK" }] },
  });
  const res = await h.progress.getReceipts("pgc1");
  assert.deepEqual(plain(h.calls[0].body), { p_ma_ctdk_uid: tenant, p_pgc_id: "pgc1", p_loai: "THU" });
  assert.equal(res.total, 300);
  assert.equal(res.rows[0].soTien, 300);
  assert.equal(res.rows[0].soPhieu, "PT-1");
  const bad = harness({ failRpc: { fn_cash_vouchers_by_pgc: true } });
  const err = await bad.progress.getReceipts("pgc1");
  assert.equal(err.error, true);
});

test("receipt report: fn_cash_voucher_list THU for the period", async () => {
  const h = harness({
    rpc: { fn_cash_voucher_list: { rows: [{ id: "v1", so_phieu: "PT-1", ngay_phieu: "2026-09-02", so_tien: 500, khach: { ten_kh: "Khách" }, du_an: { ten_da: "DA" } }], total_count: 1 } },
  });
  const res = await h.reports().getReceipts({ from: "2026-09-01", to: "2026-09-30", projectId: uid(4) });
  const body = h.calls.find((c) => c.fn === "fn_cash_voucher_list").body;
  assert.equal(body.p_loai, "THU");
  assert.equal(body.p_tu_ngay, "2026-09-01");
  assert.equal(body.p_den_ngay, "2026-09-30");
  assert.deepEqual(plain(body.p_project_ids), [uid(4)]);
  assert.equal(res.total, 500);
  assert.equal(res.rows[0].tenKH, "Khách");
});

test("progress report: always live from the sales lifecycle, original contracts only (web default GOC)", async () => {
  const life = harness({
    tables: {
      cloud_debts: [{ ma_cong_no: "TIENDO:1", raw: { SoHDMB: "STALE" } }],
      cloud_pgc_phieu_giucho: [
        { id: "p1", giai_doan: "HDMB", so_phieu_gc: "BK-1", san_pham_id: "s1", project_id: "d1", khach_hang_id: "k1", trang_thai_id: "t1",
          gia_tri_hd: 300, da_thu: 0, lich_thanh_toan: [{ DotTT: 1, SoTien: 100, NgayTT: "2020-01-01" }, { DotTT: 2, SoTien: 200, NgayTT: "2999-01-01" }, { DotTT: 3, SoTien: 10 }] },
        { id: "p2", giai_doan: "DATCOC", trang_thai_id: "t2", lich_thanh_toan: [{ DotTT: 1, SoTien: 50, NgayTT: "2020-01-01" }] },
      ],
      cloud_catalogs: [{ id: "t1", item_name: "Đã ký" }, { id: "t2", item_name: "Đã hủy" }],
      cloud_contracts: [{ phieu_giu_cho_id: "p1", so_hdmb: "HD-1" }],
      cloud_deposits: [],
      cloud_cash_voucher_details: [{ pgc_id: "p1", ma_loai: null, so_tien: 60 }],
      bds_products: [{ id: "s1", ky_hieu: "A-1" }],
      da_projects: [{ id: "d1", ten_da: "Dự án A" }],
      cloud_customers: [{ id: "k1", ten_kh: "Khách" }],
    },
  });
  const b = await life.reports().getProgress({});
  assert.equal(life.calls.some((c) => c.table === "cloud_debts"), false, "the stale mirror is not used");
  const pq = life.calls.find((c) => c.table === "cloud_pgc_phieu_giucho").params;
  assert.equal(pq.ma_ctdk_uid, `eq.${tenant}`);
  assert.equal(pq.deleted_at, "is.null");
  assert.equal(pq.giai_doan, "in.(DATCOC,HDGV,HDMB)");
  assert.equal(pq.ma_hd_goc, "is.null", "original contracts only");
  assert.equal(b.rows.length, 3, "cancelled doc dropped");
  const first = b.rows.find((r) => r.ngayDenHan === "2020-01-01");
  assert.deepEqual([first.soHD, first.tenDA, first.kyHieu, first.hoTenKH, first.daThu, first.conLai], ["HD-1", "Dự án A", "A-1", "Khách", 60, 40]);
  assert.equal(b.overdue.length, 1);
  const due = await life.reports().getProgress({ from: "2998-12-01", to: "2999-12-31" });
  assert.deepEqual(plain(due.upcoming.map((r) => r.conLai).sort((x, y) => x - y)), [10, 200], "undated installments stay like the web");
});

test("progress report fails loudly when a lookup fails (no silent wrong figures)", async () => {
  const h = harness({
    tables: {
      cloud_pgc_phieu_giucho: [{ id: "p1", giai_doan: "HDMB", trang_thai_id: "t1", lich_thanh_toan: [{ DotTT: 1, SoTien: 1, NgayTT: "2020-01-01" }] }],
      cloud_catalogs: () => {
        throw new Error("url too long");
      },
    },
  });
  const res = await h.reports().getProgress({});
  assert.equal(res.error, true);
});

test("receipt report counts original contracts only (web Phiếu thu default GOC)", async () => {
  const h = harness({ rpc: { fn_cash_voucher_list: { rows: [], total_count: 0 } } });
  await h.reports().getReceipts({ from: "2026-09-01", to: "2026-09-30" });
  assert.equal(h.calls.find((c) => c.fn === "fn_cash_voucher_list").body.p_contract_type, "GOC");
});

test("agency deposits: empty scope or a selection outside it returns nothing (never all projects)", async () => {
  const none = harness({ typeAccount: "AGENCY", scope: [], rpc: { fn_deposit_list: [{ id: "x" }] } });
  assert.equal((await none.deposits().get({})).data.length, 0);
  assert.equal(none.calls.some((c) => c.fn === "fn_deposit_list"), false);
  const outside = harness({ typeAccount: "AGENCY", scope: [{ id: uid(4), ma_da_code: "DA4" }], rpc: { fn_deposit_list: [{ id: "x" }] } });
  assert.equal((await outside.deposits().get({ DuAn: uid(5) })).data.length, 0);
  const inside = harness({ typeAccount: "AGENCY", scope: [{ id: uid(4), ma_da_code: "DA4" }], rpc: { fn_deposit_list: [{ id: "x" }] } });
  await inside.deposits().get({});
  assert.equal(inside.calls.find((c) => c.fn === "fn_deposit_list").body.p_project_id, uid(4));
});

test("schedule fallback like the web: company code filter, PBT only from PhaiThuPBT, raw rows when receipts fail", async () => {
  const h = harness({
    rpc: { fn_contract_payment_schedule: [] },
    failRpc: { fn_cash_vouchers_by_pgc: true },
    tables: { cloud_catalogs: [{ raw: { DotTT: 1, SoTien: 100, PhiBT: 9, DaThu: 30 } }] },
  });
  const res = await h.progress.getSchedule("pgc1");
  const q = h.calls.find((c) => c.table === "cloud_catalogs").params;
  assert.equal(q.ma_ctdk, "eq.beesky1");
  assert.equal(res.rows[0].PhaiThuPBT, 0);
  assert.equal(res.rows[0].DaThu, 30, "receipts failed → stored values shown as-is");
  assert.equal(res.rows[0].ConLai, 70);
});
