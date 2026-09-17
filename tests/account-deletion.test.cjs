/* global __dirname */
const { test } = require("node:test");
const { Buffer } = require("node:buffer");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const employee = "11111111-1111-4111-8111-111111111111";
const tenant = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const claims = () => ({
  sub: user, company_id: tenant, employee_id: employee,
  exp: Math.floor(Date.now() / 1000) + 3600,
});
const jwt = (payload) => [
  Buffer.from('{"alg":"HS256"}').toString("base64url"),
  Buffer.from(JSON.stringify(payload)).toString("base64url"),
  "test-signature",
].join(".");

function compile(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText, { exports, require: (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, console });
  return exports;
}

function load({ payload = claims(), result = [{ id: employee }], error, batchFails = false } = {}) {
  const storage = new Map([
    ["@supabase_jwt", jwt(payload)], ["@token", "session"],
    ["@cloud_profile", "profile"], ["@employee_id", "stale-id"],
    ["@tenant_id", tenant], ["@company_id", tenant],
    ["@cloud_company_id", tenant], ["@user_company_id", tenant],
    ["@branch_id", tenant], ["@ma_nv", "NV"], ["@type_account", "SYSTEM"],
    ["@company_code", "company"], ["maCTDK_UUID", tenant],
    ["maCTDK", "company"], ["tenCTDKVT", "company"],
    ["@home_features_config", "keep-preferences"],
  ]);
  const calls = [];
  let failRemove = false;
  const asyncStorage = { default: {
    getItem: async (key) => storage.get(key) ?? null,
    multiRemove: async (keys) => {
      if (batchFails) {
        storage.delete("@token"); // Simulate partial removal.
        throw new Error("Storage error");
      }
      keys.forEach((key) => storage.delete(key));
    },
    removeItem: async (key) => {
      if (failRemove) throw new Error("Storage unavailable");
      storage.delete(key);
    },
  } };
  const cloudTenant = compile("sevicesSupabase/cloudTenant.ts", {
    "@react-native-async-storage/async-storage": asyncStorage,
  });
  const api = {
    delete: async (url, config) => {
      calls.push({ url, config });
      if (error) throw error;
      return { data: result };
    },
    isAxiosError: (value) => !!value.isAxiosError,
  };
  const service = compile("sevicesSupabase/AccountDeletionService.ts", {
    "@react-native-async-storage/async-storage": asyncStorage,
    axios: { default: api },
    "./axiosApiSupabase": { default: { defaults: { baseURL: "https://api.example.test" } }, SUPABASE_ANON_KEY: "anon-test" },
    "./cloudTenant": cloudTenant,
  });
  return { ...service, storage, calls, setFailRemove: (value) => { failRemove = value; } };
}

test("deletes only current employee within JWT tenant, using web contract and pinned JWT", async () => {
  const s = load();
  const session = await s.deleteCurrentEmployee();
  assert.equal(s.calls.length, 1);
  const { url, config } = s.calls[0];
  assert.equal(url, "https://api.example.test/rest/v1/dm_employees");
  assert.deepEqual(JSON.parse(JSON.stringify(config.params)), {
    ma_ctdk: `eq.${tenant}`, id: `eq.${employee}`, select: "id",
  });
  assert.equal(config.headers.Authorization, `Bearer ${session.jwt}`);
  assert.equal(config.headers.apikey, "anon-test");
  assert.equal(config.headers.Prefer, "return=representation");
  assert.equal(config.timeout, 30000);
  assert.equal(s.storage.get("@token"), "session"); // Not cleared until UI calls cleanup.
  await s.clearDeletedEmployeeSession(session);
  assert.deepEqual([...s.storage], [["@home_features_config", "keep-preferences"]]);
});

test("invalid/missing/expired session or employee never sends DELETE or falls back to stale cache", async () => {
  for (const payload of [
    {}, { ...claims(), exp: 1 }, { ...claims(), exp: undefined },
    { ...claims(), employee_id: undefined }, { ...claims(), employee_id: user + "&id=not.is.null" },
    { ...claims(), company_id: "company-code" }, { ...claims(), sub: undefined },
  ]) {
    const s = load({ payload });
    await assert.rejects(s.deleteCurrentEmployee(), /đăng nhập lại/);
    assert.equal(s.calls.length, 0);
    assert.equal(s.storage.get("@token"), "session");
  }
  const s = load();
  s.storage.delete("@supabase_jwt");
  await assert.rejects(s.deleteCurrentEmployee());
  assert.equal(s.calls.length, 0);
});

test("empty, malformed, mismatched or multiple-row response never reports successful deletion", async () => {
  for (const result of [[], null, {}, [{ id: user }], [{ id: employee }, { id: user }]]) {
    const s = load({ result });
    await assert.rejects(s.deleteCurrentEmployee(), /Không tìm thấy/);
    assert.equal(s.storage.get("@token"), "session");
  }
});

test("permission, expired token, foreign-key, server and network errors preserve session", async () => {
  for (const [response, expected] of [
    [{ status: 401 }, /hết hạn/],
    [{ status: 403 }, /không có quyền/],
    [{ status: 400, data: { code: "42501" } }, /không có quyền/],
    [{ status: 409, data: { code: "23503" } }, /dữ liệu khác/],
    [{ status: 500 }, /Không xóa được/],
    [undefined, /Không nhận được xác nhận/],
  ]) {
    const s = load({ error: { isAxiosError: true, response } });
    await assert.rejects(s.deleteCurrentEmployee(), expected);
    assert.equal(s.storage.get("@token"), "session");
  }
});

test("cleanup refuses to remove another login session", async () => {
  const s = load();
  const deleted = await s.deleteCurrentEmployee();
  s.storage.set("@supabase_jwt", jwt({ ...claims(), sub: "other-user" }));
  s.storage.set("@token", "new-session");
  await assert.rejects(s.clearDeletedEmployeeSession(deleted), /đã thay đổi/);
  assert.equal(s.storage.get("@token"), "new-session");
});

test("partial storage failure is retried without repeating DELETE", async () => {
  const s = load({ batchFails: true });
  const deleted = await s.deleteCurrentEmployee();
  s.setFailRemove(true);
  await assert.rejects(s.clearDeletedEmployeeSession(deleted), /Đã xóa hồ sơ nhưng/);
  s.setFailRemove(false);
  await s.clearDeletedEmployeeSession(deleted);
  assert.equal(s.calls.length, 1);
  assert.deepEqual([...s.storage], [["@home_features_config", "keep-preferences"]]);
});