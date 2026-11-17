const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const b = loadTs("lib/bookingState.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("bookingStateGroup: chỉ 3 nhóm – chờ duyệt / đã duyệt / huỷ booking", () => {
  assert.equal(b.bookingStateGroup("PENDING"), "PENDING");
  assert.equal(b.bookingStateGroup(null), "PENDING", "phiếu chưa có dòng booking = chờ duyệt (như fn_booking_list)");
  assert.equal(b.bookingStateGroup(""), "PENDING");
  assert.equal(b.bookingStateGroup("approved"), "APPROVED");
  for (const s of ["EXPIRED", "CANCELLED", "REJECTED", "WAITING_REFUND", "REFUNDED", "RELEASED", "LẠ"]) {
    assert.equal(b.bookingStateGroup(s), "CANCELLED", s);
  }
});

test("bookingStateBadge: nhãn + màu cố định như web (chờ duyệt cam, đã duyệt xanh, huỷ xám)", () => {
  assert.deepEqual(plain(b.bookingStateBadge("PENDING")), { label: "Chờ duyệt", tone: "warning" });
  assert.deepEqual(plain(b.bookingStateBadge("APPROVED")), { label: "Đã duyệt", tone: "success" });
  assert.deepEqual(plain(b.bookingStateBadge("EXPIRED")), { label: "Huỷ booking", tone: "neutral" });
});

test("BOOKING_TABS: Tất cả + 3 nhóm, p_states gửi máy chủ", () => {
  assert.deepEqual(plain(b.BOOKING_TABS.map((t) => [t.key, t.label])), [
    ["ALL", "Tất cả"], ["PENDING", "Chờ duyệt"], ["APPROVED", "Đã duyệt"], ["CANCELLED", "Huỷ booking"],
  ]);
  assert.equal(b.statesForTab("ALL"), null);
  assert.deepEqual(plain(b.statesForTab("PENDING")), ["PENDING"]);
  assert.deepEqual(plain(b.statesForTab("APPROVED")), ["APPROVED"]);
  const c = plain(b.statesForTab("CANCELLED"));
  for (const s of ["EXPIRED", "CANCELLED", "REJECTED", "WAITING_REFUND"]) assert.ok(c.includes(s), s);
  assert.equal(b.statesForTab("XYZ"), null);
});
