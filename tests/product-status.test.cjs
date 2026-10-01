const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const s = loadTs("lib/productStatus.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

// Lấy sơ đồ web làm chuẩn: beeland/src/pages/Products/FloorPlanOverview.tsx (mapStatus)
test("webUnitStatus replicates the web floor plan mapStatus name rules", () => {
  const g = (TenTT, MaTT) => s.webUnitStatus({ TenTT, MaTT });
  assert.equal(g("Đã bán"), "sold");
  assert.equal(g("Đã ký HĐ"), "sold");
  assert.equal(g("Hợp đồng mua bán"), "sold");
  assert.equal(g("Giữ chỗ ưu tiên"), "hold");
  assert.equal(g("Booking chờ duyệt"), "hold");
  assert.equal(g("Đã đặt cọc"), "hold");
  assert.equal(g("Tạm khóa"), "blocked");
  assert.equal(g("Ngừng bán"), "blocked");
  assert.equal(g("Mở bán"), "available");
  assert.equal(g("Còn trống"), "available");
  // Thứ tự luật như web: "hợp đồng" đứng trước "cọc"
  assert.equal(g("Đặt cọc – chờ ký hợp đồng"), "sold");
});

test("names the web rules do not match fall back to the MaTT switch (HĐMB → Khóa like web)", () => {
  const g = (TenTT, MaTT) => s.webUnitStatus({ TenTT, MaTT });
  assert.equal(g("HĐMB", "6"), "blocked");
  assert.equal(g("HĐMB chờ duyệt", "14"), "blocked");
  assert.equal(g("ĐC chờ duyệt", "12"), "blocked");
  assert.equal(g("Bàn giao", "8"), "blocked");
  assert.equal(g("Đã Lock", "18"), "blocked");
  assert.equal(g("Chưa bán", "1"), "blocked");
  assert.equal(g("", "2"), "available");
  assert.equal(g("", 3), "hold");
  assert.equal(g("", "4"), "sold");
  assert.equal(g("", "5"), "sold");
  // MaTT là uuid / thiếu → Khóa, không bao giờ Mở bán
  assert.equal(g("", "5f1c-uuid"), "blocked");
  assert.equal(g(undefined, undefined), "blocked");
  assert.equal(s.groupFromName("Giữ chỗ"), "hold");
  assert.equal(s.groupFromName(""), "blocked");
});

test("group labels match the web floor plan wording", () => {
  assert.deepEqual(plain(s.GROUP_META), {
    available: { label: "Mở bán", tone: "success" },
    hold: { label: "Giữ chỗ", tone: "warning" },
    sold: { label: "Đã bán", tone: "danger" },
    blocked: { label: "Khóa", tone: "neutral" },
  });
});

test("isOpenForSale: only code 2 or the name Mở bán (web productSaleStatus)", () => {
  assert.equal(s.isOpenForSale("2"), true);
  assert.equal(s.isOpenForSale(2), true);
  assert.equal(s.isOpenForSale("Mở bán"), true);
  assert.equal(s.isOpenForSale("mo ban"), true);
  assert.equal(s.isOpenForSale("18"), false);
  assert.equal(s.isOpenForSale("Đã Lock"), false);
  assert.equal(s.isOpenForSale("Chưa bán"), false);
  assert.equal(s.isOpenForSale("Booking chờ duyệt"), false);
  assert.equal(s.isOpenForSale(""), false);
  assert.equal(s.isOpenForSale(null), false);
});

test("projectStatus reads TenTT or MaTT like the old home carousel", () => {
  assert.deepEqual(plain(s.projectStatus({ TenTT: "Đã bán" })), { label: "Đã bán", tone: "danger" });
  assert.deepEqual(plain(s.projectStatus({ MaTT: 3 })), { label: "Đầu tư", tone: "brand" });
  assert.deepEqual(plain(s.projectStatus({})), { label: "Đang bán", tone: "success" });
  assert.deepEqual(plain(s.projectStatus({ ten_tt: "Sắp mở bán" })), { label: "Sắp mở bán", tone: "success" });
});
