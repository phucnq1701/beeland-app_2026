const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const p = loadTs("lib/reportPeriod.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));
// Thứ Tư 01/10/2026
const today = new Date(2026, 9, 1, 15, 30);

test("period ranges are calendar ranges in local time", () => {
  assert.deepEqual(plain(p.periodRange("today", today)), { from: "2026-10-01", to: "2026-10-01" });
  assert.deepEqual(plain(p.periodRange("week", today)), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(plain(p.periodRange("month", today)), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(plain(p.periodRange("year", today)), { from: "2026-01-01", to: "2026-12-31" });
  // Chủ nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó
  assert.deepEqual(plain(p.periodRange("week", new Date(2026, 9, 4))), { from: "2026-09-28", to: "2026-10-04" });
});

test("custom range keeps from ≤ to and defaults to today", () => {
  assert.deepEqual(plain(p.periodRange("custom", today, { from: "2026-09-10", to: "2026-09-20" })), { from: "2026-09-10", to: "2026-09-20" });
  assert.deepEqual(plain(p.periodRange("custom", today, { from: "2026-09-20", to: "2026-09-10" })), { from: "2026-09-10", to: "2026-09-20" });
  assert.deepEqual(plain(p.periodRange("custom", today, {})), { from: "2026-10-01", to: "2026-10-01" });
  assert.equal(p.PERIOD_LABEL.week, "Tuần này");
  assert.equal(p.toYmd(new Date(2026, 0, 5)), "2026-01-05");
});
