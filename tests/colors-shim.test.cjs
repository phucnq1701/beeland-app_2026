/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const path = require("node:path");
const { loadTs } = require("./helpers/loadTs.cjs");

// Bản gốc trước khi làm shim (commit spec, trước giai đoạn 0).
const originalSource = execSync("git show b2fbae60:constants/colors.ts", {
  cwd: path.join(__dirname, ".."),
  encoding: "utf8",
});
const before = loadTs("constants/colors.ts", { source: originalSource }).default;
const theme = loadTs("theme/colors.ts");
const after = loadTs("constants/colors.ts", { modules: { "../theme/colors": theme } }).default;

// Object tạo trong các vm context khác nhau có prototype khác nhau → so qua JSON.
const plain = (v) => JSON.parse(JSON.stringify(v));

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

test("shim keeps every legacy key", () => {
  assert.deepEqual(keys(after).sort(), keys(before).sort());
});

test("shim maps legacy names to tokens", () => {
  assert.equal(after.primary, "#C9501A");
  assert.equal(after.primaryDark, "#A84314");
  assert.equal(after.primaryLight, "#E86F25");
  assert.equal(after.text, "#0F172A");
  assert.equal(after.textSecondary, "#475569");
  assert.equal(after.textTertiary, "#64748B");
  assert.equal(after.textLight, "#64748B");
  assert.equal(after.border, "#E4E7EC");
  assert.equal(after.success, "#15803D");
  assert.equal(after.warning, "#B45309");
  assert.equal(after.error, "#B91C1C");
  assert.equal(after.info, "#1D4ED8");
});

test("backgrounds and decorative palettes are untouched", () => {
  for (const k of ["background", "backgroundSecondary", "backgroundTertiary", "white"]) {
    assert.equal(after[k], before[k]);
  }
  assert.deepEqual(plain(after.accent), plain(before.accent));
  assert.deepEqual(plain(after.gradients), plain(before.gradients));
});
