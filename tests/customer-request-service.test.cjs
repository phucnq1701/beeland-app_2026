/* global __dirname */
// Yêu cầu khách hàng (app nhân viên) — bộ API riêng fn_nv_app_yeu_cau_* (= fn_customer_request_* của web CustomerRequest.js),
// danh mục fn_nv_app_danh_muc, nhân viên fn_nv_app_nhan_vien_list, ký tệp fn_nv_app_yeu_cau_tep_ky (chỉ tệp của yêu cầu xem được).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const compile = (file) =>
  ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
function run(file, requireMap) {
  const exports = {};
  vm.runInNewContext(compile(file), { exports, console: { log() {} }, Date, Promise, require: (n) => requireMap[n] ?? { default: {} } });
  return exports;
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
class NvApiError extends Error {
  constructor(m, status = 400) { super(m); this.status = status; }
}

function harness(handlers = {}) {
  const calls = [];
  const nv = {
    NvApiError,
    errorMessage: (e, f) => (e && e.message) || f,
    callNv: async (fn, body) => {
      calls.push({ fn, body });
      const h = handlers[fn];
      if (!h) throw new Error(`unexpected ${fn}`);
      return h(body);
    },
  };
  const signing = run("lib/signing.ts", {});
  const reqLib = run("lib/customerRequest.ts", { "./signing": signing });
  const uploads = [];
  const svc = run("sevicesSupabase/CustomerRequestService.ts", {
    "@/services/nvApi": nv,
    "@/services/config": { API_URL: "https://api.test" },
    "./BookingService": { uploadTenantFile: async (f, folder) => (uploads.push({ f, folder }), "https://upload.test/yeu-cau/a.png") },
    "./CustomerService": { fetchCatalogList: (t) => nv.callNv("fn_nv_app_danh_muc", { p_loai: t }) },
    "../lib/customerRequest": reqLib,
    "../lib/signing": signing,
  }).CustomerRequestService;
  return { calls, svc, uploads, reqLib };
}

test("list / get / save / remove / process / logs go through fn_nv_app_yeu_cau_* with the web parameters", async () => {
  const h = harness({
    fn_nv_app_yeu_cau_list: () => ({ rows: [{ ID: uid(1), MaYC: "YC1", TenKH: "A" }], total: 7 }),
    fn_nv_app_yeu_cau_chi_tiet: (b) => (b.p_id === uid(1) ? { ID: uid(1), MaYC: "YC1", MaHD: uid(9), SoHD: "BK-1", ListAttach: [] } : null),
    fn_nv_app_yeu_cau_luu: (b) => ({ ID: uid(2), TieuDe: b.p.TieuDe }),
    fn_nv_app_yeu_cau_xoa: () => ({ ok: true }),
    fn_nv_app_yeu_cau_xu_ly: () => ({ ok: true }),
    fn_nv_app_yeu_cau_nhat_ky: () => [{ ID: "l1", Name: "Mới", NoiDung: "x", NgayXL: "2026-11-01" }],
  });
  const list = await h.svc.list({ keyword: " a ", status: "new", from: "2026-11-01", page: 2, size: 10 });
  assert.equal(list.total, 7);
  assert.equal(list.rows[0].customerName, "A");
  assert.deepEqual(plain(h.calls[0].body), {
    p_keyword: "a", p_ma_da: null, p_nguon: null, p_trang_thai: "new", p_uu_tien: null, p_tu_ngay: "2026-11-01", p_den_ngay: null, p_page: 2, p_size: 10,
  });
  const d = await h.svc.get(uid(1));
  assert.equal(d.contractCode, "BK-1");
  await assert.rejects(h.svc.get(uid(3)), /Không tìm thấy/);
  const saved = await h.svc.save({ ...h.reqLib.EMPTY_REQUEST_FORM, title: "Tiêu đề", customerName: "A" });
  assert.equal(saved.id, uid(2));
  await h.svc.remove(uid(1));
  await h.svc.process(uid(1), "done", " ghi chú ");
  assert.deepEqual(plain(h.calls.find((c) => c.fn === "fn_nv_app_yeu_cau_xu_ly").body), { p_id: uid(1), p_trang_thai: "done", p_noi_dung: "ghi chú" });
  assert.equal((await h.svc.logs(uid(1))).length, 1);
});

test("server refusal (permission / scope) reaches the screen with the server message", async () => {
  const h = harness({ fn_nv_app_yeu_cau_list: () => { throw new NvApiError('Bạn không có quyền "Xem" ở "Yêu cầu khách hàng"', 403); } });
  await assert.rejects(h.svc.list({}), /không có quyền/);
});

test("catalogs: 4 types via fn_nv_app_danh_muc; empty / error ⇒ the web fixed set", async () => {
  const h = harness({
    fn_nv_app_danh_muc: (b) =>
      b.p_loai === "dm_loai_yeu_cau" ? [{ id: "c1", item_code: "complaint", item_name: "Khiếu nại", raw: { Code: "complaint" } }]
      : b.p_loai === "dm_nguon_yeu_cau" ? (() => { throw new NvApiError("boom", 500); })()
      : [],
  });
  const cats = await h.svc.catalogs();
  assert.deepEqual(plain(h.calls.map((c) => c.body.p_loai)).sort(), ["dm_loai_yeu_cau", "dm_nguon_yeu_cau", "dm_trang_thai_yeu_cau", "dm_uu_tien_yeu_cau"]);
  assert.equal(cats.dm_loai_yeu_cau.some((c) => c.Name === "Khiếu nại"), true);
  assert.equal(cats.dm_nguon_yeu_cau.length > 0, true, "lỗi ⇒ bộ cố định web");
  assert.equal(cats.dm_trang_thai_yeu_cau.length > 0, true, "trống ⇒ bộ cố định web");
});

test("employees: fn_nv_app_nhan_vien_list, value = ma_nv, de-duplicated, sorted by name", async () => {
  const h = harness({
    fn_nv_app_nhan_vien_list: () => [
      { id: uid(1), ma_nv: "NV2", ho_ten: "Trần B", ten_cv: "KD" },
      { id: uid(2), ma_nv: "NV1", ho_ten: "An A", ten_cv: null },
      { id: uid(3), ma_nv: "NV2", ho_ten: "Trùng", ten_cv: null },
      { id: uid(4), ma_nv: "", ho_ten: "Không mã" },
    ],
  });
  assert.deepEqual(plain(await h.svc.employees()), [
    { value: "NV1", label: "An A", description: "NV1" },
    { value: "NV2", label: "Trần B", description: "KD · NV2" },
  ]);
});

test("contract label: server SoHD; legacy code kept; uuid without number ⇒ null (no table read)", async () => {
  const h = harness({});
  assert.equal(await h.svc.contractLabel(uid(9), "BK-1"), "BK-1");
  assert.equal(await h.svc.contractLabel("HD-OLD", null), "HD-OLD");
  assert.equal(await h.svc.contractLabel(uid(9), null), null);
  assert.equal(await h.svc.contractLabel(null), null);
  assert.equal(h.calls.length, 0);
});

test("attachments: drive-files signed via fn_nv_app_yeu_cau_tep_ky with the request id; refusal ⇒ empty url; uploads via fn_nv_app_tai_tep", async () => {
  const h = harness({
    fn_nv_app_yeu_cau_tep_ky: (b) => {
      if (b.p_path === "kh/b.pdf") throw new NvApiError("Không có quyền xem tệp này", 403);
      return { url: `https://kho.test/${b.p_path}?sig=1` };
    },
  });
  const files = await h.svc.resolveAttachments(["drive-files:kh/a.jpg", "drive-files:kh/b.pdf", "https://upload.test/x.png"], uid(1));
  assert.deepEqual(plain(h.calls.map((c) => c.body)), [{ p_id: uid(1), p_path: "kh/a.jpg" }, { p_id: uid(1), p_path: "kh/b.pdf" }]);
  assert.equal(files[0].url, "https://kho.test/kh/a.jpg?sig=1");
  assert.equal(files[0].image, true);
  assert.equal(files[1].url, "");
  assert.equal(files[2].url, "https://upload.test/x.png");
  const url = await h.svc.upload({ uri: "file:///a.png", name: "a.png", type: "image/png" });
  assert.equal(url, "https://upload.test/yeu-cau/a.png");
  assert.equal(h.uploads[0].folder, "yeu-cau");
});
