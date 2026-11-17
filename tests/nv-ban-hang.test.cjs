// Luồng bán hàng trên API riêng app (BookingService ⇒ fn_nv_app_lock_* / booking_*).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const deq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function load(handler, { detail } = {}) {
  const calls = [];
  const nvApi = {
    callNv: async (fn, args) => { calls.push({ fn, args }); return handler(fn, args); },
    errorMessage: (e, f) => e?.message || f || "lỗi",
  };
  const svc = loadTs("services/BookingService.ts", { modules: {
    "@/services/nvApi": nvApi,
    "@/services/TepApi": { uploadFile: async () => "https://kho/tep.jpg" },
    "@/services/SanPhamApi": {
      DuAnApi: { resolveId: async (x) => (String(x) === "148" ? uid(4) : /^[0-9a-f-]{36}$/.test(String(x)) ? String(x) : null) },
      SanPhamApi: { detail: async () => detail ?? null },
    },
    "@react-native-async-storage/async-storage": { default: { getItem: async () => null } },
    "./axiosApiSupabase": { default: { get: async () => assert.fail("không gọi rest/v1"), post: async () => assert.fail("không gọi rest/v1") } },
    "./cloudTenant": { getCompanyId: async () => uid(99), getValidSupabaseJwt: async () => "jwt", getEmployeeId: async () => null, getCompanyCode: async () => "brg" },
    "./customerLookup": {},
    "../lib/bookingPrice": loadTs("lib/bookingPrice.ts"),
    "../lib/listRpc": loadTs("lib/listRpc.ts"),
  }, globals: { setTimeout } });
  return { svc: svc.BookingService, mod: svc, calls };
}

test("lock căn: 1 lời gọi fn_nv_app_lock_tao với uuid căn; trả giây + số phiếu như bản cũ", async () => {
  const { svc, calls } = load(() => ({ id: uid(7), so_phieu: "A-1/2026/11/3", so_giay: 1800 }));
  deq(await svc.createLock({ sanPhamId: uid(3), maSP: "SP1" }), { status: 2000, data: 1800, soPhieu: "A-1/2026/11/3", lockId: uid(7) });
  deq(calls, [{ fn: "fn_nv_app_lock_tao", args: { p_san_pham_id: uid(3) } }]);
});

test("lock căn: chưa có uuid ⇒ tra chi tiết căn theo mã; máy chủ từ chối ⇒ status 5000 + thông điệp máy chủ", async () => {
  const { svc, calls } = load(() => { throw new Error('Sản phẩm đang ở trạng thái "Đã Lock" nên không thực hiện được thao tác này'); },
    { detail: { product: { ID: uid(3) } } });
  const r = await svc.createLock({ maSP: "SP1" });
  assert.equal(r.status, 5000);
  assert.match(r.message, /Đã Lock/);
  deq(calls[0].args, { p_san_pham_id: uid(3) });
});

test("danh sách lock: mã dự án ⇒ uuid, gộp nhiều dự án theo ngày lock; con_lai do máy chủ tính", async () => {
  const { svc, calls } = load((fn, args) => ({ rows: args.p_du_an_id === uid(4)
    ? [{ id: "a", ky_hieu: "A-1", ma_sp_id: uid(1), ngay_lock: "2026-11-16T10:00:00Z", het_han_luc: "2026-11-16T10:30:00Z", con_lai: 600, state: "LOCKED", ten_da: "DA" }]
    : [{ id: "b", ky_hieu: "B-1", ma_sp_id: uid(2), ngay_lock: "2026-11-16T11:00:00Z", het_han_luc: "2026-11-16T11:30:00Z", con_lai: 0, state: "LOCKED" }] }));
  const r = await svc.listProductLocks({ maDA: ["148", uid(5)], keyword: " A " });
  deq(r.data.map((x) => [x.id, x.thoiGianConLai, x.TinhTrang, x.maSP, x.thoiGianLock]), [["b", 0, "expired", uid(2), 30], ["a", 10, "active", uid(1), 30]]);
  deq(calls.map((c) => c.args), [{ p_du_an_id: uid(4), p_tu_khoa: "A", p_trang: 1, p_so_dong: 500 }, { p_du_an_id: uid(5), p_tu_khoa: "A", p_trang: 1, p_so_dong: 500 }]);
});

test("chi tiết lock + hết hạn ⇒ endpoint riêng; lỗi hết hạn không chặn màn", async () => {
  const { svc, calls } = load((fn) => (fn === "fn_nv_app_lock_chi_tiet"
    ? { id: "a", ma_sp: "SP1", ky_hieu: "A-1", ten_da: "DA", ngay_lock: "2026-11-16T10:00:00Z", het_han_luc: "2026-11-16T10:30:00Z", con_lai: 125, state: "LOCKED" }
    : (() => { throw new Error("x"); })()));
  const d = await svc.getLockDetailCloud({ id: "a" });
  assert.equal(d.data.ThoiGianConLai, 125);
  assert.equal(d.data.maSP, "SP1");
  deq(await svc.sweepExpiredLocks(), { data: [] });
  deq(calls.map((c) => c.fn), ["fn_nv_app_lock_chi_tiet", "fn_nv_app_lock_het_han"]);
});

test("chứng từ booking: đọc / lưu qua endpoint riêng; đường dẫn tương đối ghép URL gốc kho máy chủ trả", async () => {
  const pgc = uid(2);
  const { svc, calls } = load((fn) => fn === "fn_nv_app_booking_chung_tu_list"
    ? { public_base_url: "https://fils.example", rows: [{ record_id: "c1", images: ["upload/a.jpg", "https://x/b.png", " "] }] }
    : { record_id: "c9", images: ["https://kho/tep.jpg"] });
  const list = await svc.getListImageGC({ MaPGC: pgc });
  deq(list.data.map((x) => [x.id, x.uri, x.name]), [["c1:0", "https://fils.example/upload/a.jpg", "a.jpg"], ["c1:1", "https://x/b.png", "b.png"]]);
  const saved = await svc.addBookingImages({ MaPGC: pgc, Images: ["https://kho/tep.jpg", ""] });
  deq(saved, { status: 2000, data: { recordId: "c9", images: ["https://kho/tep.jpg"] } });
  deq(calls.map((c) => [c.fn, c.args]), [["fn_nv_app_booking_chung_tu_list", { p_pgc_id: pgc }], ["fn_nv_app_booking_chung_tu_them", { p_pgc_id: pgc, p_images: ["https://kho/tep.jpg"] }]]);
  await assert.rejects(svc.addBookingImages({ MaPGC: pgc, Images: [] }), /Chưa có ảnh/);
});

test("tiền booking cho QR: cài đặt bán hàng của dự án tại ngày giữ chỗ (máy chủ chọn như web)", async () => {
  const { svc, calls } = load(() => ({ has_scope: true, setting: { tien_booking: 50000000.4 } }));
  const r = await svc.resolveBookingAmount(uid(4), "2026-11-15T05:50:03Z");
  assert.equal(r.amount, 50000000);
  assert.equal(calls[0].fn, "fn_nv_app_cai_dat_ban_hang");
  assert.equal(calls[0].args.p_du_an_id, uid(4));
  assert.match(calls[0].args.p_ngay, /^2026-11-1[56]$/);
  await assert.rejects(svc.resolveBookingAmount("x"), /chưa gắn dự án/);
});
