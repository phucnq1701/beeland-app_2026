// Phiên + lớp gọi API riêng app nhân viên (services/session.ts, services/nvApi.ts, services/AuthApi.ts).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

/** So sánh qua JSON: đối tượng tạo trong sandbox vm khác realm với assert. */
const deq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const makeJwt = (secLeft, extra = {}) =>
  `h.${b64url({ sub: "u-1", company_id: "c-1", exp: Math.floor(Date.now() / 1000) + secLeft, ...extra })}.s`;

const USER = {
  id: "u-1", email: "bao123", ho_ten: "Bảo", dien_thoai: "0900", ma_nv: "bao123", loai_tk: "AGENCY", ma_ctdk: "brg",
  company_id: "c-1", employee_id: "e-1", branch_id: "b-1", nhom_quyen_id: "p-1", nhom_quyen: "Đại lý", toan_quyen: false,
};

/** Dựng 3 module với AsyncStorage + axios giả. `server(url, body, headers)` trả {status, data} hoặc ném. */
function setup({ storage: init = [], server } = {}) {
  const storage = new Map(init);
  const calls = [];
  const asyncStorage = { default: {
    getItem: async (k) => storage.get(k) ?? null,
    setItem: async (k, v) => { storage.set(k, v); },
    multiSet: async (pairs) => { for (const [k, v] of pairs) storage.set(k, v); },
    removeItem: async (k) => { storage.delete(k); },
    multiRemove: async (ks) => { ks.forEach((k) => storage.delete(k)); },
  } };
  const axios = { default: {
    post: async (url, body, cfg) => {
      calls.push({ url, body, auth: cfg?.headers?.Authorization });
      const r = await server(url, body, cfg?.headers || {});
      if (r.status >= 400) { const e = new Error("http"); e.response = r; throw e; }
      return r;
    },
  } };
  const jwt = loadTs("lib/jwt.ts", { globals: { decodeURIComponent } });
  const sessionKeys = loadTs("lib/sessionKeys.ts");
  const config = loadTs("services/config.ts", { globals: { process: { env: {} } } });
  const session = loadTs("services/session.ts", { modules: {
    "@react-native-async-storage/async-storage": asyncStorage, axios, "@/lib/jwt": jwt, "@/lib/sessionKeys": sessionKeys,
    "./config": config,
  } });
  const api = loadTs("services/nvApi.ts", { modules: { axios, "./config": config, "./session": session } });
  const auth = loadTs("services/AuthApi.ts", { modules: { "./nvApi": api, "./session": session } });
  return { storage, calls, session, api, auth, jwt };
}

const ok = (data) => ({ status: 200, data });
const fail = (status, message, code = String(status)) => ({ status, data: { message, code } });

test("jwt: đọc exp và payload tiếng Việt", () => {
  const { jwt } = setup({ server: async () => ok({}) });
  const t = makeJwt(100, { per_name: "Đại lý" });
  assert.equal(jwt.jwtPayload(t).per_name, "Đại lý");
  const left = jwt.jwtSecondsLeft(t);
  assert.ok(left > 95 && left <= 100);
  assert.equal(jwt.jwtSecondsLeft("rác"), null);
});

test("đăng nhập: lưu phiên (khoá cũ lớp Supabase bị dọn, màn đọc getSessionInfo); không gửi JWT; gửi đúng tham số", async () => {
  const t = makeJwt(7 * 86400);
  const s = setup({
    storage: [["@token", "phien-cu"], ["@employee_id", "nv-cu"], ["@last_login", "giu"]],
    server: async (url, body) => {
      assert.match(url, /\/api\/app-nhan-vien\/fn_nv_app_dang_nhap$/);
      deq(body, { p_ma_ctdk: "brg", p_tai_khoan: "bao123", p_mat_khau: "mk", p_loai_tk: "AGENCY" });
      return ok({ jwt: t, token: "tok-1", nguoi_dung: USER });
    },
  });
  const r = await s.auth.AuthApi.login({ loginType: "AGENCY", companyCode: " brg ", username: "bao123 " }, "mk");
  assert.equal(r.status, "ok");
  assert.equal(s.calls[0].auth, undefined);
  assert.equal(s.storage.get("@supabase_jwt"), t);
  assert.equal(s.storage.get("@token"), "tok-1");
  assert.equal(s.storage.get("tenCTDKVT"), "brg");
  assert.equal(s.storage.get("@last_login"), "giu");
  for (const k of ["@tenant_id", "@employee_id", "@type_account", "@cloud_profile"]) assert.equal(s.storage.has(k), false, k);
  const info = await s.session.getSessionInfo();
  deq({ ...info }, { companyId: "c-1", employeeId: "e-1", maNv: info.maNv, typeAccount: "AGENCY", isAgency: true, companyCode: info.companyCode });
  assert.equal(JSON.parse(s.storage.get("@nv_user")).nhom_quyen, "Đại lý");
});

test("đăng nhập: sai mật khẩu ⇒ rejected với thông điệp máy chủ; lỗi mạng ⇒ network; phiên cũ giữ nguyên", async () => {
  const s = setup({ storage: [["@token", "phien-cu"]], server: async () => fail(401, "Sai tài khoản hoặc mật khẩu") });
  const r = await s.auth.AuthApi.login({ loginType: "INTERNAL", companyCode: "brg", username: "x" }, "y");
  deq({ ...r }, { status: "rejected", message: "Sai tài khoản hoặc mật khẩu" });
  assert.equal(s.storage.get("@token"), "phien-cu");
  assert.equal(s.calls[0].body.p_loai_tk, "SYSTEM");

  const n = setup({ server: async () => { throw new Error("Network Error"); } });
  const r2 = await n.auth.AuthApi.login({ loginType: "INTERNAL", companyCode: "brg", username: "x" }, "y");
  assert.equal(r2.status, "network");
});

test("gọi API: gắn Bearer JWT; lỗi máy chủ ⇒ NvApiError (không trả rỗng)", async () => {
  const t = makeJwt(5 * 86400);
  const s = setup({
    storage: [["@supabase_jwt", t], ["@token", "tok"]],
    server: async (url) => url.endsWith("fn_loi") ? fail(400, "Không tìm thấy sản phẩm", "P0002") : ok({ rows: [1] }),
  });
  deq(await s.api.callNv("fn_x", { p_a: 1 }), { rows: [1] });
  assert.equal(s.calls[0].auth, `Bearer ${t}`);
  await assert.rejects(s.api.callNv("fn_loi"), (e) => e.name === "NvApiError" && e.status === 400 && e.code === "P0002"
    && e.message === "Không tìm thấy sản phẩm");
});

test("gọi API: chưa đăng nhập ⇒ lỗi 401, không gọi mạng", async () => {
  const s = setup({ server: async () => ok({}) });
  await assert.rejects(s.api.callNv("fn_x"), (e) => e.status === 401);
  assert.equal(s.calls.length, 0);
});

test("JWT còn < 1 ngày ⇒ làm mới trước (xoay token) rồi mới gọi; nhiều lời gọi dùng chung 1 lần làm mới", async () => {
  const old = makeJwt(3600), fresh = makeJwt(7 * 86400);
  let refreshes = 0;
  const s = setup({
    storage: [["@supabase_jwt", old], ["@token", "tok-cu"]],
    server: async (url, body) => {
      if (url.endsWith("fn_nv_app_lam_moi_phien")) {
        refreshes++;
        deq(body, { p_token: "tok-cu" });
        return ok({ jwt: fresh, token: "tok-moi", nguoi_dung: USER });
      }
      return ok({ ok: 1 });
    },
  });
  await Promise.all([s.api.callNv("fn_a"), s.api.callNv("fn_b")]);
  assert.equal(refreshes, 1);
  assert.equal(s.storage.get("@token"), "tok-moi");
  const used = s.calls.filter((c) => !c.url.endsWith("lam_moi_phien")).map((c) => c.auth);
  deq(used, [`Bearer ${fresh}`, `Bearer ${fresh}`]);
});

test("máy chủ trả 401 ⇒ làm mới 1 lần rồi gọi lại", async () => {
  const cur = makeJwt(5 * 86400), fresh = makeJwt(7 * 86400);
  let first = true;
  const s = setup({
    storage: [["@supabase_jwt", cur], ["@token", "tok"]],
    server: async (url, _b, h) => {
      if (url.endsWith("fn_nv_app_lam_moi_phien")) return ok({ jwt: fresh, token: "tok2", nguoi_dung: USER });
      if (first) { first = false; return fail(401, "JWT expired"); }
      assert.equal(h.Authorization, `Bearer ${fresh}`);
      return ok({ done: true });
    },
  });
  deq(await s.api.callNv("fn_x"), { done: true });
});

test("làm mới bị từ chối (403 khoá TK) ⇒ xoá phiên + báo hết phiên; giữ @last_login", async () => {
  const s = setup({
    storage: [["@supabase_jwt", makeJwt(-10)], ["@token", "tok"], ["@last_login", "giu"], ["@tenant_id", "c-1"]],
    server: async () => fail(403, "Tài khoản đã bị khoá"),
  });
  const reasons = [];
  s.session.onSessionExpired((r) => reasons.push(r));
  await assert.rejects(s.api.callNv("fn_x"), (e) => e.status === 401);
  deq(reasons, ["Tài khoản đã bị khoá"]);
  assert.equal(s.storage.has("@token"), false);
  assert.equal(s.storage.has("@tenant_id"), false);
  assert.equal(s.storage.get("@last_login"), "giu");
});

test("làm mới lỗi mạng ⇒ giữ phiên; JWT còn hạn vẫn dùng", async () => {
  const cur = makeJwt(3600);
  const s = setup({
    storage: [["@supabase_jwt", cur], ["@token", "tok"]],
    server: async (url) => { if (url.endsWith("lam_moi_phien")) throw new Error("Network Error"); return ok({ a: 1 }); },
  });
  deq(await s.api.callNv("fn_x"), { a: 1 });
  assert.equal(s.storage.get("@token"), "tok");
});

test("đổi tài khoản trong lúc đang làm mới ⇒ không ghi đè phiên mới", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const s = setup({
    storage: [["@supabase_jwt", makeJwt(60)], ["@token", "tok-A"]],
    server: async (url) => {
      if (url.endsWith("lam_moi_phien")) { await gate; return ok({ jwt: makeJwt(9e5), token: "tok-A2", nguoi_dung: USER }); }
      return ok({});
    },
  });
  const p = s.session.refreshSession();
  s.storage.set("@token", "tok-B"); // người dùng đăng nhập tài khoản khác
  release();
  await p;
  assert.equal(s.storage.get("@token"), "tok-B");
});

test("đăng xuất: thu hồi phiên trên máy chủ rồi xoá; lỗi mạng vẫn xoá", async () => {
  const s = setup({ storage: [["@token", "tok"], ["@supabase_jwt", "j"], ["@last_login", "giu"]], server: async () => { throw new Error("x"); } });
  await s.auth.AuthApi.logout();
  assert.match(s.calls[0].url, /fn_nv_app_dang_xuat$/);
  deq(s.calls[0].body, { p_token: "tok" });
  assert.equal(s.storage.has("@token"), false);
  assert.equal(s.storage.get("@last_login"), "giu");
});

test("kiểm mật khẩu: không đụng phiên đang dùng, thu hồi phiên thử", async () => {
  const s = setup({
    storage: [["@token", "dang-dung"]],
    server: async (url) => url.endsWith("dang_nhap") ? ok({ jwt: makeJwt(9e5), token: "thu", nguoi_dung: USER }) : ok({ ok: true }),
  });
  const r = await s.auth.AuthApi.verifyPassword({ loginType: "INTERNAL", companyCode: "brg", username: "a" }, "mk");
  deq({ ...r }, { ok: true });
  await new Promise((r2) => setTimeout(r2, 0));
  assert.equal(s.storage.get("@token"), "dang-dung");
  deq(s.calls[1].body, { p_token: "thu" });

  const bad = setup({ server: async () => fail(401, "Sai tài khoản hoặc mật khẩu") });
  deq({ ...(await bad.auth.AuthApi.verifyPassword({ loginType: "AGENCY", companyCode: "brg", username: "a" }, "x")) },
    { ok: false, message: "Sai tài khoản hoặc mật khẩu" });
});
