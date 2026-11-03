const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const s = loadTs("lib/staffResetPassword.ts");

test("resetErrorMessage reads the server error, else a network message, else the fallback", () => {
  const http = (status, data) => ({ response: { status, data } });
  assert.equal(s.resetErrorMessage(http(400, { error: "Mã xác thực không đúng. Còn 3 lần thử" }), "x"), "Mã xác thực không đúng. Còn 3 lần thử");
  assert.equal(s.resetErrorMessage(http(500, { message: "lỗi khác" }), "x"), "lỗi khác");
  assert.equal(s.resetErrorMessage(http(404, "Not Found"), "Không gửi được mã"), "Không gửi được mã");
  assert.equal(s.resetErrorMessage({ message: "Network Error" }, "x"), "Không kết nối được máy chủ");
  assert.equal(s.resetErrorMessage(undefined, "Không gửi được mã"), "Không gửi được mã");
});

test("retryAfterOf returns the wait from a 'please wait' error, else null", () => {
  assert.equal(s.retryAfterOf({ response: { status: 400, data: { error: "Vui lòng chờ 42 giây", retryAfter: 42 } } }), 42);
  assert.equal(s.retryAfterOf({ response: { status: 400, data: { error: "x" } } }), null);
  assert.equal(s.retryAfterOf({ response: { status: 400, data: { retryAfter: "abc" } } }), null);
  assert.equal(s.retryAfterOf(null), null);
});

test("normalizeLogin trims like the login screen (server lowercases)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(s.normalizeLogin("  MSR ", " NV01 "))), { maCTDK: "MSR", account: "NV01" });
});

test("password rules match the server (6..256)", () => {
  assert.equal(s.MIN_PASSWORD, 6);
  assert.equal(s.MAX_PASSWORD, 256);
  assert.equal(s.isOtpCode("123456"), true);
  assert.equal(s.isOtpCode("12345"), false);
  assert.equal(s.isOtpCode("12345a"), false);
});
