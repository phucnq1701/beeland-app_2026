// Hồ sơ người đăng nhập (sevicesSupabase/CloudProfileService.ts) lấy từ phiên app nhân viên (services/session.ts).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

function load({ jwt = "jwt", user }) {
  return loadTs("sevicesSupabase/CloudProfileService.ts", { modules: {
    "@/services/session": { getFreshJwt: async () => jwt, getUser: async () => user },
  } });
}

const USER = { id: "u-1", company_id: "c-1", ho_ten: " Tên NV ", email: "a@b.vn", dien_thoai: "" };

test("hồ sơ từ phiên: họ tên, email; SĐT rỗng ⇒ null", async () => {
  const r = await load({ user: USER }).CloudProfileService.userInfo();
  assert.deepEqual(JSON.parse(JSON.stringify(r.data)), { id: "u-1", companyId: "c-1", HoTen: "Tên NV", Email: "a@b.vn", DiDong: null });
});

test("không có họ tên ⇒ dùng email", async () => {
  const r = await load({ user: { ...USER, ho_ten: null } }).CloudProfileService.userInfo();
  assert.equal(r.data.HoTen, "a@b.vn");
});

test("hết phiên / phiên cũ chưa có hồ sơ ⇒ báo đăng nhập lại", async () => {
  await assert.rejects(load({ jwt: "", user: USER }).CloudProfileService.userInfo(), /đăng nhập lại/);
  await assert.rejects(load({ user: null }).CloudProfileService.userInfo(), /đăng nhập lại/);
});
