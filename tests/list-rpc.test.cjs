const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const l = loadTs("lib/listRpc.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("listResult: bản mới { rows, total } của fn_booking_list / fn_deposit_list / fn_signing_appointment_list", () => {
  assert.deepEqual(plain(l.listResult({ rows: [{ id: 1 }], total: 93 })), { rows: [{ id: 1 }], total: 93 });
  assert.deepEqual(plain(l.listResult({ rows: [], total_count: 4 })), { rows: [], total: 4 });
  assert.deepEqual(plain(l.listResult([{ id: 1, total_count: 7 }])), { rows: [{ id: 1, total_count: 7 }], total: 7 });
  assert.deepEqual(plain(l.listResult(null)), { rows: [], total: 0 });
});

test("pageArgs: trang/kích thước hợp lệ", () => {
  assert.deepEqual(plain(l.pageArgs(2, 20)), { p_page: 2, p_size: 20 });
  assert.deepEqual(plain(l.pageArgs(0, -5)), { p_page: 1, p_size: 1 });
  assert.deepEqual(plain(l.pageArgs(undefined, undefined)), { p_page: 1, p_size: 50 });
});

const d = (id, day) => ({ id, ngay: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z` });
const dateOf = (r) => r.ngay;

test("mergeProjectPages: gộp nhiều dự án, mới nhất trước, cắt đúng trang, tổng = cộng các dự án", () => {
  const a = { rows: [d("a1", 15), d("a2", 10), d("a3", 5)], total: 3 };
  const b = { rows: [d("b1", 14), d("b2", 12)], total: 2 };
  const p1 = plain(l.mergeProjectPages([a, b], 1, 2, dateOf));
  assert.deepEqual(p1.rows.map((r) => r.id), ["a1", "b1"]);
  assert.equal(p1.total, 5);
  const p2 = plain(l.mergeProjectPages([a, b], 2, 2, dateOf));
  assert.deepEqual(p2.rows.map((r) => r.id), ["b2", "a2"]);
  const p3 = plain(l.mergeProjectPages([a, b], 3, 2, dateOf));
  assert.deepEqual(p3.rows.map((r) => r.id), ["a3"]);
});

test("mergeProjectPages: dòng thiếu ngày xếp cuối, bỏ trùng id", () => {
  const a = { rows: [{ id: "x", ngay: null }, d("y", 1)], total: 2 };
  const b = { rows: [d("y", 1)], total: 1 };
  const r = plain(l.mergeProjectPages([a, b], 1, 10, dateOf));
  assert.deepEqual(r.rows.map((x) => x.id), ["y", "x"]);
});
