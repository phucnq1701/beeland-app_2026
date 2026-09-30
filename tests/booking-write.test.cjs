/* global __dirname */
// Lock căn / tạo booking phải DỪNG khi hệ thống từ chối – giống web:
//  - Lock: beeland/src/services/CloudWriteService.ts (lockProductCloudFirst)
//  - Booking: beeland/src/services/Product.js (addBookingAPI → rpc fn_booking_create)
// Tự chứa (không dùng tests/helpers) để cherry-pick riêng được.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tenant = uid(99);

const rows = {
  bds_products: [{ id: uid(3), ma_sp: "SP01", ky_hieu: "B2-608", ma_da: uid(4) }],
  cloud_customers: [{ id: uid(6), ma_ctdk: tenant, ma_so_kh: "KH-00006" }],
  cloud_sales_settings: [],
  cloud_bookings: [],
  cloud_catalogs: [{ id: uid(70), catalog_type: "pgc_trang_thai", ma_ctdk: "global", item_code: "1" }],
};

/** PostgREST trả lỗi RAISE EXCEPTION trong response.data.message */
const pgError = (message) => Object.assign(new Error("Request failed with status code 400"), {
  response: { status: 400, data: { code: "P0001", message } },
});

function load({ reject = {}, rpcResult } = {}) {
  const posts = [];
  const gets = [];
  const http = {
    get: async (url, { params }) => {
      const table = url.replace("rest/v1/", "");
      gets.push({ table, params });
      let data = rows[table] ?? [];
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string" && value.startsWith("eq.")) {
          data = data.filter((r) => String(r[key]) === value.slice(3));
        }
      }
      return { data: data.slice(0, Number(params.limit) || data.length), headers: {} };
    },
    post: async (url, body) => {
      const target = url.replace("rest/v1/", "");
      posts.push({ target, body });
      if (reject[target]) throw reject[target];
      if (target === "rpc/fn_booking_create") return { data: rpcResult };
      return { data: [{ id: uid(500 + posts.length) }] };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../sevicesSupabase/BookingService.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { log() {} },
    require: (name) => {
      if (name === "./axiosApiSupabase") return { default: http };
      if (name === "./cloudTenant") return {
        getCompanyId: async () => tenant,
        getValidSupabaseJwt: async () => "test-jwt",
        getEmployeeId: async () => null,
        getCompanyCode: async () => "C01",
      };
      if (name === "@react-native-async-storage/async-storage") {
        return { default: { getItem: async () => JSON.stringify({ ho_ten: "NV Test" }) } };
      }
      return { default: {} };
    },
  });
  return { service: exports.BookingService, posts, gets, exports };
}
const loadExports = () => load().exports;
const loadWithGets = () => load();

const bookingInput = {
  MaSP: "SP01", SanPhamId: uid(3), KyHieu: "B2-608", MaDA: uid(4), MaSan: uid(5),
  MaKH: "KH-00006", TenKH: "Khách", DTThongThuy: 73.9, DonGiaTT: 21815079,
  TongGiaGomVAT: 1612134338.1, PhiBaoTri: 29394003.402, TongGiaGomPBT: 1641528341.502,
  DonGiaDat: 0, TongGiaDat: 0, DonGiaXD: 0, ThanhTienXD: 0,
};

test("createLock stops and creates no lock row when the product transaction is rejected", async () => {
  const { service, posts } = load({
    reject: { "rpc/fn_product_transaction": pgError('Sản phẩm đang ở trạng thái "Booking chờ duyệt"') },
  });
  const res = await service.createLock({ maSP: "SP01", kyHieu: "B2-608", maDA: uid(4) });
  assert.equal(res.status, 5000);
  assert.equal(res.message, 'Sản phẩm đang ở trạng thái "Booking chờ duyệt"');
  assert.equal(posts.some((p) => p.target === "cloud_bookings"), false, "no LOCK row inserted");
});

test("createLock inserts the lock row after the product transaction succeeds", async () => {
  const { service, posts } = load();
  const res = await service.createLock({ maSP: "SP01", kyHieu: "B2-608", maDA: uid(4), minutes: 15 });
  assert.equal(res.status, 2000);
  assert.equal(res.data, 900);
  assert.deepEqual(posts.map((p) => p.target), ["rpc/fn_product_transaction", "cloud_bookings"]);
  assert.equal(posts[0].body.p_require_codes[0], "2");
  assert.equal(posts[1].body.loai_ct, "LOCK");
});

test("createBooking goes through fn_booking_create only, like the web", async () => {
  const { service, posts } = load({
    rpcResult: { phieu_giu_cho_id: uid(200), booking_id: uid(201), so_phieu: "BK-ABC123" },
  });
  const res = await service.createBooking(bookingInput);
  assert.equal(res.status, 2000);
  assert.equal(res.id, uid(201));
  assert.equal(res.data, uid(201));
  assert.equal(res.maPGC, uid(200));
  assert.equal(res.soPhieu, "BK-ABC123");
  // Một giao dịch phía máy chủ: không tự ghi bảng, không gọi fn_product_transaction riêng
  assert.deepEqual(posts.map((p) => p.target), ["rpc/fn_booking_create"]);
  const body = posts[0].body.p_payload;
  assert.equal(body.ma_ctdk_uid, tenant);
  assert.equal(body.san_pham_id, uid(3));
  assert.equal(body.ma_sp, "SP01");
  assert.equal(body.ky_hieu, "B2-608");
  assert.equal(body.khach_hang_id, uid(6), "ma_so_kh is resolved to the customer uuid");
  assert.equal(body.san_id, uid(5));
  assert.equal(body.nguoi_nhap, "NV Test");
  assert.equal(body.gia.dien_tich, 73.9);
  assert.equal(body.gia.don_gia_gom_vat, 21815079);
  assert.equal(body.gia.tong_gom_vat, 1612134338.1);
  assert.equal(body.gia.phi_bao_tri, 29394003.402);
  assert.equal(body.gia.gia_tri_hd, 1641528341.502);
});

test("createBooking stops and returns the server message when fn_booking_create rejects", async () => {
  const message = 'Sản phẩm đang ở trạng thái "Booking chờ duyệt" nên không lập được phiếu giữ chỗ';
  const { service, posts } = load({ reject: { "rpc/fn_booking_create": pgError(message) } });
  const res = await service.createBooking(bookingInput);
  assert.equal(res.status, 5000);
  assert.equal(res.message, message);
  assert.deepEqual(posts.map((p) => p.target), ["rpc/fn_booking_create"], "nothing written outside the RPC");
});

test("createBooking passes the lock id when booking from a lock", async () => {
  const { service, posts } = load({
    rpcResult: { phieu_giu_cho_id: uid(200), booking_id: uid(201), so_phieu: "BK-1" },
  });
  await service.createBooking({ ...bookingInput, LockId: uid(77) });
  assert.equal(posts[0].body.p_payload.lock_id, uid(77));
});

// Số phiếu lock KyHieu/YYYY/MM/STT: tháng tính theo giờ Việt Nam (web: new Date(yyyy, m, 1) giờ máy VN).
// Trước đây app đếm từ 00:00 UTC ngày 1 (= 07:00 VN) → 7 giờ đầu tháng số phiếu bị trùng.
test("lock voucher month starts at 00:00 Vietnam time", () => {
  const { lockVoucherMonth } = loadExports();
  // 02:00 ngày 1/10 giờ VN = 19:00 UTC ngày 30/9
  const m = lockVoucherMonth(new Date("2026-09-30T19:00:00.000Z"));
  assert.deepEqual({ ...m }, { yyyy: 2026, mm: "10", fromIso: "2026-09-30T17:00:00.000Z" });
  // 23:30 ngày 31/12 giờ VN vẫn là tháng 12
  const d = lockVoucherMonth(new Date("2026-12-31T16:30:00.000Z"));
  assert.deepEqual({ ...d }, { yyyy: 2026, mm: "12", fromIso: "2026-11-30T17:00:00.000Z" });
});

test("createLock counts this month's locks from 00:00 Vietnam time", async () => {
  const { service, gets } = loadWithGets();
  const res = await service.createLock({ maSP: "SP01", kyHieu: "B2-608", maDA: uid(4), minutes: 15 });
  assert.equal(res.status, 2000);
  const count = gets.find((g) => g.table === "cloud_bookings" && g.params.loai_ct === "eq.LOCK");
  const { lockVoucherMonth } = loadExports();
  assert.equal(count.params.created_at, `gte.${lockVoucherMonth(new Date()).fromIso}`);
});
