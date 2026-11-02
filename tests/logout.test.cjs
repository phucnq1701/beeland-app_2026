/* global __dirname */
// Đăng xuất (sevicesSupabase/LogoutService.ts): huỷ phiên cloud-auth như web, xoá phiên trên máy, giữ cấu hình / Face ID.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { loadTs } = require("./helpers/loadTs.cjs");

function compile(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, console });
  return exports;
}

const KEPT = [
  ["@last_login", '{"loginType":"INTERNAL","companyCode":"brg","username":"admin"}'],
  ["@account_scope", "system:brg:admin"],
  ["@biometric_account", '{"loginType":"INTERNAL","companyCode":"brg","username":"admin"}'],
  ["@home_features_config", "keep-preferences"],
];

function load({ token = "session-token", postFails = false, batchFails = false } = {}) {
  const storage = new Map([
    ["@supabase_jwt", "jwt"], ["@cloud_profile", "profile"], ["@employee_id", "nv"],
    ["@tenant_id", "t"], ["@company_id", "t"], ["@type_account", "SYSTEM"],
    ["maCTDK", "brg"], ["tenCTDKVT", "brg"],
    ...KEPT,
  ]);
  if (token) storage.set("@token", token);
  const posts = [];
  const asyncStorage = { default: {
    getItem: async (key) => storage.get(key) ?? null,
    multiRemove: async (keys) => {
      if (batchFails) throw new Error("Storage error");
      keys.forEach((key) => storage.delete(key));
    },
    removeItem: async (key) => { storage.delete(key); },
  } };
  const api = { default: {
    post: async (url, body, config) => {
      posts.push({ url, body, config, tokenStillStored: storage.has("@token") });
      if (postFails) throw new Error("Network Error");
      return { data: { status: 200 } };
    },
  } };
  const service = compile("sevicesSupabase/LogoutService.ts", {
    "@react-native-async-storage/async-storage": asyncStorage,
    "./axiosApiSupabase": api,
    "@/lib/sessionKeys": loadTs("lib/sessionKeys.ts"),
  });
  return { ...service, storage, posts };
}

test("huỷ phiên trên máy chủ bằng cloud-auth logout (giống web) TRƯỚC khi xoá token", async () => {
  const s = load();
  await s.logoutCurrentSession();
  assert.equal(s.posts.length, 1);
  assert.equal(s.posts[0].url, "functions/v1/cloud-auth");
  assert.deepEqual(JSON.parse(JSON.stringify(s.posts[0].body)), { action: "logout", token: "session-token" });
  assert.equal(s.posts[0].tokenStillStored, true);
});

test("xoá mọi khoá phiên; giữ tài khoản gần nhất, cấu hình theo tài khoản và Face ID", async () => {
  const s = load();
  await s.logoutCurrentSession();
  assert.deepEqual([...s.storage].sort(), [...KEPT].sort());
});

test("mất mạng / máy chủ lỗi vẫn xoá phiên trên máy", async () => {
  const s = load({ postFails: true });
  await s.logoutCurrentSession();
  assert.equal(s.storage.has("@token"), false);
  assert.equal(s.storage.has("@supabase_jwt"), false);
});

test("không có token phiên → không gọi máy chủ, vẫn xoá JWT", async () => {
  const s = load({ token: null });
  await s.logoutCurrentSession();
  assert.equal(s.posts.length, 0);
  assert.equal(s.storage.has("@supabase_jwt"), false);
});

test("xoá theo lô lỗi → xoá từng khoá", async () => {
  const s = load({ batchFails: true });
  await s.logoutCurrentSession();
  assert.deepEqual([...s.storage].sort(), [...KEPT].sort());
});
