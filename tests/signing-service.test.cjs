/* global __dirname */
// Đặt lịch ký (app nhân viên) — bộ API riêng fn_nv_app_lich_ky_* (= fn_signing_* của web SigningAppointmentCloudService).
// Màn danh sách / chi tiết gọi SigningService; form Thêm / Sửa = logic web chép (lib/web) đi qua shim supabase RPC_MAP.
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

function harness(handlers = {}) {
  const calls = [];
  const nv = {
    errorMessage: (e, f) => (e && e.message) || f,
    callNv: async (fn, body) => {
      calls.push({ fn, body });
      const h = handlers[fn];
      if (!h) throw new Error(`unexpected ${fn}`);
      return h(body);
    },
  };
  const signing = run("lib/signing.ts", {});
  const svc = run("sevicesSupabase/SigningService.ts", {
    "@/services/nvApi": nv,
    "./customerLookup": { getCustomersByIds: (ids) => nv.callNv("fn_nv_app_khach_hang_theo_id", { p_ids: ids }) },
    "./DatCocService": run("sevicesSupabase/DatCocService.ts", { "@/services/nvApi": nv }),
    "../lib/signing": signing,
  }).SigningService;
  const shim = run("lib/web/_shims/integrations/supabase/client.ts", { "@/services/nvApi": nv, "@/services/SanPhamApi": { DuAnApi: {} } });
  return { calls, svc, shim };
}

test("list / get / remove / searchDeposits gọi fn_nv_app_lich_ky_* đúng tham số web", async () => {
  const h = harness({
    fn_nv_app_lich_ky_list: () => ({ rows: [{ id: uid(1), seq: 7, trang_thai: "PENDING" }], total: 1 }),
    fn_nv_app_lich_ky_chi_tiet: (b) => (b.p_id === uid(1) || b.p_seq === 7 ? [{ id: uid(1), seq: 7, tai_lieu: [{ fileName: "a.pdf", url: "u" }], dong_so_huu_ids: [uid(5)] }] : []),
    fn_nv_app_lich_ky_xoa: () => ({ ok: true }),
    fn_nv_app_lich_ky_tim_coc: () => [{ id: uid(3), pgc_id: uid(4) }],
  });
  const rows = await h.svc.list({ isPersonal: true, state: "pending", search: "  a ", projectId: uid(9) });
  assert.equal(rows.length, 1);
  assert.deepEqual(plain(h.calls[0].body), { p_project_id: uid(9), p_search: "a", p_state: "PENDING", p_is_personal: true, p_page: 1, p_size: 500 });

  const byUuid = await h.svc.get(uid(1));
  assert.deepEqual(plain(h.calls[1].body), { p_id: uid(1), p_seq: null });
  assert.equal(byUuid.TaiLieu.length, 1);
  assert.deepEqual(byUuid.DongSoHuuIds, [uid(5)]);
  assert.equal(byUuid.raw.seq, 7, "giữ dòng gốc để form web nạp lại");
  await h.svc.get("7");
  assert.deepEqual(plain(h.calls[2].body), { p_id: null, p_seq: 7 });
  await assert.rejects(h.svc.get("8"), /Không tìm thấy/);

  await h.svc.remove(["12"]);
  assert.deepEqual(plain(h.calls.find((c) => c.fn === "fn_nv_app_lich_ky_xoa").body), { p_ids: [12] });

  await h.svc.searchDeposits(" BK ", "x");
  assert.deepEqual(plain(h.calls.at(-1).body), { p_search: "BK", p_project_id: null, p_id: null, p_limit: 30 });
});

test("plans: danh mục tự cấu hình phuong_an_tt_ky (đang áp dụng, theo thứ tự) trước, không có thì phuong_an_tt", async () => {
  const custom = harness({
    fn_nv_app_danh_muc_ma: (b) =>
      b.p_loai === "phuong_an_tt_ky"
        ? [
            { item_code: "B", item_name: "Sau", raw: { order: 2 } },
            { item_code: "A", item_name: "Trước", raw: { order: 1 } },
            { item_code: "C", item_name: "Tắt", ap_dung: false },
          ]
        : [],
  });
  assert.deepEqual(plain(await custom.svc.plans()), [
    { value: "A", label: "Trước" },
    { value: "B", label: "Sau" },
  ]);
  const fallback = harness({ fn_nv_app_danh_muc_ma: (b) => (b.p_loai === "phuong_an_tt" ? [{ raw: { MaPATT: 3, TenPATT: "Vay" } }] : []) });
  assert.deepEqual(plain(await fallback.svc.plans()), [{ value: "3", label: "Vay" }]);
  const broken = harness({});
  assert.deepEqual(plain(await broken.svc.plans()), []);
});

test("customersByIds giữ thứ tự id, bỏ id lạ", async () => {
  const h = harness({ fn_nv_app_khach_hang_theo_id: () => [{ id: uid(2), ten_kh: "B" }, { id: uid(1).toUpperCase(), ten_kh: "A" }] });
  const out = await h.svc.customersByIds([uid(1), "rác", uid(2), uid(3)]);
  assert.deepEqual(out.map((c) => c.ten_kh), ["A", "B"]);
});

test("shim: form web gọi fn_signing_* ⇒ endpoint app, bỏ tham số công ty của web", async () => {
  const h = harness({
    fn_nv_app_lich_ky_tuy_chon: () => ({ diem: [] }),
    fn_nv_app_lich_ky_cho_trong: () => [],
    fn_nv_app_lich_ky_ca: () => [],
    fn_nv_app_lich_ky_luu: () => ({ id: uid(1) }),
    fn_nv_app_lich_ky_tim_hd: () => [],
  });
  const { supabase } = h.shim;
  await supabase.rpc("fn_signing_book_options", { p_ma_ctdk: "brg", p_ma_pgc: uid(4), p_quy_id: uid(5), p_thu_tuc: null, p_ngay: "2026-11-20" });
  assert.deepEqual(plain(h.calls.at(-1)), {
    fn: "fn_nv_app_lich_ky_tuy_chon",
    body: { p_ma_pgc: uid(4), p_quy_id: uid(5), p_thu_tuc: null, p_ngay: "2026-11-20" },
  });
  await supabase.rpc("fn_signing_availability", { p_ma_pgc: uid(4), p_quy_id: uid(5), p_thu_tuc: "KY_HD", p_config_id: uid(6), p_tu_ngay: "2026-11-17", p_so_ngay: 14 });
  assert.equal(h.calls.at(-1).fn, "fn_nv_app_lich_ky_cho_trong");
  assert.equal(h.calls.at(-1).body.p_so_ngay, 14);
  await supabase.rpc("fn_signing_shift_slots", { p_ngay: "2026-11-20", p_ma_pgc: uid(4), p_loai_thu_tuc_id: uid(7), p_ma_ctdk: "brg" });
  assert.deepEqual(plain(h.calls.at(-1).body), { p_ngay: "2026-11-20", p_ma_pgc: uid(4), p_loai_thu_tuc_id: uid(7) });
  const saved = await supabase.rpc("fn_signing_appointment_upsert", { p_payload: { x: 1 }, p_actor: "web" });
  assert.deepEqual(plain(h.calls.at(-1).body), { p_payload: { x: 1 } });
  assert.equal(saved.error, null);
  await supabase.rpc("fn_signing_contract_search", { p_search: "HD", p_project_id: null, p_limit: 20 });
  assert.equal(h.calls.at(-1).fn, "fn_nv_app_lich_ky_tim_hd");

  // Đổi trạng thái (duyệt / từ chối) chỉ trên web ⇒ app không có endpoint, trả lỗi để module web báo
  const n = h.calls.length;
  const refused = await supabase.rpc("fn_signing_appointment_set_state", { p_ids: [1], p_state: "APPROVED" });
  assert.equal(refused.error.code, "APP_UNSUPPORTED");
  assert.equal(h.calls.length, n, "không gọi máy chủ");
});
