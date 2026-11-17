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
