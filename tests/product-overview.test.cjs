const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const o = loadTs("lib/productOverview.ts", {
  modules: { "./format": loadTs("lib/format.ts"), "./productStatus": loadTs("lib/productStatus.ts") },
});
const plain = (v) => JSON.parse(JSON.stringify(v));

const grid = [
  {
    rawBlock: {
      maKhu: "A",
      floor: [
        { maTang: "2", tenTang: "Tầng 2", detailFloor: [
          { MaSP: "p3", KyHieu: "A-02-b", GiaBan: 2500000000.4, MaVT: "b", TenTT: "Đã bán" },
          { MaSP: "p2", KyHieu: "A-02-a", GiaBan: null, MaVT: "a", TenTT: "Mở bán" },
        ] },
      ],
    },
  },
  { rawBlock: { maKhu: "B", floor: [{ maTang: "1", tenTang: "Tầng 1", detailFloor: [
    { MaSP: "p9", KyHieu: "B-01-a", GiaBan: 1000, MaVT: "a", TenTT: "Booking" },
  ] }] } },
];

test("buildOverviewFloors groups by block+floor, sorts by column and formats price", () => {
  const floors = plain(o.buildOverviewFloors(grid));
  assert.equal(floors.length, 2);
  assert.equal(floors[0].id, "A_2");
  assert.equal(floors[0].name, "Tầng 2");
  assert.equal(floors[0].totalUnits, 2);
  assert.deepEqual(floors[0].units.map((u) => u.code), ["A-02-a", "A-02-b"]);
  assert.equal(floors[0].units[0].price, "");
  assert.equal(floors[0].units[1].price, "2.500.000.000");
  assert.equal(floors[0].units[1].status, "sold");
  assert.equal(floors[1].units[0].status, "hold");
});

test("buildOverviewFloors tolerates missing blocks/floors", () => {
  assert.deepEqual(plain(o.buildOverviewFloors([{}, { rawBlock: {} }, null])), []);
});

test("overviewSummary counts the 4 web groups plus total", () => {
  const summary = plain(o.overviewSummary(o.buildOverviewFloors(grid)));
  assert.deepEqual(summary.map((s) => s.key), ["all", "available", "hold", "sold", "blocked"]);
  assert.deepEqual(summary.map((s) => s.label), ["Tổng", "Mở bán", "Giữ chỗ", "Đã bán", "Khóa"]);
  // "Mở bán" → Mở bán, "Đã bán" → Đã bán, "Booking" → Giữ chỗ
  assert.deepEqual(summary.map((s) => s.count), [3, 1, 1, 1, 0]);
});




test("colorFromData reads hex strings and integer ARGB colours like the web", () => {
  assert.equal(o.colorFromData("#22C55E"), "#22C55E");
  assert.equal(o.colorFromData(16711680), "#ff0000");
  assert.equal(o.colorFromData("16711680"), "#ff0000");
  assert.equal(o.colorFromData(""), null);
  assert.equal(o.colorFromData(null), null);
  assert.equal(o.colorFromData("hsl(1 2% 3%)"), null);
  const floors = o.buildOverviewFloors([{ rawBlock: { maKhu: "A", floor: [{ maTang: "1", detailFloor: [
    { MaSP: "x", KyHieu: "A-1", MaVT: "a", TenTT: "Mở bán", MauNen: 16711680, ColorTT: "#00ff00" },
    { MaSP: "y", KyHieu: "A-2", MaVT: "b", TenTT: "Khác", ColorTT: "#00ff00" },
  ] }] } }]);
  assert.equal(floors[0].units[0].color, "#ff0000"); // MauNen trước (như web)
  assert.equal(floors[0].units[1].color, "#00ff00");
  assert.equal(floors[0].units[1].statusName, "Khác");
});
