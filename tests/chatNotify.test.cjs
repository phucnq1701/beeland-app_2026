// Thông báo tin nhắn (lib/chatNotify.ts): banner từ realtime / push, khử trùng. Chạy: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const n = loadTs("lib/chatNotify.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const ev = (m = {}, c = {}, extra = {}) => ({
  message: {
    id: "m1",
    conversation_id: "c1",
    sender_type: "employee",
    sender: { id: "e2", ten: "Lan", anh: null, loai: "employee" },
    loai: "text",
    noi_dung: "Chào  anh\nnhé",
    mentions: [],
    recalled_at: null,
    attachments: [],
    ...m,
  },
  conversation: { id: "c1", loai: "direct", ten: null, ...c },
  muted: false,
  ...extra,
});

test("previewText: chữ gộp khoảng trắng, ảnh, tệp, rỗng, cắt 180", () => {
  assert.equal(n.previewText({ loai: "text", noi_dung: " a \n\n b " }), "a b");
  assert.equal(n.previewText({ loai: "image", attachments: [{ ten_tep: "x.jpg" }] }), "Đã gửi ảnh");
  assert.equal(n.previewText({ loai: "file", attachments: [{ ten_tep: "HĐ.pdf" }] }), "Đã gửi tệp: HĐ.pdf");
  assert.equal(n.previewText({ loai: "file", attachments: [] }), "Đã gửi tệp");
  assert.equal(n.previewText({ loai: "text", noi_dung: "  " }), "Tin nhắn mới");
  assert.equal(n.previewText({ loai: "text", noi_dung: "x".repeat(300) }).length, 180);
});

test("bannerFromEvent: 1-1 → tiêu đề là người gửi", () => {
  assert.deepEqual(plain(n.bannerFromEvent(ev(), "e1")), { key: "m1", conversationId: "c1", title: "Lan", body: "Chào anh nhé" });
});

test("bannerFromEvent: nhóm → tên nhóm, 'Người gửi: nội dung'", () => {
  const b = n.bannerFromEvent(ev({}, { loai: "group", ten: "Kinh doanh" }), "e1");
  assert.equal(b.title, "Kinh doanh");
  assert.equal(b.body, "Lan: Chào anh nhé");
});

test("bannerFromEvent: hội thoại khách – khách nhắn / đồng nghiệp trả lời", () => {
  const k = n.bannerFromEvent(ev({ sender_type: "contact", sender: { id: "k1", ten: "Anh Huân", loai: "contact" } }, { loai: "customer", kenh: "app" }), "e1");
  assert.deepEqual(plain(k), { key: "m1", conversationId: "c1", title: "Anh Huân · App", body: "Chào anh nhé" });
  const k2 = n.bannerFromEvent(ev({ sender_type: "contact", sender: { id: "k1", ten: "", loai: "contact" } }, { loai: "customer" }), "e1");
  assert.equal(k2.title, "Khách");
  const nv = n.bannerFromEvent(ev({}, { loai: "customer", kenh: "web" }), "e1");
  assert.equal(nv.title, "Khách hàng");
  assert.equal(nv.body, "Lan: Chào anh nhé");
});

test("bannerFromEvent: bỏ tin của mình / hệ thống / thu hồi / tin tạm / payload hỏng", () => {
  assert.equal(n.bannerFromEvent(ev(), "e2"), null);
  assert.equal(n.bannerFromEvent(ev({ sender_type: "system", sender: null }), "e1"), null);
  assert.equal(n.bannerFromEvent(ev({ recalled_at: "2026-10-13T00:00:00Z" }), "e1"), null);
  assert.equal(n.bannerFromEvent(ev({ id: "local-abc" }), "e1"), null);
  assert.equal(n.bannerFromEvent(null, "e1"), null);
  assert.equal(n.bannerFromEvent({ message: { id: "x" } }, "e1"), null);
});

test("bannerFromEvent: tắt tiếng → bỏ, trừ khi được @nhắc", () => {
  assert.equal(n.bannerFromEvent(ev({}, { loai: "group", ten: "G" }, { muted: true }), "e1"), null);
  const b = n.bannerFromEvent(ev({ mentions: ["e1"] }, { loai: "group", ten: "G" }, { muted: true }), "e1");
  assert.equal(b.body, "Lan đã nhắc đến bạn: Chào anh nhé");
});

test("bannerFromPush / chatTarget: chỉ nhận push chat đủ id", () => {
  const data = { type: "chat", conversation_id: "c9", message_id: "m9" };
  assert.deepEqual(plain(n.bannerFromPush({ title: "T", body: "B", data })), { key: "m9", conversationId: "c9", title: "T", body: "B" });
  assert.equal(n.bannerFromPush({ title: "T", body: "B", data: { type: "khac" } }), null);
  assert.equal(n.bannerFromPush({ title: "T", data: { type: "chat", conversation_id: "c9" } }), null);
  assert.equal(n.bannerFromPush(null), null);
  assert.equal(n.chatTarget(data), "c9");
  assert.equal(n.chatTarget({ type: "chat" }), null);
  assert.equal(n.chatTarget("x"), null);
});

test("createSeen: khử trùng + giới hạn bộ nhớ", () => {
  const s = n.createSeen(2);
  assert.equal(s.add("a"), true);
  assert.equal(s.add("a"), false);
  s.add("b");
  s.add("c"); // đẩy "a" ra
  assert.equal(s.add("a"), true);
  assert.equal(s.add("c"), false);
});
