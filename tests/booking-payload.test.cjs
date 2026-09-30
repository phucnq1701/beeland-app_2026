/* global __dirname */
// Tạo booking với dữ liệu THẬT của màn: bds_products → ProductService.normalizeProduct (uuid ở "ID",
// không có SanPhamId) → buildBookingPayload (màn tạo booking) → BookingService.createBooking → p_payload.
// Web chuẩn: beeland/src/components/Products/BookingFormDialog.tsx + services/Product.js (addBookingAPI).
// Tự chứa (không dùng tests/helpers) để cherry-pick riêng được.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tenant = uid(99);

function load(file, requireMap) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { log() {} },
    require: (name) => requireMap[name] ?? { default: {} },
  });
  return exports;
}

const cloudTenant = {
  getCompanyId: async () => tenant,
  getValidSupabaseJwt: async () => "test-jwt",
  getEmployeeId: async () => null,
  getCompanyCode: async () => "C01",
};
const storage = { default: { getItem: async () => JSON.stringify({ ho_ten: "NV Test" }) } };

function bookingService(posts, gets) {
  const http = {
    get: async (url, { params }) => {
      gets.push({ table: url.replace("rest/v1/", ""), params });
      if (url.endsWith("cloud_customers")) return { data: [{ id: uid(6) }] };
      return { data: [] };
    },
    post: async (url, body) => {
      posts.push({ target: url.replace("rest/v1/", ""), body });
      return { data: { phieu_giu_cho_id: uid(200), booking_id: uid(201), so_phieu: "BK-1" } };
    },
  };
  return load("sevicesSupabase/BookingService.ts", {
    "./axiosApiSupabase": { default: http },
    "./cloudTenant": cloudTenant,
    "@react-native-async-storage/async-storage": storage,
  }).BookingService;
}

// Một dòng bds_products như Supabase trả về (cột snake_case)
const productRow = {
  id: uid(3), ma_sp: "SP01", ky_hieu: "B2-608", ma_da: uid(4), ma_khu: uid(8),
  dien_tich_thong_thuy: 73.9, don_gia_thong_thuy: 21815079,
  don_gia_chua_vat: 19831890, tong_gia_chua_vat: 1465576671, tien_vat: 146557667.1,
  tong_gia_gom_vat: 1612134338.1, tong_gia_tri_hdmb: 1641528341.502, tien_pbt: 29394003.402,
  da: { ten_da: "Dự án A", ma_da_code: "DA01" },
};

test("booking from the real product shape sends the product uuid and the VAT fields like the web", async () => {
  const { normalizeProduct } = load("sevicesSupabase/ProductService.ts", {
    "./axiosApiSupabase": { default: {} },
    "./cloudTenant": cloudTenant,
    "@react-native-async-storage/async-storage": storage,
  });
  const product = normalizeProduct(productRow);
  assert.equal(product.ID, uid(3));
  assert.equal(product.SanPhamId, undefined, "the screen data has no SanPhamId");

  const { buildBookingPayload } = load("lib/bookingPayload.ts", {});
  const payload = buildBookingPayload(
    product,
    { maKH: "KH-00006", tenKH: "Khách", diDong: "0900000000", email: "" },
    { ID: uid(5), TenSan: "Sàn A" }
  );
  assert.equal(payload.SanPhamId, uid(3));
  assert.equal(payload.DonGiaChuaVAT, 19831890);
  assert.equal(payload.TongGiaChuaVAT, 1465576671);
  assert.equal(payload.TienVAT, 146557667.1);
  assert.equal(payload.LockId, null);

  const posts = [];
  const gets = [];
  const res = await bookingService(posts, gets).createBooking(payload);
  assert.equal(res.status, 2000);
  assert.equal(gets.some((g) => g.table === "bds_products"), false, "no lookup by ma_sp needed");
  const body = posts[0].body.p_payload;
  assert.equal(body.san_pham_id, uid(3));
  assert.equal(body.san_id, uid(5));
  assert.equal(body.gia.don_gia_chua_vat, 19831890);
  assert.equal(body.gia.tong_chua_vat, 1465576671);
  assert.equal(body.gia.tien_vat, 146557667.1);
  assert.equal(body.gia.tong_gom_vat, 1612134338.1);
  assert.equal(body.gia.gia_tri_hd, 1641528341.502);
});

test("booking from the lock screen forwards the lock id", () => {
  const { buildBookingPayload } = load("lib/bookingPayload.ts", {});
  const payload = buildBookingPayload({ ID: uid(3), MaSP: "SP01", LockId: uid(77) }, { maKH: "KH-1" }, null);
  assert.equal(payload.LockId, uid(77));
  assert.equal(payload.MaSan, null);
});
