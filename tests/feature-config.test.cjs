const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const f = loadTs("lib/featureConfig.ts");
// Object tạo trong vm context khác → so qua JSON.
const plain = (v) => JSON.parse(JSON.stringify(v));

test("routes match the existing screens; commission has none", () => {
  assert.equal(f.routeForFeature("5"), "/bookings");
  assert.equal(f.routeForFeature("13"), "/deposits");
  assert.equal(f.routeForFeature("7"), null);
  assert.equal(f.routeForFeature("99"), null);
});

test("agency accounts only see projects, products, bookings, deposits; features without a screen are hidden", () => {
  const all = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "13"];
  const menuEligible = ["1", "2", "3", "4", "5", "6", "8", "9", "13"];
  assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: true, menuOnly: false, menuEligible })), ["1", "2", "5", "13"]);
  assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: true, menuOnly: true, menuEligible })), ["1", "2", "5", "13"]);
  assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: false, menuOnly: true, menuEligible })), menuEligible);
  assert.deepEqual(
    plain(f.visibleFeatureIds(all, { isAgency: false, menuOnly: false, menuEligible })),
    all.filter((id) => id !== "7")
  );
});

test("toggleSelection enforces min and max with the given messages", () => {
  const o = { min: 1, max: 2, tooManyMessage: "max", tooFewMessage: "min" };
  assert.deepEqual(plain(f.toggleSelection(["1"], "2", o)), { next: ["1", "2"], error: null });
  assert.deepEqual(plain(f.toggleSelection(["1", "2"], "3", o)), { next: ["1", "2"], error: "max" });
  assert.deepEqual(plain(f.toggleSelection(["1"], "1", o)), { next: ["1"], error: "min" });
  assert.deepEqual(plain(f.toggleSelection(["1", "2"], "1", o)), { next: ["2"], error: null });
  const home = { min: 0, max: 6, tooManyMessage: "max", tooFewMessage: "min" };
  assert.deepEqual(plain(f.toggleSelection(["1"], "1", home)), { next: [], error: null });
});

test("moveItem swaps neighbours and ignores out-of-range moves", () => {
  assert.deepEqual(plain(f.moveItem(["a", "b", "c"], "b", -1)), ["b", "a", "c"]);
  assert.deepEqual(plain(f.moveItem(["a", "b", "c"], "c", 1)), ["a", "b", "c"]);
  assert.deepEqual(plain(f.moveItem(["a", "b"], "x", 1)), ["a", "b"]);
});

test("normalizeSelection survives stale or corrupted storage", () => {
  const all = ["1", "2", "5"];
  assert.deepEqual(plain(f.normalizeSelection({ selectedIds: ["5", "99", "5", "1"] }, all, ["1"])), ["5", "1"]);
  assert.deepEqual(plain(f.normalizeSelection({ selectedIds: [] }, all, ["1", "2"])), ["1", "2"]);
  assert.deepEqual(plain(f.normalizeSelection(null, all, ["1"])), ["1"]);
  assert.deepEqual(plain(f.normalizeSelection("garbage", all, ["2"])), ["2"]);
});

test("sanitizeMenuTabIds drops hidden/disallowed ids from old storage and pads with allowed defaults", () => {
  const allowed = ["1", "2", "3", "4", "5", "6", "8", "9", "13"];
  const agencyAllowed = ["1", "2", "5", "13"];
  assert.deepEqual(plain(f.sanitizeMenuTabIds(["7", "3"], allowed, ["1", "2"], 2)), ["3", "1"]);
  assert.deepEqual(plain(f.sanitizeMenuTabIds(["3", "6"], agencyAllowed, ["1", "2"], 2)), ["1", "2"]);
  assert.deepEqual(plain(f.sanitizeMenuTabIds(["5", "5", 42, null], agencyAllowed, ["1", "2"], 2)), ["5", "1"]);
  assert.deepEqual(plain(f.sanitizeMenuTabIds("garbage", allowed, ["1", "2"], 2)), ["1", "2"]);
  // Mặc định không hợp lệ với tài khoản → lấy tiếp từ danh sách được phép
  assert.deepEqual(plain(f.sanitizeMenuTabIds([], ["5", "13"], ["1", "2"], 2)), ["5", "13"]);
});

test("resolveHomeFeatureIds: agency or unknown account type never sees non-agency features", () => {
  const allIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "13"];
  const menuEligible = ["1", "2", "3", "4", "5", "6", "8", "9", "13"];
  const base = { allIds, menuEligible, max: 6 };
  // Không đọc được loại tài khoản (lỗi bộ nhớ) → coi như đại lý (an toàn)
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: undefined, isAgency: null })), ["1", "2", "5", "13"]);
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: undefined, isAgency: true })), ["1", "2", "5", "13"]);
  assert.deepEqual(
    plain(f.resolveHomeFeatureIds({ ...base, stored: { selectedIds: ["3", "6"] }, isAgency: true })),
    ["1", "2", "5", "13"]
  );
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: { selectedIds: ["13", "3"] }, isAgency: true })), ["13"]);
});

test("resolveHomeFeatureIds: normal accounts keep a deliberate empty selection but recover from invalid ids", () => {
  const allIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "13"];
  const base = { allIds, menuEligible: [], max: 6, isAgency: false };
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: undefined })), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: { selectedIds: [] } })), []);
  // Chỉ còn mục đã ẩn/không tồn tại → không phải người dùng chủ ý chọn rỗng → mặc định
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: { selectedIds: ["7", "99"] } })), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: { selectedIds: ["9", "7", "2"] } })), ["9", "2"]);
  assert.deepEqual(plain(f.resolveHomeFeatureIds({ ...base, stored: "garbage" })), ["1", "2", "3", "4", "5", "6"]);
});
