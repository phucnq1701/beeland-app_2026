const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const n = loadTs("lib/notifications.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("mapHopThu: dòng hộp thư fn_tb_nb_hop_thu_list ⇒ thông báo app", () => {
  const out = plain(n.mapHopThu([
    { id: "a", tieu_de: "Phiếu thu PT-1: duyệt", noi_dung: "x", form_code: 815, ban_ghi_id: "r1", da_doc: false, created_at: "2026-11-16T08:00:00Z", ma_thao_tac: "08-02" },
    { id: "b", tieu_de: "", noi_dung: null, form_code: null, ban_ghi_id: null, da_doc: true, created_at: "2026-11-16T07:00:00Z" },
    { tieu_de: "không id" },
  ]));
  assert.deepEqual(out[0], {
    id: "a", title: "Phiếu thu PT-1: duyệt", message: "x", createdAt: "2026-11-16T08:00:00Z", isRead: false, formCode: 815, relatedId: "r1", action: "08-02",
  });
  assert.equal(out[1].title, "Thông báo");
  assert.equal(out[1].message, "");
  assert.equal(out[1].isRead, true);
  assert.equal(out[1].formCode, null);
  assert.equal(out.length, 2);
  assert.deepEqual(plain(n.mapHopThu(null)), []);
});

test("notificationRoute: chỉ màn app có và tải được theo id; còn lại không mở", () => {
  assert.deepEqual(plain(n.notificationRoute({ formCode: 9002, relatedId: "u1" })), { pathname: "/signing/[id]", params: { id: "u1" } });
  assert.deepEqual(plain(n.notificationRoute({ formCode: 832, relatedId: "r1" })), { pathname: "/request/[id]", params: { id: "r1" } });
  assert.equal(n.notificationRoute({ formCode: 27, relatedId: "b1" }), null, "booking: thông báo mang id phiếu giữ chỗ");
  assert.deepEqual(plain(n.notificationRoute({ formCode: 815, relatedId: "p1" })), { pathname: "/reports/receipt/[id]", params: { id: "p1" } }, "phiếu thu ⇒ chi tiết phiếu thu (fn_nv_app_phieu_thu_chi_tiet)");
  assert.equal(n.notificationRoute({ formCode: 803, relatedId: "g1" }), null, "giỏ hàng: app không có màn");
  assert.equal(n.notificationRoute({ formCode: 28, relatedId: "d1" }), null, "đặt cọc: màn app cần dòng danh sách");
  assert.equal(n.notificationRoute({ formCode: 815, relatedId: null }), null);
  assert.equal(n.notificationRoute({ formCode: null, relatedId: "x" }), null);
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
