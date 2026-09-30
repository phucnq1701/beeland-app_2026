const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const o = loadTs("lib/productOverview.ts", {
  modules: { "./format": loadTs("lib/format.ts"), "./productStatus": loadTs("lib/productStatus.ts") },
});
const plain = (v) => JSON.parse(JSON.stringify(v));

test("unitStatusFromName maps catalog names like the old screen", () => {
  assert.equal(o.unitStatusFromName("Đã bán"), "sold");
  assert.equal(o.unitStatusFromName("hdmb chờ duyệt"), "sold");
  assert.equal(o.unitStatusFromName("Đã bàn giao"), "sold");
  assert.equal(o.unitStatusFromName("Đặt cọc chờ duyệt"), "deposit");
  assert.equal(o.unitStatusFromName("Booking chờ duyệt"), "booking");
  assert.equal(o.unitStatusFromName("Giữ chỗ"), "locked");
  assert.equal(o.unitStatusFromName("Lock căn"), "locked");
  assert.equal(o.unitStatusFromName(""), "available");
  assert.equal(o.unitStatusFromName(undefined), "available");
});

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
  assert.equal(floors[1].units[0].status, "booking");
});

test("buildOverviewFloors tolerates missing blocks/floors", () => {
  assert.deepEqual(plain(o.buildOverviewFloors([{}, { rawBlock: {} }, null])), []);
});

test("overviewSummary counts each status plus total, in the old order", () => {
  const summary = plain(o.overviewSummary(o.buildOverviewFloors(grid)));
  assert.deepEqual(summary.map((s) => s.key), ["all", "available", "deposit", "locked", "sold", "booking"]);
  assert.deepEqual(summary.map((s) => s.count), [3, 1, 0, 0, 1, 1]);
  assert.equal(summary[0].label, "Tổng");
});

test("HĐMB and other sold names match with or without Vietnamese diacritics", () => {
  for (const name of ["HĐMB đã duyệt", "HĐMB chờ duyệt", "Hợp đồng mua bán", "da ban", "DA BAN GIAO", "So do", "Sổ đỏ", "Góp vốn đã duyệt", "Thanh ly tat toan"]) {
    assert.equal(o.unitStatusFromName(name), "sold", name);
  }
  assert.equal(o.unitStatusFromName("Dat coc cho duyet"), "deposit");
  assert.equal(o.unitStatusFromName("Giu cho"), "locked");
  // Không bắt nhầm: "Đang bán" / "Mở bán" vẫn là căn trống
  assert.equal(o.unitStatusFromName("Đang bán"), "available");
  assert.equal(o.unitStatusFromName("Mở bán"), "available");
});
