const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const d = loadTs("lib/depositQr.ts");

test("statusCodeNum strips non-digits like fn_deposit_list", () => {
  assert.equal(d.statusCodeNum("8"), 8);
  assert.equal(d.statusCodeNum(8), 8);
  assert.equal(d.statusCodeNum("TT08"), 8);
  assert.equal(d.statusCodeNum(null), null);
  assert.equal(d.statusCodeNum("abc"), null);
});

test("pending deposit: catalog names, legacy names or code 8 (web isApprovableMaTT)", () => {
  assert.equal(d.isPendingDeposit({ TenTT: "Đặt cọc chờ duyệt" }), true);
  assert.equal(d.isPendingDeposit({ TenTT: "ĐC chờ duyệt" }), true);
  assert.equal(d.isPendingDeposit({ TenTT: "Chờ duyệt" }), true);
  assert.equal(d.isPendingDeposit({ TenTT: "Chờ xử lý" }), true);
  assert.equal(d.isPendingDeposit({ TenTT: "", MaTT: null }), true);
  assert.equal(d.isPendingDeposit({ TenTT: "Khác", MaTT: "8" }), true);
  assert.equal(d.isPendingDeposit({ TenTT: "Đặt cọc đã duyệt", MaTT: 13 }), false);
  assert.equal(d.isPendingDeposit({ TenTT: "ĐC đã duyệt" }), false);
  // tên đã duyệt thắng mã 8 lệch
  assert.equal(d.isPendingDeposit({ TenTT: "Đặt cọc đã duyệt", MaTT: 8 }), false);
  assert.equal(d.isPendingDeposit({ TenTT: "HĐMB chờ duyệt", MaTT: 10 }), false);
});

test("QR amount = max(0, TienCoc - DaThu)", () => {
  assert.equal(d.depositQrAmount({ TienCoc: 100_000_000, DaThu: 30_000_000 }), 70_000_000);
  assert.equal(d.depositQrAmount({ TienCoc: 100, DaThu: 150 }), 0);
  assert.equal(d.depositQrAmount({ TienCoc: null, DaThu: null }), 0);
  assert.equal(d.depositQrAmount({ TienCoc: "1000.4", DaThu: 0 }), 1000);
});

test("canCreateDepositQr: pending and still owes deposit", () => {
  assert.equal(d.canCreateDepositQr({ TenTT: "Đặt cọc chờ duyệt", TienCoc: 100, DaThu: 0 }), true);
  assert.equal(d.canCreateDepositQr({ TenTT: "Đặt cọc chờ duyệt", TienCoc: 100, DaThu: 100 }), false);
  assert.equal(d.canCreateDepositQr({ TenTT: "Đặt cọc đã duyệt", TienCoc: 100, DaThu: 0 }), false);
});
