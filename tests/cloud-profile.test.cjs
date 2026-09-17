/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../sevicesSupabase/CloudProfileService.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const fixture = () => ({
  status: 200, id: "user-1", companyId: "tenant-1",
  email: "account@example.test", fullName: "Tên tài khoản", phone: "010",
  employee: { hoTen: "Tên nhân viên", email: "staff@example.test", dienThoai: "020" },
});
const jwt = (sub = "user-1", tenant = "tenant-1", expired = false) =>
  JSON.stringify({ sub, company_id: tenant, expired });

function load({ token = jwt(), response = fixture(), verify } = {}) {
  const storage = new Map([["@supabase_jwt", token], ["@token", "cloud-session"]]);
  const calls = [];
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "@react-native-async-storage/async-storage") return { default: {
        getItem: async (key) => storage.get(key) ?? null,
        setItem: async (key, value) => { storage.set(key, value); },
        removeItem: async (key) => { storage.delete(key); },
      } };
      if (name === "./cloudTenant") return {
        decodeJwtPayload: (value) => JSON.parse(value || "{}"),
        isJwtExpired: (value) => !value || JSON.parse(value).expired,
      };
      if (name === "./AuthService") return { AuthSupabaseService: {
        login: async (payload) => {
          calls.push(payload);
          return verify ? verify(storage) : response;
        },
      } };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { ...exports, storage, calls };
}

test("mapping: employee precedence and account/admin fallback; missing phone is null", () => {
  const service = load();
  let p = service.normalizeCloudProfile(fixture());
  assert.equal(p.HoTen, "Tên nhân viên");
  assert.equal(p.Email, "staff@example.test");
  assert.equal(p.DiDong, "020");
  p = service.normalizeCloudProfile({ ...fixture(), employee: null });
  assert.equal(p.HoTen, "Tên tài khoản");
  assert.equal(p.Email, "account@example.test");
  const admin = service.normalizeCloudProfile({
    data: { id: "user-1", companyId: "tenant-1", email: "admin@example.test" },
  });
  assert.equal(admin.HoTen, "admin@example.test");
  assert.equal(admin.DiDong, null);
});

test("login caches only whitelisted fields; valid cache avoids API", async () => {
  const service = load();
  await service.cacheCloudProfile({ ...fixture(), token: "SECRET", menu: ["private"] }, jwt());
  const stored = service.storage.get(service.PROFILE_KEY);
  assert.equal(stored.includes("SECRET"), false);
  assert.equal(stored.includes("menu"), false);
  assert.equal((await service.CloudProfileService.userInfo()).data.HoTen, "Tên nhân viên");
  assert.equal(service.calls.length, 0);
});

test("old session without cache uses cloud-auth verify", async () => {
  const service = load();
  const result = await service.CloudProfileService.userInfo();
  assert.equal(result.data.id, "user-1");
  assert.equal(service.calls.length, 1);
  assert.equal(service.calls[0].action, "verify");
  assert.equal(service.calls[0].token, "cloud-session");
});

test("cache from another user or tenant never displayed", async () => {
  for (const profile of [
    { id: "user-other", companyId: "tenant-1" },
    { id: "user-1", companyId: "tenant-other" },
  ]) {
    const service = load();
    service.storage.set(service.PROFILE_KEY, JSON.stringify({ ...profile, HoTen: "Wrong" }));
    assert.equal((await service.CloudProfileService.userInfo()).data.HoTen, "Tên nhân viên");
    assert.equal(service.calls.length, 1);
  }
});

test("corrupt cache is recovered; mismatched login profile clears cache", async () => {
  const service = load();
  service.storage.set(service.PROFILE_KEY, "{broken");
  assert.equal((await service.CloudProfileService.userInfo()).data.id, "user-1");
  await service.cacheCloudProfile({ ...fixture(), id: "other" }, jwt());
  assert.equal(service.storage.has(service.PROFILE_KEY), false);
});

test("missing verify token and server rejection report errors, not empty profiles", async () => {
  const service = load();
  service.storage.delete("@token");
  await assert.rejects(service.CloudProfileService.userInfo(), /đăng nhập lại/);
  assert.equal(service.calls.length, 0);
  const rejected = load({ response: { status: 401 } });
  await assert.rejects(rejected.CloudProfileService.userInfo(), /không còn hợp lệ/);
  const failed = load({ verify: () => { throw new Error("Network"); } });
  await assert.rejects(failed.CloudProfileService.userInfo(), /Không xác minh/);
});

test("expired JWT requires verify refresh bound to the same identity", async () => {
  const service = load({
    token: jwt("user-1", "tenant-1", true),
    response: { ...fixture(), jwt: jwt() },
  });
  assert.equal((await service.CloudProfileService.userInfo()).data.id, "user-1");
  assert.equal(service.storage.get("@supabase_jwt"), jwt());
  const noRefresh = load({ token: jwt("user-1", "tenant-1", true) });
  await assert.rejects(noRefresh.CloudProfileService.userInfo(), /Không làm mới/);
  const wrongProfile = load({ response: { ...fixture(), id: "other" } });
  await assert.rejects(wrongProfile.CloudProfileService.userInfo(), /không khớp/);
});

test("account switch while verify is in flight does not overwrite new session", async () => {
  const service = load({ verify: (storage) => {
    storage.set("@supabase_jwt", jwt("other"));
    return fixture();
  } });
  await assert.rejects(service.CloudProfileService.userInfo(), /đã thay đổi/);
  assert.equal(service.storage.has(service.PROFILE_KEY), false);
  assert.equal(service.storage.get("@supabase_jwt"), jwt("other"));
});