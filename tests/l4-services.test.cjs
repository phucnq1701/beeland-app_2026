/* global __dirname */
// L4 — chat (fn_nv_app_chat_*), thông báo (fn_nv_app_thong_bao_*), tài liệu (fn_nv_app_tai_lieu_*) qua bộ API riêng.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const compile = (file) =>
  ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
function run(file, requireMap, extra = {}) {
  const exports = {};
  vm.runInNewContext(compile(file), { exports, Promise, Date, Map, Set, console: { log() {} }, require: (n) => requireMap[n] ?? {}, ...extra });
  return exports;
}
const plain = (v) => JSON.parse(JSON.stringify(v));

function nvFake(handlers) {
  const calls = [];
  return {
    calls,
    callNv: async (fn, body) => {
      calls.push({ fn, body });
      const h = handlers[fn];
      if (!h) throw new Error(`unexpected ${fn}`);
      return h(body);
    },
    postFormNv: async (fn, make) => {
      const form = make();
      calls.push({ fn, form: form.parts });
      return handlers[fn](form.parts);
    },
    errorMessage: (e, f) => (e && e.message) || f,
  };
}
class FakeForm { constructor() { this.parts = []; } append(k, v) { this.parts.push([k, v]); } }

function chat(handlers, jwt = "jwt") {
  const nv = nvFake(handlers);
  const svc = run("sevicesSupabase/ChatService.ts", {
    "@/services/nvApi": nv,
    "@/services/session": { getJwt: async () => jwt },
    "./realtimeHub": { joinChannel: () => ({ close() {}, send() {} }), syncRealtimeAuth: async () => {} },
  }, { FormData: FakeForm });
  return { nv, svc };
}

test("chat: mọi hàm web fn_chat_* có endpoint app; trả data, {error} ⇒ lỗi tiếng Việt", async () => {
  const h = chat({
    fn_nv_app_chat_inbox: (b) => ({ data: { items: [{ id: 1 }], next_cursor: null, got: b.p_filter } }),
    fn_nv_app_chat_gui: () => ({ error: "Bạn cần tham gia cuộc trò chuyện để gửi tin" }),
    fn_nv_app_chat_me: () => { throw new Error("[42501] Phiên đăng nhập không hợp lệ"); },
  });
  const page = await h.svc.ChatService.inbox({ khu: "tat_ca", limit: 20 });
  assert.deepEqual(plain(page.got), { khu: "tat_ca", limit: 20 });
  await assert.rejects(h.svc.ChatService.send("c1", { client_msg_id: "x", noi_dung: "hi" }), /tham gia cuộc trò chuyện/);
  await assert.rejects(h.svc.ChatService.me(), /chưa có hồ sơ nhân viên/);
  const fns = Object.values(h.svc.CHAT_FN);
  assert.equal(new Set(fns).size, fns.length);
  assert.ok(fns.every((f) => f.startsWith("fn_nv_app_chat_")));
});

test("chat: chưa đăng nhập ⇒ không gọi máy chủ", async () => {
  const h = chat({}, "");
  await assert.rejects(h.svc.ChatService.me(), /hết hạn/);
  assert.equal(h.nv.calls.length, 0);
});

test("chat tệp: tải 1 bước multipart (conversation_id + file) ⇒ attachment_id; link xem dùng lại 240 s", async () => {
  let n = 0;
  const h = chat({
    fn_nv_app_chat_tep_tai: () => ({ attachment_id: "a1" }),
    fn_nv_app_chat_tep_link: () => ({ url: `https://kho.test/a1?sig=${++n}` }),
  });
  const id = await h.svc.ChatService.upload("c1", { uri: "file:///x.jpg", name: "x.jpg", mime: "image/jpeg", size: 10 });
  assert.equal(id, "a1");
  const up = h.nv.calls[0];
  assert.equal(up.fn, "fn_nv_app_chat_tep_tai");
  assert.deepEqual(plain(up.form), [["conversation_id", "c1"], ["file", { uri: "file:///x.jpg", name: "x.jpg", type: "image/jpeg" }]]);
  const u1 = await h.svc.ChatService.fileUrl("a1");
  const u2 = await h.svc.ChatService.fileUrl("a1");
  assert.equal(u1, u2);
  assert.equal(h.nv.calls.filter((c) => c.fn === "fn_nv_app_chat_tep_link").length, 1);
  assert.deepEqual(plain(h.nv.calls[1].body), { p_attachment_id: "a1" });
});

test("thông báo: list 50 tin của mình, đọc 1 / tất cả", async () => {
  const nv = nvFake({
    fn_nv_app_thong_bao_list: () => ({ items: [{ id: "t1", tieu_de: "A", form_code: 9002, ban_ghi_id: "s1", da_doc: false }], tong: 1, chua_doc: 1 }),
    fn_nv_app_thong_bao_doc: () => ({ so_dong: 1 }),
  });
  const notif = run("lib/notifications.ts", {});
  const svc = run("sevicesSupabase/NotificationService.ts", {
    "@/services/nvApi": nv, "@/services/session": { getUser: async () => null },
    "./realtimeHub": {}, "../lib/notifications": notif,
  }).NotificationService;
  const r = await svc.list();
  assert.equal(r.unread, 1);
  assert.equal(r.items[0].formCode, 9002);
  assert.deepEqual(plain(nv.calls[0].body), { p_payload: { so_dong: 50 } });
  await svc.markRead("t1");
  await svc.markRead();
  assert.deepEqual(plain(nv.calls.slice(1).map((c) => c.body)), [{ p_payload: { id: "t1" } }, { p_payload: {} }]);
});

test("tài liệu: cấp đầu dự án = con của thư mục gốc; tệp nằm thẳng trong thư mục ⇒ ô đầu; tìm kiếm ⇒ tìm cả thư mục con", async () => {
  const P = "67311E0C-C504-4A71-9BDD-8C637948A84D";
  const folders = [
    { id: 1, parent_id: null, ma_da: P, name: "Gốc", is_root: true, folder_count: 2, file_count: 3 },
    { id: 2, parent_id: 1, ma_da: P, name: "Pháp lý", folder_count: 1, file_count: 0 },
    { id: 3, parent_id: 1, ma_da: P, name: "Bản vẽ", folder_count: 0, file_count: 4, cover_link: "a/b.jpg" },
    { id: 4, parent_id: 2, ma_da: P, name: "Giấy phép", folder_count: 0, file_count: 1 },
    { id: 9, parent_id: null, ma_da: "other", name: "Dự án khác", is_root: true, folder_count: 0, file_count: 1 },
  ];
  const nv = nvFake({
    fn_nv_app_tai_lieu_cay: () => ({ folders, root_project_ids: [] }),
    fn_nv_app_tai_lieu_tep: () => [{ id: 7, name: "a.pdf", type: "pdf", size: 1.5, link: "x/a.pdf", created_at: "2026-11-16" }],
  });
  const svc = run("sevicesSupabase/DocumentService.ts", { "@/services/nvApi": nv }).DocumentService;
  const top = await svc.entries("DOCUMENT", P.toLowerCase(), null);
  assert.deepEqual(plain(top.map((e) => [e.id, !!e.filesOf])), [["1", true], ["3", false], ["2", false]]);
  assert.equal(top[1].cover, "https://upload.beesky.vn/a/b.jpg");
  assert.deepEqual(plain((await svc.entries("DOCUMENT", P, "2")).map((e) => e.id)), ["4"]);
  assert.deepEqual(plain(await svc.entries("DOCUMENT", null, null)), [], "không có dự án ⇒ không lộ thư mục dự án khác");
  assert.deepEqual(plain(nv.calls[0].body), { p_form_id: 488 });
  const files = await svc.files("GALLERY", "3", " giấy ");
  assert.equal(files[0].link, "https://upload.beesky.vn/x/a.pdf");
  assert.deepEqual(plain(nv.calls.at(-1).body), { p_form_id: 323, p_folder_id: 3, p_search: "giấy", p_recursive: true });
});
