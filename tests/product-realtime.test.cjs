const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const format = loadTs("lib/format.ts");
const status = loadTs("lib/productStatus.ts");
const overview = loadTs("lib/productOverview.ts", { modules: { "./format": format, "./productStatus": status } });
const r = loadTs("lib/productRealtime.ts", { modules: { "./productOverview": overview } });
const plain = (v) => JSON.parse(JSON.stringify(v));

// Danh mục như FilterService.getStatusSP trả về (MaTT = uuid, _raw.item_code = mã số)
const catalog = [
  { MaTT: "u2", TenTT: "Mở bán", ColorWeb: "#22C55E", _raw: { item_code: "2" } },
  { MaTT: "u5", TenTT: "Đã đặt cọc", ColorWeb: "#3B82F6", _raw: { item_code: "5" } },
  { MaTT: "u6", TenTT: "HĐMB", ColorWeb: "#EF4444", _raw: { item_code: "6" } },
  { MaTT: "u12", TenTT: "ĐC chờ duyệt", ColorWeb: "#60A5FA", _raw: { item_code: "12" } },
  { MaTT: "u18", TenTT: "Đã Lock", ColorWeb: "#6B7280", _raw: { item_code: "18" } },
];

test("status group by product status code (bảng nghiệp vụ bds_trang_thai)", () => {
  const expected = {
    0: "sold", 1: "available", 2: "available", 3: "booking", 5: "deposit", 6: "sold", 7: "locked",
    8: "sold", 9: "sold", 10: "sold", 11: "booking", 12: "deposit", 13: "sold", 14: "sold",
    15: "sold", 16: "available", 17: "locked", 18: "locked",
  };
  for (const [code, group] of Object.entries(expected)) {
    assert.equal(r.statusGroupFromCode(code), group, `code ${code}`);
  }
  assert.equal(r.statusGroupFromCode("99"), null);
  assert.equal(r.statusGroupFromCode(null), null);
});

test("resolveCatalogStatus accepts a uuid or a legacy numeric code", () => {
  assert.equal(r.resolveCatalogStatus("u5", catalog).TenTT, "Đã đặt cọc");
  assert.equal(r.resolveCatalogStatus(12, catalog).TenTT, "ĐC chờ duyệt");
  assert.equal(r.resolveCatalogStatus("18", catalog).MaTT, "u18");
  assert.equal(r.resolveCatalogStatus("nope", catalog), null);
  assert.equal(r.resolveCatalogStatus(undefined, catalog), null);
});

test("unitStatusOf prefers the catalog code and falls back to the name", () => {
  // "ĐC chờ duyệt" theo tên không có chữ "đặt cọc" – theo mã 12 thì đúng là Đã cọc
  assert.equal(r.unitStatusOf({ MaTT: "u12", TenTT: "ĐC chờ duyệt" }, catalog), "deposit");
  assert.equal(r.unitStatusOf({ MaTT: "u6", TenTT: "" }, catalog), "sold");
  assert.equal(r.unitStatusOf({ MaTT: "unknown", TenTT: "Đã bán" }, catalog), "sold");
  assert.equal(r.unitStatusOf({}, catalog), "available");
});

const grid = () => [
  {
    rawBlock: {
      maKhu: "K1",
      floor: [
        { maTang: "T1", detailFloor: [
          { MaSP: "p1", MaVT: "V1", MaTT: "u2", TenTT: "Mở bán", MauNen: "#22C55E", ColorTT: "#22C55E" },
          { MaSP: "p2", MaVT: "V2", MaTT: "u2", TenTT: "Mở bán", MauNen: "#22C55E", ColorTT: "#22C55E" },
        ] },
      ],
    },
  },
  { rawBlock: { maKhu: "K2", floor: [{ maTang: "T1", detailFloor: [{ MaSP: "p9", MaVT: "V1", MaTT: "u2" }] }] } },
];

test("applyRealtimeChange updates code, name and colour of exactly one unit", () => {
  const before = grid();
  const { grid: after, changedMaSP } = r.applyRealtimeChange(
    before,
    { data: { MaKhu: "K1", MaTang: "T1", MaVT: "V2" }, maTT: "u5", mauNen: "#3B82F6" },
    catalog
  );
  assert.equal(changedMaSP, "p2");
  const unit = after[0].rawBlock.floor[0].detailFloor[1];
  assert.deepEqual(plain({ MaTT: unit.MaTT, TenTT: unit.TenTT, ColorTT: unit.ColorTT, MauNen: unit.MauNen }), {
    MaTT: "u5", TenTT: "Đã đặt cọc", ColorTT: "#3B82F6", MauNen: "#3B82F6",
  });
  // Không đụng căn khác / khu khác (giữ nguyên tham chiếu để memo có tác dụng)
  assert.equal(after[0].rawBlock.floor[0].detailFloor[0], before[0].rawBlock.floor[0].detailFloor[0]);
  assert.equal(after[1], before[1]);
});

test("applyRealtimeChange with a legacy numeric code and unknown unit", () => {
  const { grid: after } = r.applyRealtimeChange(
    grid(),
    { data: { MaKhu: "K1", MaTang: "T1", MaVT: "V1" }, maTT: 6, mauNen: 16711680 },
    catalog
  );
  const unit = after[0].rawBlock.floor[0].detailFloor[0];
  assert.equal(unit.MaTT, "u6");
  assert.equal(unit.TenTT, "HĐMB");
  const miss = r.applyRealtimeChange(grid(), { data: { MaKhu: "K1", MaTang: "T9", MaVT: "V1" }, maTT: "u5" }, catalog);
  assert.equal(miss.changedMaSP, null);
});

test("compareUnitCode sorts naturally (A-2 before A-10)", () => {
  const codes = ["A-10", "A-2", "B-1", "A-02-b", "A-02-a", "", "A-1"];
  assert.deepEqual([...codes].sort(r.compareUnitCode), ["", "A-1", "A-2", "A-02-a", "A-02-b", "A-10", "B-1"]);
});
