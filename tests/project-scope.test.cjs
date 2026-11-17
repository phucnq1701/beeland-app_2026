const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const s = loadTs("lib/projectScope.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const U1 = "3329abf7-13e6-42fd-969c-a1e041374b26";
const U2 = "6a7ea4c6-63ca-46c2-ab42-5d15ddd45fdf";
const U3 = "e5844bea-7608-450c-96b4-df12bf9e0c0f";

test("projectRowsFromRpc: lấy rows của fn_da_project_list, chỉ giữ dự án ap_dung = true như app cũ", () => {
  const rows = s.projectRowsFromRpc({
    rows: [
      { id: U1, ten_da: "BRG TOWER", ap_dung: true },
      { id: U2, ten_da: "BRG Smart City", ap_dung: false },
      { id: U3, ten_da: "Không rõ", ap_dung: null },
    ],
    total: 3,
    company_empty: false,
  });
  assert.deepEqual(plain(rows).map((r) => r.id), [U1]);
});

test("projectRowsFromRpc: dữ liệu lạ / rỗng → mảng rỗng", () => {
  assert.deepEqual(plain(s.projectRowsFromRpc(null)), []);
  assert.deepEqual(plain(s.projectRowsFromRpc({ rows: "x" })), []);
  assert.deepEqual(plain(s.projectRowsFromRpc({ rows: [null, { ten_da: "thiếu id", ap_dung: true }] })), []);
});

test("pageIndexFromOffset: offSet cũ tính từ 1 → trang của fn_bds_product_list", () => {
  assert.equal(s.pageIndexFromOffset(1, 30), 1);
  assert.equal(s.pageIndexFromOffset(31, 30), 2);
  assert.equal(s.pageIndexFromOffset(61, 30), 3);
  assert.equal(s.pageIndexFromOffset(undefined, 30), 1);
  assert.equal(s.pageIndexFromOffset(0, 30), 1);
  assert.equal(s.pageIndexFromOffset("abc", 30), 1);
});

test("productListRpcArgs: chỉ gửi bộ lọc hợp lệ (uuid), từ khoá cắt khoảng trắng", () => {
  const args = plain(
    s.productListRpcArgs(
      { MaKhu: U2, MaPK: "-1", MaTT: "all", FormCode: " CAOTANG ", KyHieu: "  A1-10 ", Limit: 30, offSet: 31 },
      U1
    )
  );
  assert.deepEqual(args, {
    p_ma_da: U1,
    p_ma_khu: U2,
    p_ma_pk: null,
    p_ma_tang: null,
    p_ma_tt: null,
    p_form_code: "CAOTANG",
    p_input_search: "A1-10",
    p_page_index: 2,
    p_page_size: 30,
    p_trash: false,
  });
});

test("productListRpcArgs: không chọn dự án, mặc định 50 / trang 1", () => {
  const args = plain(s.productListRpcArgs({}, null));
  assert.equal(args.p_ma_da, null);
  assert.equal(args.p_page_index, 1);
  assert.equal(args.p_page_size, 50);
  assert.equal(args.p_input_search, null);
});

test("productIdsFromRpc: lấy id + total_count, bỏ id không phải uuid", () => {
  const r = plain(
    s.productIdsFromRpc({ rows: [{ id: U2 }, { id: "x" }, null, { id: U1 }], total_count: 75 })
  );
  assert.deepEqual(r, { ids: [U2, U1], total: 75 });
  assert.deepEqual(plain(s.productIdsFromRpc(undefined)), { ids: [], total: 0 });
});

test("orderByIds: xếp dòng REST theo thứ tự của hàm web, bỏ dòng không có trong danh sách", () => {
  const rows = [{ id: U1, n: 1 }, { id: U3, n: 3 }, { id: U2, n: 2 }];
  assert.deepEqual(plain(s.orderByIds([U2, U1], rows)).map((r) => r.n), [2, 1]);
});

test("agencyScopeFromRpc: null (không phải đại lý) giữ null; mảng → uuid hợp lệ; dạng lạ → null", () => {
  assert.equal(s.agencyScopeFromRpc(null), null);
  assert.equal(s.agencyScopeFromRpc(undefined), null);
  assert.equal(s.agencyScopeFromRpc("x"), null);
  assert.deepEqual(plain(s.agencyScopeFromRpc([])), []);
  assert.deepEqual(plain(s.agencyScopeFromRpc([U1, "bad", U2])), [U1, U2]);
});

test("filterByAgencyScope: nội bộ (null) giữ nguyên; đại lý chỉ giữ căn trong giỏ, giỏ rỗng → rỗng", () => {
  const rows = [{ id: U1 }, { id: U2 }, { id: U3 }];
  assert.equal(s.filterByAgencyScope(rows, null), rows);
  assert.deepEqual(plain(s.filterByAgencyScope(rows, [U3, U1])).map((r) => r.id), [U1, U3]);
  assert.deepEqual(plain(s.filterByAgencyScope(rows, [])), []);
});
