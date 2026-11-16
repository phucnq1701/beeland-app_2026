// Cổng thanh toán (QR VA) qua bộ API riêng app: 1 endpoint fn_nv_app_cong_thanh_toan, đúng p_action + tham số như web,
// không gửi token phiên / công ty; lỗi máy chủ ⇒ ném (không nuốt).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const deq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

function load(handler) {
  const calls = [];
  const mod = loadTs("sevicesSupabase/PaymentGatewayService.ts", { modules: {
    "@/services/nvApi": { callNv: async (fn, args, opt) => { calls.push({ fn, args, opt }); return handler(args); } },
  } });
  return { svc: mod.PaymentGatewayService, mod, calls };
}

test("5 thao tác ⇒ fn_nv_app_cong_thanh_toan với p_action, tham số giữ nguyên như web", async () => {
  const { svc, calls } = load((a) => (a.p_action === "list" ? { accounts: [{ id: "v1" }], logs: [] } : { ok: 1 }));
  await svc.getAccounts("P1");
  await svc.create({ project_id: "P1", ma_tk: 3, module: "BOOKING", expires_at: null, items: [{ pgc_id: "G1", ten_kh: "A", amount: 5 }] });
  await svc.remove("V1");
  await svc.expireSweep("G1");
  const l = await svc.listByContract("G1");
  deq(l.accounts, [{ id: "v1" }]);
  for (const c of calls) {
    assert.equal(c.fn, "fn_nv_app_cong_thanh_toan");
    assert.equal(JSON.stringify(c.args).match(/token|ma_ctdk|company/), null, "không gửi token / công ty");
  }
  deq(calls.map((c) => c.args), [
    { p_action: "accounts", project_id: "P1" },
    { p_action: "create", project_id: "P1", ma_tk: 3, module: "BOOKING", expires_at: null, items: [{ pgc_id: "G1", ten_kh: "A", amount: 5 }] },
    { p_action: "delete", id: "V1" },
    { p_action: "expire_sweep", pgc_id: "G1" },
    { p_action: "list", pgc_id: "G1" },
  ]);
});

test("lỗi máy chủ (vd dự án chưa cấu hình) ⇒ ném nguyên thông điệp", async () => {
  const { svc } = load(() => { throw new Error("Dự án chưa cấu hình ClientId/ClientSecret thanh toán (Dự án > Quản lý dự án)"); });
  await assert.rejects(svc.getAccounts("P1"), /chưa cấu hình ClientId/);
});

test("ảnh VietQR như web", () => {
  const { mod } = load(() => null);
  assert.equal(mod.vietQrUrl({ bank_code: "BIDV", account_number: "9620", amount: 1000.4, dien_giai: "BK 1", account_name: "NGUYEN A" }),
    "https://img.vietqr.io/image/BIDV-9620-compact2.png?amount=1000&addInfo=BK%201&accountName=NGUYEN%20A");
});
