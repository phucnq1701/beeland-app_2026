/* global __dirname */
// Giá booking theo bảng giá – SO TRỰC TIẾP với code web (nạp từ repo beeland cùng workspace):
//  - isLowRiseProduct: beeland/src/utils/productType.ts
//  - mapPriceListItem + pick: beeland/src/components/Products/BookingFormDialog.tsx
//  - sắp bảng giá theo priority: beeland/src/components/Sales/salesConfig/useSalesConfigOptions.ts
// Không có repo web → bỏ qua phần so sánh, vẫn chạy các ca cố định.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { loadTs } = require("./helpers/loadTs.cjs");

const price = loadTs("lib/bookingPrice.ts");
const payloadLib = loadTs("lib/bookingPayload.ts", { modules: { "./bookingPrice": price } });
const plain = (v) => JSON.parse(JSON.stringify(v));

const WEB = path.join(__dirname, "..", "..", "beeland", "src");
const hasWeb = fs.existsSync(WEB);

function runWeb(source) {
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(out, { module, exports: module.exports, require: () => ({}) });
  return module.exports;
}

/** Cắt nguyên văn mapPriceListItem của web ra khỏi file component để chạy độc lập. */
function webMapPriceListItem() {
  const src = fs.readFileSync(path.join(WEB, "components/Products/BookingFormDialog.tsx"), "utf8");
  const start = src.indexOf("const mapPriceListItem = (row: any) => {");
  const end = src.indexOf("\n};\n", start);
  assert.ok(start > 0 && end > start, "found web mapPriceListItem");
  return runWeb(`${src.slice(start, end + 3)}\nexports.mapPriceListItem = mapPriceListItem;`).mapPriceListItem;
}

const ROWS = [
  { area: 73.9, unit_price: 19831890, vat_rate: 10, maintenance_rate: 2, total_before_vat: 1465576671,
    vat_amount: 146557667.1, total_after_vat: 1612134338.1, maintenance_amount: 29394003.4, total_payment: 1641528341.5 },
  // Thiếu các cột tổng → web tự tính
  { area: 100, unit_price: 20000000, vat_rate: 10, maintenance_rate: 2 },
  { area: 120, unit_price: 0, land_unit_price: 30000000, area_xd: 200, construction_unit_price: 8000000, contract_total_value: 5e9 },
  { area: "", unit_price: null },
];

test("mapPriceListItem gives exactly the web values", { skip: !hasWeb && "no web repo" }, () => {
  const web = webMapPriceListItem();
  for (const row of ROWS) assert.deepEqual(plain(price.mapPriceListItem(row)), plain(web(row)));
  assert.equal(price.mapPriceListItem(null), null);
});

test("low-rise detection gives exactly the web result", { skip: !hasWeb && "no web repo" }, () => {
  const web = runWeb(fs.readFileSync(path.join(WEB, "utils/productType.ts"), "utf8")).isLowRiseProduct;
  const cases = [
    { product: { FormCode: "THAPTANG" }, maSP: "A-1" },
    { product: { FormCode: "CAOTANG" }, maSP: "LK-01" },
    { product: { product_type: "Biệt thự song lập" }, maSP: "X" },
    { product: { TenLoaiBDS: "Shophouse" }, maSP: "Y" },
    { product: {}, maSP: "LK-12" },
    { product: { MaCan: "BT_03" }, maSP: null },
    { product: {}, maSP: "B2-608" },
    { product: null, maSP: undefined },
  ];
  for (const c of cases) assert.equal(price.isLowRiseProduct(c), web(c), JSON.stringify(c));
});

test("price lists are taken by priority (smaller first), keeping server order on ties", () => {
  const lists = [
    { id: "a", priority: 5 }, { id: "b" }, { id: "c", priority: 1 }, { id: "d", priority: 1 }, { id: "e", priority: "2" },
  ];
  assert.deepEqual(plain(price.sortPriceLists(lists).map((x) => x.id)), ["c", "d", "e", "a", "b"]);
  assert.equal(price.sortPriceLists([]).length, 0);
});

test("booking payload uses the price list first and falls back to the product (web pick)", () => {
  const product = {
    ID: "p1", MaSP: "SP01", KyHieu: "B2-608", MaDA: "d1", TongGiaTriHDMB: 1700000000, DTThongThuy: 70,
    DonGiaThongThuy: 24000000, DonGiaChuaVAT: 21000000, TongGiaChuaVAT: 1470000000, TienVAT: 147000000,
    TongGiaGomVAT: 1617000000, PhiBaoTri: 32000000, DonGiaDat: 5, TongGiaDat: 6,
  };
  const priceItem = price.mapPriceListItem(ROWS[0]);
  const sales = {
    priceListId: "pl1", priceItem,
    policy: { id: "cs1", pricing_config_id: "cf1", payment_schedule_id: "ps1", tien_booking: 50000000 },
  };
  const p = payloadLib.buildBookingPayload(product, { maKH: "KH-1" }, null, sales);
  assert.equal(p.TongGiaGomPBT, 1641528341.5);
  assert.equal(p.DTThongThuy, 73.9);
  assert.equal(p.DonGiaTT, 19831890 * 1.1);
  assert.equal(p.DonGiaChuaVAT, 19831890);
  assert.equal(p.TongGiaChuaVAT, 1465576671);
  assert.equal(p.TienVAT, 146557667.1);
  assert.equal(p.TongGiaGomVAT, 1612134338.1);
  assert.equal(p.PhiBaoTri, 29394003.4);
  // Bảng giá không có giá đất (0) → lấy giá sản phẩm như web pick
  assert.equal(p.DonGiaDat, 5);
  assert.equal(p.TongGiaDat, 6);
  assert.equal(p.MaDotGia, "pl1");
  assert.equal(p.MaCS, "cs1");
  assert.equal(p.MaCSTong, "cf1");
  assert.equal(p.MaTDTT, "ps1");
  assert.equal(p.TienGiuCho, 50000000, "policy booking amount wins (web policyTienBooking)");

  const noList = payloadLib.buildBookingPayload(product, { maKH: "KH-1" }, null, null);
  assert.equal(noList.TongGiaGomPBT, 1700000000);
  assert.equal(noList.TongGiaGomVAT, 1617000000);
  assert.equal(noList.MaDotGia, null);
  assert.equal(noList.TienGiuCho, null);
});
