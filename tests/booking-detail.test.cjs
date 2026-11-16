// Chi tiết booking (BookingService.getBookingEditDetail) trên 1 lời gọi fn_nv_app_booking_chi_tiet.
// Tra cứu (booking ⇄ phiếu giữ chỗ ⇄ số phiếu, phạm vi, che trường, cài đặt bán hàng) nằm ở máy chủ (SP 63_app_nhan_vien/51,
// đã thử trên BEELAND26); ở đây kiểm phần app còn làm: ghép dữ liệu ⇒ dạng màn dùng (ưu tiên giá, bản chụp khách, quà, cài đặt).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function fixture() {
  return {
    booking: {
      id: uid(1), ma_pgc_id: uid(2), so_phieu: "BK-MU3TLE8R", state: "PENDING",
      ma_sp_id: uid(30), ma_da_id: uid(40), ma_san_id: uid(50), khach_hang_id: uid(6), tong_gia: 900, tien_giu_cho: 10000000,
      het_han_luc: "2026-09-17T03:49:00+00:00", nhan_vien: "NV A",
    },
    doc: {
      ok: true,
      pgc: {
        id: uid(2), so_phieu_gc: "BK-MU3TLE8R", san_pham_id: uid(3), project_id: uid(4), san_id: uid(5), giai_doan: "GIUCHO",
        gia_tri_hd: 777, tien_coc: 888, tt_hop_dong: { MaDotGia: uid(7), MaCS: uid(8) },
        tt_khach_hang: { TenKH: "Khách snapshot", SoCMND: "123", DiDong: "0900000000" },
        payload: { UuTien: 1 }, khuyen_mai: [{ ID: uid(11), TenQuaTang: "Gói nội thất", GiaTri: 50000000 }],
      },
      san_pham: { id: uid(3), ma_sp: "SP3", ky_hieu: "B2-608" },
      du_an: { id: uid(4), ma_da_code: "DA01", ten_da: "Dự án" },
      khach_hang: { id: uid(6), ma_so_kh: "KH-6", ten_kh: "Khách hiện tại", cccd: "", dien_thoai: "" },
      trang_thai: { id: uid(13), item_code: "11", item_name: "Booking chờ duyệt", color_code: "#9923B7" },
    },
    san_pham_gia: { id: uid(3), ma_sp: "SP3", ky_hieu: "B2-608", tong_gia_tri_hdmb: 1000, dien_tich_thong_thuy: 70 },
    san: { id: uid(5), ten_cong_ty: "BEELAND" },
    chinh_sach: { id: uid(8), tien_booking: 12000000, pricing_config_id: uid(9), payment_schedule_id: uid(10) },
    bang_gia: { id: uid(7), name: "Bảng giá" },
    gia_bang_gia: { area: 73.9, unit_price_vat: 21815079, total_before_vat: 1469700170.073, vat_amount: 142434168.1,
      maintenance_amount: 29394003.402, total_payment: 1641528341.502 },
    cau_hinh_tinh_gia: { id: uid(9), ten: "Cấu hình" },
    lich_tt: { id: uid(10), name: "Tiến độ" },
    cai_dat: { thoi_gian_booking: "2", tien_booking: "5000000", tien_dat_coc: "6000000", booking_uu_tien: "true" },
    khuyen_mai: [{ id: uid(11), ten_khuyen_mai: "Ưu đãi", ten_qua_tang: "Tên mới", so_luong: 1, gia_tri: 60000000 }],
  };
}

function load(response, { fail } = {}) {
  const calls = [];
  const svc = loadTs("sevicesSupabase/BookingService.ts", { modules: {
    "@/services/nvApi": {
      callNv: async (fn, args) => { calls.push({ fn, args }); if (fail) throw fail; return response; },
      errorMessage: (e, f) => e?.message || f,
    },
    "@/services/SanPhamApi": { DuAnApi: { resolveId: async (x) => x }, SanPhamApi: { detail: async () => null } },
    "@react-native-async-storage/async-storage": { default: { getItem: async () => null } },
    "./axiosApiSupabase": { default: { get: async () => assert.fail("không đọc thẳng bảng"), post: async () => assert.fail("không gọi rest/v1") } },
    "./cloudTenant": {},
    "./customerLookup": {},
    "../lib/bookingPrice": loadTs("lib/bookingPrice.ts"),
    "../lib/listRpc": loadTs("lib/listRpc.ts"),
  }, globals: { setTimeout } }).BookingService;
  return { service: svc, calls };
}

test("B2-608: giá bảng giá, tham chiếu phiếu, bản chụp khách, quà tặng, cài đặt — 1 lời gọi", async () => {
  const { service, calls } = load(fixture());
  const { data } = await service.getBookingEditDetail("BK-MU3TLE8R");
  assert.deepEqual(calls.map((c) => [c.fn, c.args.p_id]), [["fn_nv_app_booking_chi_tiet", "BK-MU3TLE8R"]]);
  assert.equal(data.id, uid(1));
  assert.equal(data.maPGC, uid(2));
  assert.equal(data.tongGia, 1641528341.502);
  assert.equal(data.price.area, 73.9);
  assert.equal(data.price.vat_amount, 142434168.1);
  assert.equal(data.priceSource, "price_list_items");
  assert.equal(data.tienGiuCho, 12000000, "tiền booking của chính sách trước");
  assert.equal(data.thoiGianBooking, 2);
  assert.equal(data.hetHanLuc, "2026-09-17T03:49:00+00:00");
  assert.equal(data.uuTien, true, "UuTien của phiếu");
  assert.equal(data.san.tenCongTy, "BEELAND");
  assert.equal(data.product.ky_hieu, "B2-608");
  assert.equal(data.customer.tenKH, "Khách hiện tại");
  assert.equal(data.customer.cccd, "123", "khách thiếu CCCD ⇒ bản chụp trên phiếu");
  assert.equal(data.promotions[0].giaTri, 50000000, "giữ bản chụp quà tặng");
  assert.equal(data.promotions[0].tenQuaTang, "Gói nội thất");
  assert.equal(data.promotions[0].soLuong, 1, "thiếu số lượng ⇒ danh mục");
  assert.equal(data.maCSTong, uid(9));
  assert.equal(data.pricingConfig.name, "Cấu hình");
  assert.equal(data.paymentSchedule.name, "Tiến độ");
  assert.equal(data.maTT, "11");
  assert.equal(data.nhanVien, "NV A");
});

test("thiếu dòng bảng giá ⇒ giá căn, rồi tổng booking; tiền giữ chỗ: chính sách ⇒ booking ⇒ cài đặt", async () => {
  const r = fixture();
  r.gia_bang_gia = null;
  r.chinh_sach = null;
  let { data } = await load(r).service.getBookingEditDetail(uid(1));
  assert.equal(data.tongGia, 1000);
  assert.equal(data.price.area, 70);
  assert.equal(data.priceSource, "bds_products");
  assert.equal(data.tienGiuCho, 10000000);
  r.san_pham_gia.tong_gia_tri_hdmb = null;
  r.booking.tien_giu_cho = null;
  ({ data } = await load(r).service.getBookingEditDetail(uid(1)));
  assert.equal(data.tongGia, 900);
  assert.equal(data.tienGiuCho, 5000000);
  r.cai_dat.tien_booking = null;
  ({ data } = await load(r).service.getBookingEditDetail(uid(1)));
  assert.equal(data.tienGiuCho, 6000000);
});

test("số 0 được giữ; cấu hình chọn trên phiếu thắng cấu hình của chính sách", async () => {
  const r = fixture();
  r.gia_bang_gia.total_payment = 0;
  r.chinh_sach.tien_booking = 0;
  r.doc.pgc.tt_hop_dong.MaCSTong = uid(12);
  r.cau_hinh_tinh_gia = { id: uid(12), ten: "Đã chọn" };
  const { data } = await load(r).service.getBookingEditDetail(uid(1));
  assert.equal(data.tongGia, 0);
  assert.equal(data.tienGiuCho, 0);
  assert.equal(data.maCSTong, uid(12));
  assert.equal(data.pricingConfig.name, "Đã chọn");
});

test("ưu tiên: phiếu rồi cài đặt; không có khách hiện tại ⇒ bản chụp", async () => {
  const r = fixture();
  r.doc.khach_hang = null;
  let { data } = await load(r).service.getBookingEditDetail(uid(1));
  assert.equal(data.customer.tenKH, "Khách snapshot");
  r.doc.pgc.payload = {};
  r.cai_dat.booking_uu_tien = "false";
  ({ data } = await load(r).service.getBookingEditDetail(uid(1)));
  assert.equal(data.uuTien, false);
});

test("không thấy (null) khác lỗi tải (ném)", async () => {
  assert.equal((await load(null).service.getBookingEditDetail(uid(1))).data, null);
  await assert.rejects(load(fixture(), { fail: new Error("Không tìm thấy phiếu giữ chỗ trong phạm vi") }).service.getBookingEditDetail(uid(1)), /phạm vi/);
  assert.equal((await load(fixture()).service.getBookingEditDetail("  ")).data, null);
});
