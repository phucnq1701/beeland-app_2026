// Chat (lib/chat.ts): gộp tin, dòng hiển thị, quyền tham gia, nhãn, kiểm tệp. Chạy: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const m = loadTs("lib/chat.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const msg = (o = {}) => ({
  id: "m1",
  conversation_id: "c1",
  sender_type: "employee",
  sender: { id: "e2", ten: "Lan", anh: null, loai: "employee" },
  loai: "text",
  noi_dung: "Chào",
  reply_to: null,
  mentions: null,
  system_event: null,
  edited_at: null,
  recalled_at: null,
  trang_thai_gui: "sent",
  created_at: "2026-10-12T03:00:00.000Z",
  attachments: [],
  ...o,
});

test("mergeMessages: tin thật thay tin tạm theo client_msg_id, giữ client_msg_id cũ, sắp theo thời gian", () => {
  const temp = msg({ id: "local-1", client_msg_id: "k1", local_status: "sending", created_at: "2026-10-12T03:05:00.000Z" });
  const older = msg({ id: "m0", created_at: "2026-10-12T02:00:00.000Z" });
  let list = m.mergeMessages([temp], [older]);
  assert.deepEqual(plain(list.map((x) => x.id)), ["m0", "local-1"]);
  list = m.mergeMessages(list, [msg({ id: "m9", client_msg_id: "k1", created_at: "2026-10-12T03:05:01.000Z" })]);
  assert.deepEqual(plain(list.map((x) => x.id)), ["m0", "m9"]);
  // bản cập nhật (realtime người khác) thiếu client_msg_id → giữ của bản cũ
  list = m.mergeMessages(list, [msg({ id: "m9", noi_dung: "sửa", created_at: "2026-10-12T03:05:01.000Z" })]);
  assert.equal(list[1].client_msg_id, "k1");
  assert.equal(list[1].noi_dung, "sửa");
  assert.equal(m.latestServerTime([...list, temp]), "2026-10-12T03:05:01.000Z");
  assert.equal(m.latestServerTime([temp]), null);
});

test("canJoinCustomer: admin nội bộ, hoặc mọi NV nội bộ với kênh app; đại lý không bao giờ", () => {
  const app = { loai: "customer", kenh: "app" };
  const web = { loai: "customer", kenh: "web" };
  assert.equal(m.canJoinCustomer({ is_admin: false, is_dai_ly: false }, app), true);
  assert.equal(m.canJoinCustomer({ is_admin: false, is_dai_ly: false }, web), false);
  assert.equal(m.canJoinCustomer({ is_admin: true, is_dai_ly: false }, web), true);
  assert.equal(m.canJoinCustomer({ is_admin: true, is_dai_ly: true }, app), false);
  assert.equal(m.canJoinCustomer({ is_admin: true, is_dai_ly: false }, { loai: "group", kenh: null }), false);
});

test("chatRows: vạch ngày, tin hệ thống, cụm, Đã gửi / Đã xem cho tin cuối của mình", () => {
  const now = new Date(2026, 9, 12, 15, 0);
  const at = (h, min) => new Date(2026, 9, 12, h, min).toISOString();
  const me = { id: "e1", ten: "Tôi", anh: null, loai: "employee" };
  const list = [
    msg({ id: "a", created_at: at(9, 0) }),
    msg({ id: "b", created_at: at(9, 2) }),
    msg({ id: "s", sender_type: "system", sender: null, system_event: { type: "member_joined", by: "e1" }, created_at: at(9, 3) }),
    msg({ id: "c", sender: me, created_at: at(9, 4) }),
  ];
  const rows = plain(m.chatRows(list, "e1", null, now));
  assert.equal(rows[0].type, "day");
  assert.equal(rows[0].label, "Hôm nay");
  const by = Object.fromEntries(rows.filter((r) => r.type !== "day").map((r) => [r.key, r]));
  assert.equal(by.a.first, true);
  assert.equal(by.a.last, false);
  assert.equal(by.a.footer, null);
  assert.equal(by.b.footer, "09:02");
  assert.equal(by.s.type, "system");
  assert.equal(by.c.mine, true);
  assert.equal(by.c.footer, "09:04 · Đã gửi");
  const seen = plain(m.chatRows(list, "e1", at(9, 10), now)).find((r) => r.key === "c");
  assert.equal(seen.footer, "09:04 · Đã xem");
  const failed = plain(m.chatRows([...list, msg({ id: "x", sender: me, local_status: "failed", created_at: at(9, 5) })], "e1", null, now));
  assert.equal(failed[failed.length - 1].footer, "Chưa gửi được");
});

test("othersReadAt: bỏ mốc của chính mình, lấy mốc mới nhất (kể cả khách)", () => {
  const page = { doc_boi: [{ employee_id: "e1", last_read_at: "2026-10-12T09:00:00Z" }, { employee_id: "e2", last_read_at: "2026-10-12T08:00:00Z" }], contact_last_read_at: null };
  assert.equal(m.othersReadAt(page, "e1"), "2026-10-12T08:00:00Z");
  assert.equal(m.othersReadAt({ ...page, contact_last_read_at: "2026-10-12T08:30:00Z" }, "e1"), "2026-10-12T08:30:00Z");
  assert.equal(m.othersReadAt({ doc_boi: [], contact_last_read_at: null }, "e1"), null);
});

test("tiêu đề, xem trước, nhãn giờ, tin hệ thống", () => {
  const conv = (o) => ({ conversation: { loai: "group", ten: "Nhóm A", ...o }, doi_dien: null, contact: null });
  assert.equal(m.conversationTitle(conv({})), "Nhóm A");
  assert.equal(m.conversationTitle({ ...conv({ loai: "direct", ten: null }), doi_dien: { ho_ten: "Hà" } }), "Hà");
  assert.equal(m.conversationTitle(conv({ loai: "customer", ten: null })), "Khách vãng lai");
  assert.equal(m.previewText("[Hình ảnh]"), "Đã gửi một ảnh");
  assert.equal(m.previewText("[Tệp] a.pdf"), "Đã gửi tệp a.pdf");
  assert.equal(m.previewText(null), "Chưa có tin nhắn");
  const now = new Date(2026, 9, 12, 15, 0);
  assert.equal(m.listTimeLabel(new Date(2026, 9, 12, 8, 5).toISOString(), now), "08:05");
  assert.equal(m.listTimeLabel(new Date(2026, 9, 11, 8, 5).toISOString(), now), "Hôm qua");
  assert.equal(m.listTimeLabel(new Date(2026, 9, 1, 8, 5).toISOString(), now), "01/10");
  assert.equal(m.dayLabel(new Date(2026, 9, 5, 9).toISOString(), now), "Thứ Hai, 05/10/2026");
  const names = { e1: "Hà", e2: "Lan" };
  assert.equal(m.systemText(msg({ system_event: { type: "member_added", by: "e1", ids: ["e2"] } }), (id) => names[id]), "Hà đã thêm Lan");
});

test("kiểm tệp: MIME theo đuôi, chặn định dạng lạ / quá 20 MB / rỗng", () => {
  assert.equal(m.chatFileMime("a.PDF", null), "application/pdf");
  assert.equal(m.chatFileMime("x.jpg", "application/octet-stream"), "image/jpeg");
  assert.equal(m.chatFileError({ name: "a.png", size: 1000, mime: "image/png" }), null);
  assert.equal(m.chatFileError({ name: "a.svg", size: 1000, mime: "image/svg+xml" }), "Định dạng tệp không được hỗ trợ");
  assert.equal(m.chatFileError({ name: "a.pdf", size: 21 * 1024 * 1024 }), "Tệp vượt quá 20 MB");
  assert.equal(m.chatFileError({ name: "a.pdf", size: 0 }), "Tệp rỗng");
  assert.match(m.newClientId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(m.formatFileSize(1536 * 1024), "1,5 MB");
});
