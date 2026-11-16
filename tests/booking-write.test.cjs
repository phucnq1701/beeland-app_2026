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
  const source = fs.readFileSync(path.join(__dirname, "../sevicesSupabase/BookingService.ts"), "utf8");
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

test("createBooking goes through fn_nv_app_booking_tao only (wraps the web fn_booking_create)", async () => {
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
  assert.deepEqual(posts.map((p) => p.target), ["fn_nv_app_booking_tao"]);
  const body = posts[0].body.p_payload;
  // Công ty / người nhập / ngày / tiền / hạn giữ chỗ do máy chủ điền (63_app_nhan_vien/50) — app không gửi
  for (const k of ["ma_ctdk_uid", "nguoi_nhap", "nguoi_nhap_id", "ngay_giu_cho", "het_han_luc", "tien_giu_cho"]) {
    assert.equal(k in body, false, `${k} do máy chủ điền`);
  }
  assert.equal(body.san_pham_id, uid(3));
  assert.equal(body.ma_sp, "SP01");
  assert.equal(body.ky_hieu, "B2-608");
  assert.equal(body.khach_hang_id, uid(6), "ma_so_kh is resolved to the customer uuid");
  assert.equal(body.san_id, uid(5));
  assert.equal(body.gia.dien_tich, 73.9);
  assert.equal(body.gia.don_gia_gom_vat, 21815079);
  assert.equal(body.gia.tong_gom_vat, 1612134338.1);
  assert.equal(body.gia.phi_bao_tri, 29394003.402);
  assert.equal(body.gia.gia_tri_hd, 1641528341.502);
});

test("createBooking stops and returns the server message when fn_booking_create rejects", async () => {
  const message = 'Sản phẩm đang ở trạng thái "Booking chờ duyệt" nên không lập được phiếu giữ chỗ';
  const { service, posts } = load({ reject: { fn_nv_app_booking_tao: pgError(message) } });
  const res = await service.createBooking(bookingInput);
  assert.equal(res.status, 5000);
  assert.equal(res.message, message);
  assert.deepEqual(posts.map((p) => p.target), ["fn_nv_app_booking_tao"], "nothing written outside the RPC");
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

test("booking sales config: the highest-priority current price list, its policy and the product's price line", async () => {
  const { service, posts } = load({
    rpc: {
      fn_nv_app_bang_gia_hien_hanh: [
        { id: "pl-low", priority: 9, sales_policy_id: "cs9" },
        { id: "pl-top", priority: 1, sales_policy_id: "cs1" },
      ],
      fn_nv_app_chinh_sach_list: [
        { id: "cs1", pricing_config_id: "cf1", payment_schedule_id: "ps1", tien_booking: 50000000 },
        { id: "cs9" },
      ],
      fn_nv_app_gia_trong_bang_gia: { area: 70, unit_price: 20000000, vat_rate: 10, maintenance_rate: 2 },
    },
  });
  const cfg = await service.getBookingSalesConfig({ ID: uid(3), MaDA: uid(4), KyHieu: "B2-608", FormCode: "CAOTANG" });
  const call = (fn) => posts.find((p) => p.target === fn).body;
  // Công ty lấy từ phiên ở máy chủ — app không gửi
  assert.deepEqual({ ...call("fn_nv_app_bang_gia_hien_hanh") }, { p_du_an_id: uid(4), p_loai: "Chung cư" });
  assert.deepEqual({ ...call("fn_nv_app_chinh_sach_list") }, { p_du_an_id: uid(4), p_form_code: "CAOTANG" });
  assert.deepEqual({ ...call("fn_nv_app_gia_trong_bang_gia") }, { p_bang_gia_id: "pl-top", p_san_pham_id: uid(3), p_ma_sp: null });
  assert.equal(cfg.priceListId, "pl-top");
  assert.equal(cfg.policy.id, "cs1");
  assert.equal(cfg.priceItem.TongGiaChuaVAT, 1400000000);
  assert.equal(cfg.priceItem.TongGiaGomPBT, 1570800000);
});

test("booking sales config for low-rise units and projects without a price list", async () => {
  const low = load({ rpc: { fn_nv_app_bang_gia_hien_hanh: [], fn_nv_app_chinh_sach_list: [] } });
  const cfg = await low.service.getBookingSalesConfig({ ID: uid(3), MaDA: uid(4), KyHieu: "LK-01" });
  const pl = low.posts.find((p) => p.target === "fn_nv_app_bang_gia_hien_hanh").body;
  assert.equal(pl.p_loai, "Thấp tầng");
  assert.equal(low.posts.find((p) => p.target === "fn_nv_app_chinh_sach_list").body.p_form_code, "THAPTANG");
  assert.deepEqual({ ...cfg }, { priceListId: null, priceItem: null, policy: null });
  assert.equal(low.posts.some((p) => p.target === "fn_nv_app_gia_trong_bang_gia"), false);
  const failing = load({ reject: { fn_nv_app_bang_gia_hien_hanh: new Error("x") } });
  assert.deepEqual({ ...(await failing.service.getBookingSalesConfig({ ID: uid(3), MaDA: uid(4) })) }, {
    priceListId: null, priceItem: null, policy: null,
  });
});

test("createBooking: the chosen price list / policy / config / schedule are recorded (booking amount is decided by the server)", async () => {
  const { service, posts } = load({
    rpcResult: { phieu_giu_cho_id: uid(200), booking_id: uid(201), so_phieu: "BK-1" },
  });
  await service.createBooking({
    ...bookingInput, TienGiuCho: 50000000, MaDotGia: "pl-top", MaCS: "cs1", MaCSTong: "cf1", MaTDTT: "ps1",
  });
  const body = posts.find((p) => p.target === "fn_nv_app_booking_tao").body.p_payload;
  assert.equal("tien_giu_cho" in body, false);
  assert.equal(body.price_list_id, "pl-top");
  assert.equal(body.sales_policy_id, "cs1");
  assert.equal(body.tt_hop_dong.MaDotGia, "pl-top");
  assert.equal(body.tt_hop_dong.MaCS, "cs1");
  assert.equal(body.tt_hop_dong.MaTDTT, "ps1");
});

