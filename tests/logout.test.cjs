// Đăng xuất (services/LogoutService.ts) ⇒ AuthApi.logout (chi tiết thu hồi + xoá phiên: tests/nv-session.test.cjs).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

test("logoutCurrentSession gọi AuthApi.logout", async () => {
  let n = 0;
  const m = loadTs("services/LogoutService.ts", { modules: { "@/services/AuthApi": { AuthApi: { logout: async () => { n++; } } } } });
  await m.logoutCurrentSession();
  assert.equal(n, 1);
});
