// Phân quyền như web: luật menu (getMenuPermission của web) + tính năng theo màn (fn_nv_app_quyen_man) + cổng menu ở featureConfig.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const p = loadTs("lib/permissions.ts");
const f = loadTs("lib/featureConfig.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const gate = (menu, menuCongTy, fullAccess = false) => p.menuFormGate({ menu, menuCongTy, fullAccess });

test("menu: chưa có dữ liệu (phiên cũ / 2 danh sách rỗng) ⇒ cho hết như web", () => {
  assert.equal(gate(undefined, undefined)("/sales/bookings"), true);
  assert.equal(gate(null, null)("/sales/bookings"), true);
  assert.equal(gate([], [])("/x"), true);
  assert.equal(gate(["/a"], [], true)("/x"), true, "toàn quyền + công ty chưa cấp ⇒ cho hết");
});

test("menu: giao quyền người dùng × quyền công ty; chỉ 1 danh sách ⇒ danh sách đó; toàn quyền ⇒ form công ty", () => {
  const g = gate(["/sales/bookings", "/customers/list"], ["/sales/bookings", "/sales/deposits"]);
  assert.equal(g("/sales/bookings"), true);
  assert.equal(g("/customers/list"), false, "công ty không đăng ký");
  assert.equal(g("/sales/deposits"), false, "nhóm không cấp");
  assert.equal(gate(["/a"], [])("/a"), true);
  assert.equal(gate(["/a"], [])("/b"), false);
  assert.equal(gate([], ["/b"])("/b"), true);
  const full = gate(["/a"], ["/b", "/c"], true);
  assert.equal(full("/b"), true);
  assert.equal(full("/a"), false);
});

test("module: hiện khi ít nhất 1 màn web tương ứng được mở; module chưa gắn màn ⇒ hiện", () => {
  const onlyLow = gate(["/products/low-rise"], []);
  assert.equal(p.moduleAllowed("2", onlyLow), true, "Sản phẩm: cao HOẶC thấp tầng");
  assert.equal(p.moduleAllowed("5", onlyLow), false);
  assert.equal(p.moduleAllowed("16", gate(["/sales/bookings"], [])), true, "Tin nhắn luôn hiện như nút chat của web");
  assert.equal(p.moduleAllowed("999", onlyLow), true);
  assert.ok(p.APP_FORMS.includes("/sales/signing-appointments"));
  assert.equal(new Set(p.APP_FORMS).size, p.APP_FORMS.length);
});

test("tính năng: đúng mã của màn, không phân biệt hoa thường; thiếu màn / lỗi ⇒ không có", () => {
  const data = { "/customers/list": ["VIEW", "ADD"], "/sales/deposits": ["signing"] };
  assert.equal(p.hasFeature(data, "/customers/list", "add"), true);
  assert.equal(p.hasFeature(data, "/customers/list", "EDIT"), false);
  assert.equal(p.hasFeature(data, "/sales/deposits", "SIGNING"), true);
  assert.equal(p.hasFeature(data, "/sales/locks", "BOOKING"), false);
  assert.equal(p.hasFeature(null, "/customers/list", "ADD"), false);
});

test("featureConfig: cổng menu áp cho nội bộ, đại lý giữ danh sách cố định", () => {
  const all = ["1", "2", "4", "5", "6", "8", "9", "13", "14", "15", "16", "17"];
  const eligible = all;
  const g = gate(["/sales/bookings", "/customers/list", "/products/high-rise"], []);
  f.setMenuGate((id) => p.moduleAllowed(id, g));
  try {
    assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: false, menuOnly: false, menuEligible: eligible })), ["2", "5", "6", "16"]);
    assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: true, menuOnly: false, menuEligible: eligible })), ["1", "2", "5", "13", "14", "16"]);
    assert.equal(f.isFeatureAllowed("8", false), false);
    assert.equal(f.isFeatureAllowed("8", false, null), true, "không có cổng ⇒ không lọc");
  } finally {
    f.setMenuGate(null);
  }
  assert.equal(f.isFeatureAllowed("8", false), true);
});
