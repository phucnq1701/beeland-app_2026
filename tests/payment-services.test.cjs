/* global __dirname */
// Dịch vụ cọc / hợp đồng / báo cáo gọi đúng hàm máy chủ như web:
//  cọc / HĐ / lịch TT / phiếu thu theo phiếu ⇒ bộ API riêng app (fn_nv_app_* bọc fn_deposit_list, fn_sale_contract_list,
//  fn_contract_payment_schedule, fn_cash_vouchers_by_pgc — công ty từ phiên ở máy chủ);
//  báo cáo (ReportService – còn ở luồng L3) vẫn fn_cash_voucher_list / vòng đời phiếu.
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
const listRpc = run("lib/listRpc.ts", {});

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
      if (fn.startsWith("fn_nv_app_")) throw new Error("fn_nv_app_* phải qua callNv");
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
  const nv = {
    callNv: async (fn, args) => {
      calls.push({ method: "nv", fn, body: args });
      if (failRpc[fn]) throw new Error("boom");
      const r = rpc[fn];
      return typeof r === "function" ? r(args) : r ?? [];
    },
    errorMessage: (e, f) => e?.message || f,
  };
  const map = {
    "@/services/nvApi": nv,
    "@/services/SanPhamApi": { DuAnApi: { resolveId: async (x) => (String(x).startsWith("CODE-") ? null : x) } },
    "../lib/format": { formatDirections: (a, b) => [a, b].filter(Boolean).join(" / ") },
    "./axiosApiSupabase": { default: http },
    "./cloudTenant": cloudTenant,
    "../lib/paymentMath": math,
    "../lib/depositQr": depositQr,
    "../lib/listRpc": listRpc,
    "./ProjectService": { ProjectService: { getProjects: async () => ({ data: scope }) } },
    "@react-native-async-storage/async-storage": { default: { getItem: async () => null } },
  };
  // Khách qua RPC fn_customer_get_by_ids (helper thật, cùng axios giả)
  map["./customerLookup"] = run("sevicesSupabase/customerLookup.ts", map);
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

test("deposit list: fn_nv_app_dat_coc_list (= fn_deposit_list màn Đặt cọc), both response shapes", async () => {
  const row = { id: "dc1", pgc_id: "pgc1", so_phieu: "DC-1", ten_kh: "Khách", ky_hieu: "A-1", gia_tri_hd: 900, tien_coc: 50, da_thu: 20, total_count: 7,
    chi_xem: true, TrangThaiHoan: "CHO_DUYET" };
  for (const shape of [{ rows: [row], total: 7 }, { rows: [row], total_count: 7 }, [row]]) {
    const h = harness({ rpc: { fn_nv_app_dat_coc_list: shape } });
    const res = await h.deposits().get({ Offset: 2, Limit: 10, inputSearch: " DC " });
    const body = h.calls.find((c) => c.fn === "fn_nv_app_dat_coc_list").body;
    assert.deepEqual(plain(body), { p_tu_khoa: "DC", p_tu_ngay: null, p_den_ngay: null, p_ma_tt: null, p_du_an_id: null, p_trang: 2, p_so_dong: 10 });
    assert.equal(res.totalRows, 7);
    const d = res.data[0];
    assert.equal(d.MaPGC, "pgc1");
    assert.equal(d.PhieuGiuChoId, "pgc1");
    assert.equal(d.TongGiaTriHDMB, 900, "falls back to gia_tri_hd");
    assert.equal(d.KhachHang, "Khách");
    assert.equal(d.MaSanPham, "A-1");
    assert.equal(d.ChiXem, true);
    assert.equal(d.TrangThaiHoan, "CHO_DUYET");
  }
  const h = harness({ rpc: { fn_nv_app_dat_coc_list: [] } });
  await h.deposits().get({ TuNgay: "2026-09-01", DenNgay: "2026-09-30", MaTT: 8 });
  const body = h.calls.find((c) => c.fn === "fn_nv_app_dat_coc_list").body;
  assert.equal(body.p_tu_ngay, "2026-09-01T00:00:00.000+07:00");
  assert.equal(body.p_den_ngay, "2026-09-30T23:59:59.999+07:00");
  assert.equal(body.p_ma_tt, 8);
  assert.equal(h.calls.some((c) => c.method !== "nv"), false, "không gọi rest/v1");
});

test("contract list: fn_nv_app_hop_dong_list (= fn_sale_contract_list màn DS HĐ) with server-side paid amount", async () => {
  const h = harness({
    rpc: { fn_nv_app_hop_dong_list: { rows: [{ id: "hd1", pgc_id: "pgc1", so_hd: "HD-1", ten_kh: "Khách", gia_tri_hd_sau_ck: 800, gia_tri_hd: 900, da_thu: 300, ten_tt: "Đã ký", color_code: "#123456" }], total: 3 } },
  });
  const res = await h.contracts().get({ Offset: 2, Limit: 20, inputSearch: " HD " });
  const body = h.calls.find((c) => c.fn === "fn_nv_app_hop_dong_list").body;
  assert.deepEqual(plain(body), { p_tu_khoa: "HD", p_tu_ngay: null, p_den_ngay: null, p_ma_tt: null, p_du_an_id: null, p_trang: 2, p_so_dong: 20 });
  assert.equal(res.totalRows, 3);
  assert.equal(res.data[0].SoHDMB, "HD-1");
  assert.equal(res.data[0].PhieuGiuChoId, "pgc1");
  assert.equal(res.data[0].TongGiaTriHDMB, 800);
  assert.equal(res.data[0].DaThu, 300);
  assert.equal(h.calls.some((c) => c.method !== "nv"), false);
});

test("payment schedule: fn_nv_app_lich_tt_phieu (máy chủ tính cả lịch lưu) — không dựng dự phòng ở máy; lỗi ⇒ error", async () => {
  const h = harness({ rpc: { fn_nv_app_lich_tt_phieu: [{ dot_tt: 1, phai_thu: 100, da_thu: 40, con_lai: 60 }] } });
  const res = await h.progress.getSchedule("pgc1");
  assert.deepEqual(plain(h.calls), [{ method: "nv", fn: "fn_nv_app_lich_tt_phieu", body: { p_id: "pgc1" } }]);
  assert.equal(res.rows[0].ConLai, 60);
  assert.equal(res.source, "server");
  const empty = harness({ rpc: { fn_nv_app_lich_tt_phieu: [] } });
  const e = await empty.progress.getSchedule("pgc1");
  assert.equal(e.rows.length, 0);
  assert.equal(e.source, "none");
  assert.equal(empty.calls.length, 1, "không đọc lich_tt_hd / phiếu thu để tự phân bổ");
  const bad = harness({ failRpc: { fn_nv_app_lich_tt_phieu: true } });
  assert.equal((await bad.progress.getSchedule("pgc1")).error, true);
  assert.deepEqual(plain(await bad.progress.getSchedule(null)), { rows: [], source: "none" });
});

test("receipts of one sales doc: fn_nv_app_phieu_thu_phieu, own share only", async () => {
  const h = harness({
    rpc: { fn_nv_app_phieu_thu_phieu: [{ id: "v1", so_phieu: "PT-1", ngay_phieu: "2026-09-02", so_tien: 1000, so_tien_pgc: 300, dien_giai: "Đợt 1", hinh_thuc: "CK" }] },
  });
  const res = await h.progress.getReceipts("pgc1");
  assert.deepEqual(plain(h.calls[0]), { method: "nv", fn: "fn_nv_app_phieu_thu_phieu", body: { p_id: "pgc1" } });
  assert.equal(res.total, 300);
  assert.equal(res.rows[0].soTien, 300);
  assert.equal(res.rows[0].soPhieu, "PT-1");
  const bad = harness({ failRpc: { fn_nv_app_phieu_thu_phieu: true } });
  const err = await bad.progress.getReceipts("pgc1");
  assert.equal(err.error, true);
});

test("contract detail: thiếu uuid phiếu giữ chỗ ⇒ gửi uuid hợp đồng (máy chủ tự quy đổi), không tra cloud_contracts", async () => {
  const h = harness({ rpc: { fn_nv_app_lich_tt_phieu: [], fn_nv_app_phieu_thu_phieu: [] } });
  await h.contracts().getDetailLTT({ PhieuGiuChoId: null, MaPGC: "hd1" });
  await h.contracts().getDetailLST({ PhieuGiuChoId: "pgc9", MaPGC: "hd1" });
  assert.deepEqual(plain(h.calls.map((c) => [c.fn, c.body.p_id])), [["fn_nv_app_lich_tt_phieu", "hd1"], ["fn_nv_app_phieu_thu_phieu", "pgc9"]]);
});

test("deposit detail: 1 lời gọi đầu phiếu + lịch + phiếu thu song song; dòng mới nhất, khách của chứng từ, loại căn / hướng, cờ QR", async () => {
  const h = harness({
    rpc: {
      fn_nv_app_dat_coc_chi_tiet: {
        dong: { id: "dc1", pgc_id: "pgc1", so_phieu: "DC-1", ma_tt: "8", ten_tt: "Đặt cọc chờ duyệt", tien_coc: 100, da_thu: 30, TrangThaiHoan: null },
        doc: { ok: true, pgc: { phi_bao_tri: 7, gia_tri_hd: 900 }, khach_hang: { ten_kh: "Khách", email: "a@b", cccd: "0**", dia_chi: "HN", ma_so_kh: "KH1", dien_thoai: "09" } },
        san_pham: { ma_sp: "SP1", ky_hieu: "A-1", loai_can: "2PN", huong_cua: "Đông", huong_bc: "Tây" },
        doi_can_cho_duyet: false, quyen: { payment_qr: true },
      },
      fn_nv_app_lich_tt_phieu: [{ dot_tt: 1, phai_thu: 100 }],
      fn_nv_app_phieu_thu_phieu: [{ id: "v1", so_tien_pgc: 30 }],
    },
  });
  const r = await h.deposits().getDepositDetail({ row: { PhieuGiuChoId: "pgc1", TenTT: "cũ", MaTT: 6 } });
  assert.deepEqual(plain(h.calls.map((c) => [c.fn, c.body])),
    [["fn_nv_app_dat_coc_chi_tiet", { p_id: "pgc1" }], ["fn_nv_app_lich_tt_phieu", { p_id: "pgc1" }], ["fn_nv_app_phieu_thu_phieu", { p_id: "pgc1" }]]);
  const d = r.data;
  assert.equal(d.TenTT, "Đặt cọc chờ duyệt", "trạng thái hiện tại thắng dòng cũ");
  assert.equal(d.MaTT, 8);
  assert.equal(d.Email, "a@b");
  assert.equal(d.SoCMND, "0**", "đã che ở máy chủ");
  assert.equal(d.LoaiCanHo, "2PN");
  assert.equal(d.Huong, "Đông / Tây");
  assert.equal(d.PhiBaoTri, 7);
  assert.equal(d.QuyenQR, true);
  assert.equal(d.DoiCanChoDuyet, false);
  assert.equal(depositQr.canOfferDepositQr(d), true);
  assert.equal(r.tongDaThu, 30);
  assert.equal(r.lichTT.length, 1);

  const fail = harness({ failRpc: { fn_nv_app_dat_coc_chi_tiet: true } });
  const f = await fail.deposits().getDepositDetail({ row: { ID: "dc1", TenTT: "Đặt cọc chờ duyệt", TienCoc: 100, DaThu: 0 } });
  assert.equal(fail.calls[0].body.p_id, "dc1", "không có phiếu giữ chỗ ⇒ id phiếu cọc");
  assert.equal(f.data.QuyenQR, false, "lỗi tải ⇒ khoá QR (fail-closed)");
  assert.equal(depositQr.canOfferDepositQr(f.data), false);
});

test("QR cọc như web: quyền PAYMENT_QR + chờ duyệt + còn tiền, không đổi căn / hoàn cọc chờ duyệt", () => {
  const ok = { TenTT: "Đặt cọc chờ duyệt", MaTT: 8, TienCoc: 100, DaThu: 0, QuyenQR: true };
  assert.equal(depositQr.canOfferDepositQr(ok), true);
  assert.equal(depositQr.canOfferDepositQr({ ...ok, QuyenQR: false }), false);
  assert.equal(depositQr.canOfferDepositQr({ ...ok, QuyenQR: undefined }), false);
  assert.equal(depositQr.canOfferDepositQr({ ...ok, DoiCanChoDuyet: true }), false);
  assert.equal(depositQr.canOfferDepositQr({ ...ok, TrangThaiHoan: "CHO_DUYET" }), false);
  assert.equal(depositQr.canOfferDepositQr({ ...ok, TrangThaiHoan: "DA_HOAN" }), true);
  assert.equal(depositQr.canOfferDepositQr({ ...ok, DaThu: 100 }), false);
});

test("status filter: fn_nv_app_trang_thai_list (màu theo công ty như web), bỏ mã trống", async () => {
  const h = harness({ rpc: { fn_nv_app_trang_thai_list: [{ id: "a", item_code: "8", item_name: "Đặt cọc chờ duyệt", color_code: "#111" }, { id: "b", item_code: "", item_name: "x" }] } });
  const r = await h.deposits().getTT();
  assert.deepEqual(plain(h.calls[0].body), { p_loai: "pgc_trang_thai" });
  assert.deepEqual(plain(r.data.map((x) => [x.MaTT, x.TenTT, x.ColorWeb])), [[8, "Đặt cọc chờ duyệt", "#111"]]);
  await h.contracts().getTT();
  assert.equal(h.calls[1].fn, "fn_nv_app_trang_thai_list");
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
  const P1 = uid(101), P2 = uid(102), P3 = uid(103), K1 = uid(201);
  const life = harness({
    tables: {
      cloud_debts: [{ ma_cong_no: "TIENDO:1", raw: { SoHDMB: "STALE" } }],
      cloud_pgc_phieu_giucho: [
        { id: P1, giai_doan: "HDMB", so_phieu_gc: "BK-1", san_pham_id: "s1", project_id: "d1", khach_hang_id: K1, trang_thai_id: "t1",
          gia_tri_hd: 300, da_thu: 0, lich_thanh_toan: [{ DotTT: 1, SoTien: 100, NgayTT: "2020-01-01" }, { DotTT: 2, SoTien: 200, NgayTT: "2999-01-01" }, { DotTT: 3, SoTien: 10 }] },
        { id: P2, giai_doan: "DATCOC", trang_thai_id: "t2", lich_thanh_toan: [{ DotTT: 1, SoTien: 50, NgayTT: "2020-01-01" }] },
        // HĐ gốc đã chuyển nhượng (cờ máy chủ) ⇒ bỏ như web
        { id: P3, giai_doan: "HDMB", trang_thai_id: "t1", lich_thanh_toan: [{ DotTT: 1, SoTien: 70, NgayTT: "2020-01-01" }] },
      ],
      cloud_catalogs: [{ id: "t1", item_name: "Đã ký" }, { id: "t2", item_name: "Đã hủy" }],
      cloud_contracts: [{ phieu_giu_cho_id: P1, so_hdmb: "HD-1" }],
      cloud_deposits: [],
      bds_products: [{ id: "s1", ky_hieu: "A-1" }],
      da_projects: [{ id: "d1", ten_da: "Dự án A" }],
    },
    rpc: {
      // Đã thu theo phiếu: máy chủ (bảng cloud_cash_voucher_details đã khoá đọc thẳng)
      fn_pgc_collected: { [P1]: { da_thu: 60, da_thu_pbt: 0 }, [P3]: { da_thu: 0, da_thu_pbt: 0, da_chuyen_nhuong: true } },
      // Khách: RPC (bảng cloud_customers đã khoá đọc thẳng)
      fn_customer_get_by_ids: (body) => (body.p_ids || []).includes(K1) ? [{ id: K1, ten_kh: "Khách" }] : [],
    },
  });
  const b = await life.reports().getProgress({});
  assert.equal(life.calls.some((c) => c.table === "cloud_debts"), false, "the stale mirror is not used");
  assert.equal(life.calls.some((c) => c.table === "cloud_customers" || c.table === "cloud_cash_voucher_details"), false,
    "locked tables are not read directly");
  assert.deepEqual(plain(life.calls.find((c) => c.fn === "fn_pgc_collected").body.p_pgc_ids), [P1, P2, P3]);
  const pq = life.calls.find((c) => c.table === "cloud_pgc_phieu_giucho").params;
  assert.equal(pq.ma_ctdk_uid, `eq.${tenant}`);
  assert.equal(pq.deleted_at, "is.null");
  assert.equal(pq.giai_doan, "in.(DATCOC,HDGV,HDMB)");
  assert.equal(pq.ma_hd_goc, "is.null", "original contracts only");
  assert.equal(b.rows.length, 3, "cancelled doc and transferred original dropped");
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

test("deposits: project scope is enforced by the server; one project → p_du_an_id, several → one call each, merged; unknown code → empty", async () => {
  const agency = harness({ typeAccount: "AGENCY", scope: [], rpc: { fn_nv_app_dat_coc_list: { rows: [], total: 0 } } });
  await agency.deposits().get({});
  assert.equal(agency.calls.find((c) => c.fn === "fn_nv_app_dat_coc_list").body.p_du_an_id, null);

  const one = harness({ rpc: { fn_nv_app_dat_coc_list: { rows: [], total: 0 } } });
  await one.deposits().get({ DuAn: uid(4) });
  assert.equal(one.calls.find((c) => c.fn === "fn_nv_app_dat_coc_list").body.p_du_an_id, uid(4));

  const many = harness({
    rpc: { fn_nv_app_dat_coc_list: { rows: [{ id: "d1", ngay_coc: "2026-10-02T00:00:00Z" }, { id: "d2", ngay_coc: "2026-10-01T00:00:00Z" }], total: 2 } },
  });
  const res = await many.deposits().get({ DuAn: [uid(4), uid(5)], Offset: 1, Limit: 3 });
  const calls = many.calls.filter((c) => c.fn === "fn_nv_app_dat_coc_list");
  assert.deepEqual(plain(calls.map((c) => c.body.p_du_an_id)), [uid(4), uid(5)]);
  assert.deepEqual(plain(calls.map((c) => [c.body.p_trang, c.body.p_so_dong])), [[1, 3], [1, 3]]);
  assert.equal(res.totalRows, 4);
  assert.deepEqual(plain(res.data.map((d) => d.ID)), ["d1", "d2"], "same rows from both calls are de-duplicated");

  const none = harness({ rpc: { fn_nv_app_dat_coc_list: { rows: [{ id: "x" }], total: 1 } } });
  const z = await none.deposits().get({ DuAn: "CODE-404" });
  assert.equal(z.totalRows, 0);
  assert.equal(none.calls.length, 0, "chọn dự án không tra được ⇒ không gọi (như web)");
});
