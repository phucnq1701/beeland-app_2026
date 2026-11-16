/* global __dirname */
// Tự xoá tài khoản — bộ API riêng fn_nv_app_xoa_tai_khoan (máy chủ lấy nhân viên / công ty từ JWT; xoá như lõi web, còn chứng từ ⇒
// khoá, quản trị ⇒ từ chối). App: không gửi id, chỉ dọn phiên khi máy chủ xác nhận, không dọn phiên của tài khoản khác.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Promise, require: (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

class NvApiError extends Error {
  constructor(m, status = 400) { super(m); this.status = status; }
}

function load({ reply = { ket_qua: "xoa" }, error = null, clearFails = false } = {}) {
  const store = { jwt: "jwt-1", token: "tok-1" };
  const calls = [];
  let cleared = 0;
  const nv = {
    callNv: async (fn, body, opt) => {
      calls.push({ fn, body, opt });
      if (fn === "fn_nv_app_xoa_tai_khoan") {
        if (error) throw error;
        return reply;
      }
      return {};
    },
    errorMessage: (e, f) => (e && e.message) || f,
  };
  const session = {
    getJwt: async () => store.jwt,
    getSessionToken: async () => store.token,
    clearSession: async () => {
      if (clearFails) throw new Error("storage");
      cleared += 1;
      store.jwt = "";
      store.token = "";
    },
  };
  const svc = compile("sevicesSupabase/AccountDeletionService.ts", { "@/services/nvApi": nv, "@/services/session": session });
  return { svc, store, calls, cleared: () => cleared };
}

test("xoá: gọi fn_nv_app_xoa_tai_khoan KHÔNG kèm id (máy chủ lấy từ JWT), trả kết quả xoá / khoá", async () => {
  const h = load();
  const s = await h.svc.deleteCurrentEmployee();
  assert.equal(s.result, "xoa");
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].body)), {});
  assert.equal(h.calls[0].fn, "fn_nv_app_xoa_tai_khoan");
  const k = load({ reply: { ket_qua: "khoa" } });
  assert.equal((await k.svc.deleteCurrentEmployee()).result, "khoa");
});

test("chưa đăng nhập ⇒ không gọi máy chủ", async () => {
  const h = load();
  h.store.jwt = "";
  await assert.rejects(h.svc.deleteCurrentEmployee(), /Phiên đăng nhập/);
  assert.equal(h.calls.length, 0);
});

test("máy chủ từ chối (quản trị / hết phiên) ⇒ lời máy chủ, phiên giữ nguyên", async () => {
  const h = load({ error: new NvApiError("Tài khoản quản trị / nhóm toàn quyền không tự xoá được — vui lòng liên hệ quản trị hệ thống", 400) });
  await assert.rejects(h.svc.deleteCurrentEmployee(), /quản trị/);
  assert.equal(h.store.jwt, "jwt-1");
  assert.equal(h.cleared(), 0);
});

test("phản hồi lạ ⇒ không coi là đã xoá", async () => {
  for (const reply of [null, {}, { ket_qua: "ok" }, []]) {
    const h = load({ reply });
    await assert.rejects(h.svc.deleteCurrentEmployee(), /xác nhận/);
  }
});

test("dọn phiên: đăng xuất phiên máy chủ + xoá phiên máy; phiên đã đổi tài khoản ⇒ không xoá", async () => {
  const h = load();
  const s = await h.svc.deleteCurrentEmployee();
  await h.svc.clearDeletedEmployeeSession(s);
  assert.equal(h.cleared(), 1);
  const out = h.calls.find((c) => c.fn === "fn_nv_app_dang_xuat");
  assert.deepEqual(JSON.parse(JSON.stringify(out.body)), { p_token: "tok-1" });
  assert.equal(out.opt.anonymous, true);

  const other = load();
  const s2 = await other.svc.deleteCurrentEmployee();
  other.store.jwt = "jwt-tai-khoan-khac";
  other.store.token = "tok-khac";
  await assert.rejects(other.svc.clearDeletedEmployeeSession(s2), /Phiên đăng nhập đã thay đổi/);
  assert.equal(other.cleared(), 0);
});

test("dọn phiên lỗi ⇒ báo để thử lại (không gọi xoá lần 2)", async () => {
  const h = load({ clearFails: true });
  const s = await h.svc.deleteCurrentEmployee();
  await assert.rejects(h.svc.clearDeletedEmployeeSession(s), /chưa dọn được phiên/);
  assert.equal(h.calls.filter((c) => c.fn === "fn_nv_app_xoa_tai_khoan").length, 1);
});
