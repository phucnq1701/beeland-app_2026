// Phiếu tính giá trên bộ API riêng app (services/PriceSheetService.ts ⇒ fn_nv_app_*): đúng endpoint, không gửi công ty,
// quyền fail-closed, không còn duyệt trên app.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const deq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function load(handler) {
  const calls = [];
  const svc = loadTs("services/PriceSheetService.ts", { modules: {
    "@/lib/bookingPrice": loadTs("lib/bookingPrice.ts"),
    "@/services/nvApi": {
      callNv: async (fn, args) => { calls.push({ fn, args }); return handler(fn, args); },
      errorMessage: (e, f) => e?.message || f,
    },
  } }).PriceSheetService;
  return { svc, calls };
}

test("danh sách / chi tiết / xoá / phiên bản ⇒ fn_nv_app_ptg_*", async () => {
  const { svc, calls } = load((fn) => (fn === "fn_nv_app_ptg_list" ? { rows: [{ id: uid(1) }], total: 1, stats: { draft: 1 } } : fn.endsWith("phien_ban") ? [{ id: 1 }] : { id: uid(1) }));
  const r = await svc.list({ projectId: uid(4), keyword: " A ", status: "all", page: 2, pageSize: 10 });
  assert.equal(r.total, 1);
  deq(r.stats, { draft: 1, sent: 0, approved: 0, rejected: 0 });
  deq(calls[0], { fn: "fn_nv_app_ptg_list", args: { p: { project_id: uid(4), keyword: "A", status: null, product_type: null, deleted: false, page_index: 2, page_size: 10 } } });
  await svc.get(uid(1));
  await svc.remove([uid(1)]);
  await svc.versions(uid(1));
  deq(calls.slice(1).map((c) => c.fn), ["fn_nv_app_ptg_chi_tiet", "fn_nv_app_ptg_xoa", "fn_nv_app_ptg_phien_ban"]);
  assert.equal(svc.setStatus, undefined, "duyệt phiếu làm trên web");
});

test("lỗi máy chủ ⇒ Error mang thông điệp máy chủ; lập / sửa không còn ở service (form web chép, lib/web)", async () => {
  const { svc } = load(() => { throw new Error("Phiếu đang trong quy trình phê duyệt — thu hồi trước khi xoá"); });
  await assert.rejects(svc.remove([uid(1)]), /quy trình phê duyệt/);
  for (const k of ["save", "getSalesConfig", "getPriceListItem", "getProduct", "getPolicy", "getSchedule"]) assert.equal(svc[k], undefined, k);
});

test("quyền: 1 lần gọi cho mọi chức năng; lỗi ⇒ không có quyền (fail-closed như web)", async () => {
  const { svc, calls } = load(() => ({ ADD: true, EDIT: false, DELETE: true, APPROVE: true }));
  deq(await svc.perms(), { ADD: true, EDIT: false, DELETE: true, APPROVE: true });
  deq(calls[0], { fn: "fn_nv_app_quyen", args: { p_form: "/products/price-sheet", p_chuc_nang: ["ADD", "EDIT", "DELETE", "APPROVE"] } });
  const bad = load(() => { throw new Error("Network"); });
  deq(await bad.svc.perms(), { ADD: false, EDIT: false, DELETE: false, APPROVE: false });
  assert.equal(await bad.svc.hasPerm("ADD"), false);
});
