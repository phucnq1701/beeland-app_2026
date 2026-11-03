const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const n = loadTs("lib/notifications.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("notificationOrFilter: global + company code (lowercase) + own account, like the web bell", () => {
  assert.equal(n.notificationOrFilter("MSR", "NV01"), "(is_global.eq.true,ma_ctdk.eq.msr,account_id.eq.NV01)");
  assert.equal(n.notificationOrFilter(" msr ", ""), "(is_global.eq.true,ma_ctdk.eq.msr)");
  assert.equal(n.notificationOrFilter("", "NV01"), null);
});

test("visibleNotifications keeps only rows for this account / company / global and maps fields", () => {
  const rows = [
    { id: "a", title: "Riêng tôi", message: "m1", created_at: "2026-11-03T08:00:00Z", is_read: false, account_id: "NV01", ma_ctdk: "msr", type: "booking", related_id: "r1" },
    { id: "b", title: "Người khác", message: "m2", created_at: "2026-11-03T07:00:00Z", is_read: false, account_id: "NV02", ma_ctdk: "msr" },
    { id: "c", title: "", message: "m3", created_at: "2026-11-03T06:00:00Z", is_read: true, ma_ctdk: "MSR" },
    { id: "d", title: "Công ty khác", message: "m4", created_at: "2026-11-03T05:00:00Z", is_read: false, ma_ctdk: "abc" },
    { id: "e", title: "Toàn hệ thống", message: null, created_at: "2026-11-03T04:00:00Z", is_read: null, is_global: true },
    { id: "f", title: "Không gắn gì", message: "m6", created_at: "2026-11-03T03:00:00Z", is_read: false },
  ];
  const out = plain(n.visibleNotifications(rows, "msr", "NV01"));
  assert.deepEqual(out.map((x) => x.id), ["a", "c", "e"]);
  assert.deepEqual(out[0], {
    id: "a", title: "Riêng tôi", message: "m1", createdAt: "2026-11-03T08:00:00Z", isRead: false, type: "booking", relatedId: "r1",
  });
  assert.equal(out[1].title, "Thông báo");
  assert.equal(out[1].isRead, true);
  assert.equal(out[2].message, "");
  assert.equal(out[2].isRead, false);
  // Chưa có mã nhân viên → thông báo gắn tài khoản bị ẩn
  assert.deepEqual(plain(n.visibleNotifications(rows, "msr", "")).map((x) => x.id), ["c", "e"]);
});

test("relativeTime formats like a feed", () => {
  const now = new Date("2026-11-03T10:00:00Z");
  assert.equal(n.relativeTime("2026-11-03T09:59:30Z", now), "Vừa xong");
  assert.equal(n.relativeTime("2026-11-03T09:15:00Z", now), "45 phút trước");
  assert.equal(n.relativeTime("2026-11-03T05:00:00Z", now), "5 giờ trước");
  assert.equal(n.relativeTime("2026-11-02T08:00:00Z", now), "Hôm qua");
  assert.equal(n.relativeTime("2026-10-30T08:00:00Z", now), "4 ngày trước");
  assert.equal(n.relativeTime("2026-10-01T08:00:00Z", now), "01/10/2026");
  assert.equal(n.relativeTime("", now), "");
});
