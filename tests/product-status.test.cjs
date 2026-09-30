const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const s = loadTs("lib/productStatus.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("overview unit statuses keep their labels and get accessible badge tones", () => {
  assert.deepEqual(plain(s.UNIT_STATUS_META), {
    available: { label: "Trống", tone: "success" },
    deposit: { label: "Đã cọc", tone: "info" },
    holding: { label: "Giữ chỗ", tone: "warning" },
    pending_kitchen: { label: "Bếp chờ", tone: "brand" },
    sold: { label: "Đã bán", tone: "danger" },
    locked: { label: "Khoá", tone: "neutral" },
    booking: { label: "Booking", tone: "warning" },
  });
});

test("unknown unit status falls back to a neutral badge", () => {
  assert.deepEqual(plain(s.unitStatusMeta("xyz")), { label: "Khác", tone: "neutral" });
  assert.deepEqual(plain(s.unitStatusMeta(undefined)), { label: "Khác", tone: "neutral" });
  assert.deepEqual(plain(s.unitStatusMeta("sold")), { label: "Đã bán", tone: "danger" });
});

test("projectStatus reads TenTT or MaTT like the old home carousel", () => {
  assert.deepEqual(plain(s.projectStatus({ TenTT: "Đã bán" })), { label: "Đã bán", tone: "danger" });
  assert.deepEqual(plain(s.projectStatus({ MaTT: 3 })), { label: "Đầu tư", tone: "brand" });
  assert.deepEqual(plain(s.projectStatus({})), { label: "Đang bán", tone: "success" });
  assert.deepEqual(plain(s.projectStatus({ ten_tt: "Sắp mở bán" })), { label: "Sắp mở bán", tone: "success" });
});
