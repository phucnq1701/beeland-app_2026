const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const p = loadTs("lib/bookingProgress.ts");
// Object tạo trong vm context khác → so qua JSON.
const plain = (v) => JSON.parse(JSON.stringify(v));

const NOW = Date.UTC(2026, 8, 30, 3, 0, 0);
const future = new Date(NOW + 600000).toISOString();
const past = new Date(NOW - 1000).toISOString();

test("fresh booking holds a slot", () => {
  assert.deepEqual(
    plain(p.getBookingProgress({ giaiDoan: "GIUCHO", daThu: 0, tienGiuCho: 50000000, state: "PENDING", hetHanLuc: future }, NOW)),
    { current: 0, paid: false, cancelled: false, expired: false }
  );
});

test("paid when daThu reaches tienGiuCho (strings accepted)", () => {
  assert.equal(p.getBookingProgress({ daThu: "50000000", tienGiuCho: 50000000, hetHanLuc: past }, NOW).current, 1);
});

test("zero or missing tienGiuCho never counts as paid", () => {
  assert.equal(p.getBookingProgress({ daThu: 0, tienGiuCho: 0 }, NOW).paid, false);
  assert.equal(p.getBookingProgress({}, NOW).paid, false);
});

test("deposit and contract stages", () => {
  assert.deepEqual(plain(p.getBookingProgress({ giaiDoan: "DATCOC" }, NOW)), {
    current: 2, paid: true, cancelled: false, expired: false,
  });
  assert.equal(p.getBookingProgress({ giaiDoan: "HDMB" }, NOW).current, 3);
});

test("expiry only applies to unpaid holds with a valid deadline", () => {
  assert.equal(p.getBookingProgress({ giaiDoan: "GIUCHO", hetHanLuc: past, tienGiuCho: 1 }, NOW).expired, true);
  assert.equal(p.getBookingProgress({ daThu: 1, tienGiuCho: 1, hetHanLuc: past }, NOW).expired, false);
  assert.equal(p.getBookingProgress({ hetHanLuc: null }, NOW).expired, false);
  assert.equal(p.getBookingProgress({ hetHanLuc: "garbage" }, NOW).expired, false);
});

test("cancelled", () => {
  const r = p.getBookingProgress({ state: "CANCELLED", hetHanLuc: past }, NOW);
  assert.equal(r.cancelled, true);
  assert.equal(r.expired, false);
});

test("steps copy", () => {
  assert.deepEqual(plain(p.BOOKING_STEPS), ["Giữ chỗ", "Đã thu tiền", "Đặt cọc", "Hợp đồng"]);
});
