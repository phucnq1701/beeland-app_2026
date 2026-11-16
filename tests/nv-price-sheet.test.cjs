// Phiếu tính giá trên bộ API riêng app (sevicesSupabase/PriceSheetService.ts ⇒ fn_nv_app_*): đúng endpoint, không gửi công ty,
// quyền fail-closed, không còn duyệt trên app.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const deq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function load(handler) {
  const calls = [];
  const svc = loadTs("sevicesSupabase/PriceSheetService.ts", { modules: {
    "@/lib/bookingPrice": loadTs("lib/bookingPrice.ts"),
    "@/lib/priceSheetPayload": { mapProductRow: (r) => ({ mapped: r.id }) },
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

test("lỗi máy chủ ⇒ Error mang thông điệp máy chủ", async () => {
  const { svc } = load(() => { throw new Error("Phiếu đang trong quy trình phê duyệt — thu hồi trước khi sửa"); });
  await assert.rejects(svc.save({ id: uid(1) }), /quy trình phê duyệt/);
});

test("quyền: 1 lần gọi cho mọi chức năng; lỗi ⇒ không có quyền (fail-closed như web)", async () => {
  const { svc, calls } = load(() => ({ ADD: true, EDIT: false, DELETE: true, APPROVE: true }));
  deq(await svc.perms(), { ADD: true, EDIT: false, DELETE: true, APPROVE: true });
  deq(calls[0], { fn: "fn_nv_app_quyen", args: { p_form: "/products/price-sheet", p_chuc_nang: ["ADD", "EDIT", "DELETE", "APPROVE"] } });
  const bad = load(() => { throw new Error("Network"); });
  deq(await bad.svc.perms(), { ADD: false, EDIT: false, DELETE: false, APPROVE: false });
  assert.equal(await bad.svc.hasPerm("ADD"), false);
});

test("cấu hình bán hàng: 5 endpoint, không gửi mã công ty; lỗi 1 nguồn ⇒ nguồn đó rỗng", async () => {
  const { svc, calls } = load((fn) => {
    if (fn === "fn_nv_app_khuyen_mai_list") throw new Error("x");
    if (fn === "fn_nv_app_bang_gia_hien_hanh") return [{ id: "b", priority: 2 }, { id: "a", priority: 1 }];
    if (fn === "fn_nv_app_chinh_sach_list") return [{ id: "p1", ten_cs: "CS1", pricing_config_id: "c1", payment_schedule_id: "s1" }];
    if (fn === "fn_nv_app_lich_tt_list") return [{ id: "s1", name: "TĐ1" }];
    if (fn === "fn_nv_app_cau_hinh_tinh_gia_list") return [{ id: "c1", ten: "CH", status: true, detail: [{ Code: "X" }] }];
    return [];
  });
  const cfg = await svc.getSalesConfig(uid(4), false);
  deq(cfg.priceLists.map((x) => x.id), ["a", "b"]);
  deq(cfg.policies, [{ id: "p1", name: "CS1", pricingConfigId: "c1", scheduleId: "s1" }]);
  deq(cfg.schedules, [{ id: "s1", name: "TĐ1" }]);
  deq(cfg.promotions, []);
  deq(cfg.policyConfigs, [{ ID: "c1", Name: "CH", Status: true, Detail: [{ Code: "X" }] }]);
  const byFn = Object.fromEntries(calls.map((c) => [c.fn, c.args]));
  deq(byFn.fn_nv_app_bang_gia_hien_hanh, { p_du_an_id: uid(4), p_loai: "Chung cư" });
  deq(byFn.fn_nv_app_chinh_sach_list, { p_du_an_id: uid(4), p_form_code: "CAOTANG" });
  deq(byFn.fn_nv_app_lich_tt_list, { p_du_an_id: uid(4), p_form_code: "CAOTANG" });
  deq(byFn.fn_nv_app_cau_hinh_tinh_gia_list, { p_du_an_id: uid(4), p_form_codes: ["CSCAOTANG"] });
  for (const c of calls) assert.equal(JSON.stringify(c.args).includes("ma_ctdk"), false, `${c.fn} không gửi công ty`);
});

test("giá trong bảng giá: 1 lời gọi (máy chủ tự khớp mã căn cho bảng giá cũ); căn + đợt CK + chính sách + lịch TT", async () => {
  const { svc, calls } = load((fn) => {
    if (fn === "fn_nv_app_gia_trong_bang_gia") return { id: "i1", unit_price: 5 };
    if (fn === "fn_nv_app_san_pham_tinh_gia") return { id: uid(3) };
    if (fn === "fn_nv_app_cau_hinh_tinh_gia_dot") return [{ id: "r1", ten: "Đợt 1", details: [{ HeSo: 1 }] }];
    if (fn === "fn_nv_app_chinh_sach_chi_tiet") return [{ id: "p1", ten_cs: "CS", detail: [] }];
    if (fn === "fn_nv_app_lich_tt_chi_tiet") return [{ id: "s1", name: "TĐ", form_code: "CAOTANG", details: [{ TyLeTT: 30 }] }];
    return null;
  });
  deq(await svc.getPriceListItem(uid(7), { ID: uid(3), MaSP: "SP1" }), { id: "i1", unit_price: 5 });
  deq(calls[0].args, { p_bang_gia_id: uid(7), p_san_pham_id: uid(3), p_ma_sp: "SP1" });
  deq(await svc.getProduct(uid(3)), { mapped: uid(3) });
  deq(await svc.getConfigRounds(uid(8)), [{ ID: "r1", Name: "Đợt 1", Details: [{ HeSo: 1 }] }]);
  assert.equal((await svc.getPolicy(uid(9))).name, "CS");
  assert.equal((await svc.getSchedule(uid(10))).details[0].TyLeTT, 30);
});
