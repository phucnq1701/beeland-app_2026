const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const s = loadTs("lib/productStatus.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

// Bảng mã trạng thái SẢN PHẨM theo web: beeland/src/services/ProductTransactionStatus.ts (PRODUCT_STATUS)
test("every product status code maps to one of the 4 web display groups", () => {
  const expected = {
    0: "blocked", 1: "blocked", 2: "available", 3: "hold", 5: "hold", 6: "sold", 7: "hold",
    8: "sold", 9: "sold", 10: "sold", 11: "hold", 12: "hold", 13: "sold", 14: "sold",
    15: "sold", 16: "blocked", 17: "hold", 18: "blocked",
  };
  for (const [code, group] of Object.entries(expected)) {
    assert.equal(s.groupFromCode(code), group, `code ${code}`);
  }
});

test("unknown or missing codes are never shown as available", () => {
  for (const code of ["4", "19", "22", "99", "", null, undefined]) {
    assert.equal(s.groupFromCode(code), null, String(code));
  }
});

test("group labels match the web floor plan wording", () => {
  assert.deepEqual(plain(s.GROUP_META), {
    available: { label: "Mở bán", tone: "success" },
    hold: { label: "Giữ chỗ", tone: "warning" },
    sold: { label: "Đã bán", tone: "danger" },
    blocked: { label: "Khóa", tone: "neutral" },
  });
});

test("groupFromName follows the web mapStatus rules (with diacritics or not)", () => {
  assert.equal(s.groupFromName("Mở bán"), "available");
  assert.equal(s.groupFromName("Còn trống"), "available");
  assert.equal(s.groupFromName("Booking chờ duyệt"), "hold");
  assert.equal(s.groupFromName("Đã đặt cọc"), "hold");
  assert.equal(s.groupFromName("ĐC chờ duyệt"), "hold");
  assert.equal(s.groupFromName("Giữ chỗ ưu tiên"), "hold");
  assert.equal(s.groupFromName("Đã bán"), "sold");
  assert.equal(s.groupFromName("HĐMB"), "sold");
  assert.equal(s.groupFromName("hdmb cho duyet"), "sold");
  assert.equal(s.groupFromName("Hợp đồng mua bán"), "sold");
  assert.equal(s.groupFromName("Đặt cọc – chờ ký HĐMB"), "hold");
  assert.equal(s.groupFromName("Hủy HĐMB"), "blocked");
  assert.equal(s.groupFromName("Tạm khóa"), "blocked");
  assert.equal(s.groupFromName("Đã Lock"), "blocked");
  // Không nhận ra → Khóa (web: maintenance), không bao giờ là Trống
  assert.equal(s.groupFromName("Khác"), "blocked");
  assert.equal(s.groupFromName("Chưa bán"), "blocked");
  assert.equal(s.groupFromName(""), "blocked");
  assert.equal(s.groupFromName(undefined), "blocked");
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
