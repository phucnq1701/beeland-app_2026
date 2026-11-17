const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const b = loadTs("lib/biometricLogin.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("parseAccount: chuẩn hoá, loại dữ liệu hỏng", () => {
  assert.deepEqual(
    plain(b.parseAccount(JSON.stringify({ loginType: "AGENCY", companyCode: " ABC ", username: " u@x.vn " }))),
    { loginType: "AGENCY", companyCode: "ABC", username: "u@x.vn" }
  );
  // loginType lạ → Nội bộ
  assert.equal(b.parseAccount(JSON.stringify({ loginType: "?", companyCode: "a", username: "b" })).loginType, "INTERNAL");
  assert.equal(b.parseAccount(JSON.stringify({ companyCode: "a", username: "" })), null);
  assert.equal(b.parseAccount("không phải json"), null);
  assert.equal(b.parseAccount(null), null);
});

test("parseCredential: bắt buộc có mật khẩu", () => {
  const raw = JSON.stringify({ loginType: "INTERNAL", companyCode: "abc", username: "u", password: "p@ss " });
  assert.deepEqual(plain(b.parseCredential(raw)), { loginType: "INTERNAL", companyCode: "abc", username: "u", password: "p@ss " });
  assert.equal(b.parseCredential(JSON.stringify({ loginType: "INTERNAL", companyCode: "abc", username: "u" })), null);
  assert.equal(b.parseCredential(JSON.stringify({ loginType: "INTERNAL", companyCode: "abc", username: "u", password: "" })), null);
});

test("legacyRememberedAccount: lấy tài khoản từ @remember_login cũ, bỏ mật khẩu", () => {
  const raw = JSON.stringify({ companyCode: "abc", username: "u", password: "bí mật", loginType: "AGENCY", rememberMe: true });
  const acc = plain(b.legacyRememberedAccount(raw));
  assert.deepEqual(acc, { loginType: "AGENCY", companyCode: "abc", username: "u" });
  assert.equal("password" in acc, false);
});

test("accountFromScope: dựng lại tài khoản từ khoá phiên khi chưa có @last_login", () => {
  assert.deepEqual(plain(b.accountFromScope("system:abc:a:b@x.vn", "ABC", "SYSTEM")), {
    loginType: "INTERNAL",
    companyCode: "ABC",
    username: "a:b@x.vn",
  });
  assert.equal(b.accountFromScope("agency:abc:u", null, "AGENCY").loginType, "AGENCY");
  assert.equal(b.accountFromScope("agency:abc:u", null, "AGENCY").companyCode, "abc");
  assert.equal(b.accountFromScope(null, "ABC", "SYSTEM"), null);
  assert.equal(b.accountFromScope("system:abc:", "ABC", "SYSTEM"), null);
});

test("sameAccount / accountKey: không phân biệt hoa thường, khác loại là khác tài khoản", () => {
  const a = { loginType: "INTERNAL", companyCode: "ABC", username: "U@x.vn" };
  assert.equal(b.sameAccount(a, { loginType: "INTERNAL", companyCode: " abc", username: "u@X.vn" }), true);
  assert.equal(b.sameAccount(a, { ...a, loginType: "AGENCY" }), false);
  assert.equal(b.sameAccount(a, { ...a, username: "v@x.vn" }), false);
  assert.equal(b.accountKey(a), "internal:abc:u@x.vn");
});

test("maskUsername", () => {
  assert.equal(b.maskUsername("nguyenvana@abc.com"), "ngu***@abc.com");
  assert.equal(b.maskUsername("ab@abc.com"), "a***@abc.com");
  assert.equal(b.maskUsername("admin01"), "adm***");
  assert.equal(b.maskUsername("abc"), "a***");
  assert.equal(b.maskUsername(" "), "***");
});

test("pickBiometricKind: iOS ưu tiên Face ID, Android ưu tiên vân tay", () => {
  // AuthenticationType: 1 vân tay, 2 khuôn mặt, 3 mống mắt
  assert.equal(b.pickBiometricKind([1, 2], true), "face");
  assert.equal(b.pickBiometricKind([1], true), "fingerprint");
  assert.equal(b.pickBiometricKind([2, 1], false), "fingerprint");
  assert.equal(b.pickBiometricKind([2], false), "face");
  assert.equal(b.pickBiometricKind([3], false), "iris");
  assert.equal(b.pickBiometricKind([], false), null);
});

test("biometricLabel", () => {
  assert.equal(b.biometricLabel("face", true), "Face ID");
  assert.equal(b.biometricLabel("fingerprint", true), "Touch ID");
  assert.equal(b.biometricLabel("fingerprint", false), "vân tay");
  assert.equal(b.biometricLabel("face", false), "khuôn mặt");
  assert.equal(b.biometricLabel("iris", false), "mống mắt");
});

test("classifyBiometricError: phân loại lỗi SecureStore / LocalAuthentication", () => {
  assert.equal(b.classifyBiometricError("User canceled the operation."), "cancel");
  assert.equal(b.classifyBiometricError("User canceled the authentication"), "cancel");
  assert.equal(b.classifyBiometricError("user_cancel"), "cancel");
  assert.equal(b.classifyBiometricError("system_cancel"), "cancel");
  assert.equal(b.classifyBiometricError("Lockout permanent"), "lockout");
  assert.equal(b.classifyBiometricError("lockout"), "lockout");
  assert.equal(b.classifyBiometricError("Biometry is locked out."), "lockout");
  assert.equal(b.classifyBiometricError("Vendor error"), "other");
  assert.equal(b.classifyBiometricError(undefined), "other");
});

test("addDeclined: không trùng, giữ tối đa N tài khoản mới nhất", () => {
  assert.deepEqual(plain(b.addDeclined(["a", "b"], "a")), ["b", "a"]);
  assert.deepEqual(plain(b.addDeclined(["a", "b", "c"], "d", 3)), ["b", "c", "d"]);
  assert.deepEqual(plain(b.parseDeclined('["a", 1, "b"]')), ["a", "b"]);
  assert.deepEqual(plain(b.parseDeclined("hỏng")), []);
});
