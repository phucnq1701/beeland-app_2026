/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tenant = uid(99);

function fixture() {
  return {
    cloud_bookings: [{
      id: uid(1), ma_pgc_id: uid(2), so_phieu: "BK-MU3TLE8R",
      loai_ct: "BOOKING", ma_ctdk_id: tenant, state: "PENDING",
      ma_sp_id: uid(30), ma_da_id: uid(40), ma_san_id: uid(50),
      khach_hang_id: uid(6), tong_gia: 900, tien_giu_cho: 10000000,
      het_han_luc: "2026-09-17T03:49:00+00:00", raw: { UuTien: "0" },
    }],
    cloud_pgc_phieu_giucho: [{
      id: uid(2), ma_ctdk_uid: tenant, so_phieu_gc: "BK-MU3TLE8R",
      san_pham_id: uid(3), project_id: uid(4), san_id: uid(5),
      gia_tri_hd: 777, tien_coc: 888,
      tt_hop_dong: { MaDotGia: uid(7), MaCS: uid(8) },
      tt_khach_hang: { TenKH: "Khách snapshot", SoCMND: "123", DiDong: "0900000000" },
      payload: { UuTien: 1 },
      khuyen_mai: [{ ID: uid(11), TenQuaTang: "Gói nội thất", GiaTri: 50000000 }],
    }],
    bds_products: [{ id: uid(3), ky_hieu: "B2-608", tong_gia_tri_hdmb: 1000, dien_tich_thong_thuy: 70 }],
    da_projects: [{ id: uid(4), ten_da: "Dự án", ma_da_code: "DA01" }],
    dm_companies: [{ id: uid(5), ten_cong_ty: "BEELAND" }],
    cloud_customers: [{ id: uid(6), ten_kh: "Khách hiện tại", cccd: "", dien_thoai: "" }],
    price_lists: [{ id: uid(7), name: "Bảng giá", is_active: false }],
    da_sales_policies: [{ id: uid(8), tien_booking: 12000000, pricing_config_id: uid(9), payment_schedule_id: uid(10) }],
    cloud_pricing_configs: [{ id: uid(9), name: "Cấu hình" }],
    da_payment_schedules: [{ id: uid(10), name: "Tiến độ", so_dot: 5 }],
    da_promotions: [{ id: uid(11), ten_khuyen_mai: "Ưu đãi", ten_qua_tang: "Tên mới", so_luong: 1, gia_tri: 60000000 }],
    price_list_items: [{
      price_list_id: uid(7), product_id: uid(3), area: 73.9,
      unit_price_vat: 21815079, total_before_vat: 1469700170.073,
      vat_amount: 142434168.1, maintenance_amount: 29394003.402,
      total_payment: 1641528341.502,
    }],
    cloud_sales_settings: [{
      ma_da: uid(4), ap_dung: true, thoi_gian_booking: 2,
      tien_booking: 5000000, tien_dat_coc: 6000000, booking_uu_tien: true,
    }],
  };
}

function load(rows, { jwt = true, failTable } = {}) {
  const calls = [];
  const http = {
    get: async (url, { params }) => {
      const table = url.replace("rest/v1/", "");
      calls.push({ table, params });
      if (table === failTable) throw new Error("HTTP failed");
      assert.equal(params.select.includes("!"), false, "No FK embeds");
      if (table === "cloud_sales_settings") {
        assert.match(params.ma_da, /^eq\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          "cloud_sales_settings.ma_da requires a project UUID, not ma_da_code");
      }
      let data = rows[table] ?? [];
      for (const [key, value] of Object.entries(params)) {
        if (value.startsWith("eq.")) data = data.filter((r) => String(r[key]) === value.slice(3));
        if (value === "is.true") data = data.filter((r) => r[key] === true);
      }
      return { data: data.slice(0, Number(params.limit)) };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../sevicesSupabase/BookingService.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console,
    require: (name) => {
      if (name === "./axiosApiSupabase") return { default: http };
      if (name === "./cloudTenant") return {
        getCompanyId: async () => tenant,
        getValidSupabaseJwt: async () => jwt ? "test-jwt" : null,
      };
      return { default: {} };
    },
  });
  return { service: exports.BookingService, calls };
}

test("B2-608: price item, lifecycle references, customer snapshot, gifts, settings", async () => {
  const { service, calls } = load(fixture());
  const { data } = await service.getBookingEditDetail("BK-MU3TLE8R");
  assert.equal(data.tongGia, 1641528341.502);
  assert.equal(data.price.area, 73.9);
  assert.equal(data.price.vat_amount, 142434168.1);
  assert.equal(data.tienGiuCho, 12000000);
  assert.equal(data.thoiGianBooking, 2);
  assert.equal(data.hetHanLuc, "2026-09-17T03:49:00+00:00");
  assert.equal(data.uuTien, false);
  assert.equal(data.san.tenCongTy, "BEELAND");
  assert.equal(data.product.ky_hieu, "B2-608");
  assert.equal(data.customer.tenKH, "Khách hiện tại");
  assert.equal(data.customer.cccd, "123");
  assert.equal(data.promotions[0].giaTri, 50000000);
  assert.equal(data.promotions[0].tenQuaTang, "Gói nội thất");
  assert.equal(data.promotions[0].soLuong, 1);
  assert.equal(data.maCSTong, uid(9));
  assert.equal(data.paymentSchedule.name, "Tiến độ");
  assert.equal(calls[0].params.ma_ctdk_id, `eq.${tenant}`);
  assert.equal(calls.find((c) => c.table === "cloud_pgc_phieu_giucho").params.ma_ctdk_uid, `eq.${tenant}`);
  const settings = calls.find((c) => c.table === "cloud_sales_settings").params;
  assert.equal(settings.ma_da, `eq.${uid(4)}`);
  assert.match(settings.and, /tu_ngay\.lte\./);
  assert.match(settings.and, /den_ngay\.gte\./);
});

test("project code 2 uses UUID settings filter and retains booking employee", async () => {
  const rows = fixture();
  rows.da_projects[0].ma_da_code = "2";
  rows.cloud_bookings[0].nhan_vien = "Nhân viên kiểm thử";
  const { service, calls } = load(rows);
  const { data } = await service.getBookingEditDetail(uid(1));
  assert.equal(data.nhanVien, "Nhân viên kiểm thử");
  assert.equal(data.thoiGianBooking, 2);
  assert.equal(calls.find((c) => c.table === "cloud_sales_settings").params.ma_da, `eq.${uid(4)}`);
});

test("accepts booking UUID and lifecycle UUID", async () => {
  for (const id of [uid(1), uid(2)]) {
    const { data } = await load(fixture()).service.getBookingEditDetail(id);
    assert.equal(data.id, uid(1));
    assert.equal(data.maPGC, uid(2));
  }
});

test("fallback lifecycle by receipt number, not unrelated rows", async () => {
  const rows = fixture();
  rows.cloud_bookings[0].ma_pgc_id = null;
  const { data } = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(data.maPGC, uid(2));
  assert.equal(data.price.area, 73.9);
});

test("missing price item uses product, then booking total; never lifecycle price/deposit", async () => {
  const rows = fixture();
  rows.price_list_items = [];
  rows.da_sales_policies = [];
  let result = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(result.data.tongGia, 1000);
  assert.equal(result.data.price.area, 70);
  assert.equal(result.data.priceSource, "bds_products");
  assert.equal(result.data.tienGiuCho, 10000000);
  rows.bds_products[0].tong_gia_tri_hdmb = null;
  rows.cloud_bookings[0].tien_giu_cho = null;
  result = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(result.data.tongGia, 900);
  assert.equal(result.data.tienGiuCho, 5000000);
  rows.cloud_sales_settings[0].tien_booking = null;
  result = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(result.data.tienGiuCho, 6000000);
});

test("zero values and explicit contract configuration are retained", async () => {
  const rows = fixture();
  rows.price_list_items[0].total_payment = 0;
  rows.da_sales_policies[0].tien_booking = 0;
  rows.cloud_pgc_phieu_giucho[0].tt_hop_dong.MaCSTong = uid(12);
  rows.cloud_pricing_configs.push({ id: uid(12), name: "Đã chọn" });
  const { data } = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(data.tongGia, 0);
  assert.equal(data.tienGiuCho, 0);
  assert.equal(data.pricingConfig.name, "Đã chọn");
});

test("priority fallback: payload then settings; missing customer uses snapshot", async () => {
  const rows = fixture();
  rows.cloud_customers = [];
  rows.cloud_bookings[0].raw = {};
  let result = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(result.data.uuTien, true);
  assert.equal(result.data.customer.tenKH, "Khách snapshot");
  rows.cloud_pgc_phieu_giucho[0].payload = {};
  rows.cloud_sales_settings[0].booking_uu_tien = false;
  result = await load(rows).service.getBookingEditDetail(uid(1));
  assert.equal(result.data.uuTien, false);
});

test("not found is distinct from HTTP/auth failure", async () => {
  assert.equal((await load({}).service.getBookingEditDetail(uid(1))).data, null);
  await assert.rejects(load(fixture(), { failTable: "cloud_bookings" }).service.getBookingEditDetail(uid(1)), /HTTP failed/);
  const { service, calls } = load(fixture(), { jwt: false });
  await assert.rejects(service.getBookingEditDetail(uid(1)), /đăng nhập/);
  assert.equal(calls.length, 0);
});