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

const compileExports = (file) => {
  const out = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: () => ({}) });
  return exports;
};

function load({ reject = {}, rpcResult, rpc = {}, settings } = {}) {
  const posts = [];
  const gets = [];
  const http = {
    get: async (url, { params }) => {
      const table = url.replace("rest/v1/", "");
      gets.push({ table, params });
      let data = (table === "cloud_sales_settings" && settings) || rows[table] || [];
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
      if (target.startsWith("rpc/") && target.slice(4) in rpc) {
        const r = rpc[target.slice(4)];
        return { data: typeof r === "function" ? r(body) : r };
      }
      return { data: [{ id: uid(500 + posts.length) }] };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../services/BookingService.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { log() {} },
    require: (name) => {
      if (name === "./axiosApiSupabase") return { default: http };
      // Bộ API riêng app: ghi lại lời gọi như post để các ca so được endpoint + body
      if (name === "@/services/nvApi") return {
        callNv: async (fn, args) => {
          posts.push({ target: fn, body: args });
          if (reject[fn]) throw reject[fn];
          if (fn === "fn_nv_app_booking_tao") return rpcResult;
          return fn in rpc ? (typeof rpc[fn] === "function" ? rpc[fn](args) : rpc[fn]) : null;
        },
        errorMessage: (e, f) => e?.response?.data?.message || e?.message || f,
      };
      if (name === "@/services/SanPhamApi") return { DuAnApi: { resolveId: async (x) => x }, SanPhamApi: { detail: async () => null } };
      if (name === "./cloudTenant") return {
        getCompanyId: async () => tenant,
        getValidSupabaseJwt: async () => "test-jwt",
        getEmployeeId: async () => null,
        getCompanyCode: async () => "C01",
      };
      if (name === "@react-native-async-storage/async-storage") {
        return { default: { getItem: async () => JSON.stringify({ ho_ten: "NV Test" }) } };
      }
      if (name === "../lib/bookingPrice") return compileExports("lib/bookingPrice.ts");
      // Khách qua RPC fn_customer_get_by_ids (bảng cloud_customers đã khoá đọc thẳng): so khớp ma_so_kh / di_dong
      if (name === "./customerLookup") return {
        getCustomersByRefs: async (refs) =>
          rows.cloud_customers.filter((r) => refs.includes(r.ma_so_kh) || refs.includes(r.di_dong)),
        getCustomersByIds: async (ids) => rows.cloud_customers.filter((r) => ids.includes(r.id)),
        withCustomers: async (x) => x,
      };
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

test("lock voucher month starts at 00:00 Vietnam time", () => {
  const { lockVoucherMonth } = loadExports();
  // 02:00 ngày 1/10 giờ VN = 19:00 UTC ngày 30/9
  const m = lockVoucherMonth(new Date("2026-09-30T19:00:00.000Z"));
  assert.deepEqual({ ...m }, { yyyy: 2026, mm: "10", fromIso: "2026-09-30T17:00:00.000Z" });
  // 23:30 ngày 31/12 giờ VN vẫn là tháng 12
  const d = lockVoucherMonth(new Date("2026-12-31T16:30:00.000Z"));
  assert.deepEqual({ ...d }, { yyyy: 2026, mm: "12", fromIso: "2026-11-30T17:00:00.000Z" });
});
