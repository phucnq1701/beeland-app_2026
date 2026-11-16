// Phần 1 — Dự án + Sản phẩm trên bộ API riêng app nhân viên (lib/nvSanPham.ts, services/SanPhamApi.ts, sevicesSupabase/*Service.ts).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const deq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const lib = loadTs("lib/nvSanPham.ts");

test("dự án: ảnh nền > icon > ảnh dự án; đường dẫn tương đối ghép máy chủ tệp; MaDA = mã dự án", () => {
  const p = lib.mapProject({ id: uid(1), ma_da_code: "148", ten_da: "Capital", dia_chi: "HN", ten_tt: "Đang bán",
    image_url: "upload/a.jpg", anh_icon: "https://x/icon.jpg", anh_background: null, anh_so_do: "/sodo.jpg" });
  assert.equal(p.MaDA, "148");
  assert.equal(p.id, uid(1));
  assert.equal(p.icon, "https://x/icon.jpg");
  assert.equal(p.image_url, "https://upload.beesky.vn/upload/a.jpg");
  assert.equal(p.mapImage, "https://upload.beesky.vn/sodo.jpg");
  assert.equal(p.is_active, true);
  assert.equal(lib.mapProject({ id: uid(2), ten_viet_tat: "VT" }).TenDA, "VT");
  assert.equal(lib.mapProject({ id: uid(2) }).MaDA, uid(2));
});

test("bộ lọc: khu + trạng thái (màu mặc định khi trống, giữ mã danh mục cho realtime)", () => {
  const f = lib.mapFilters({ khu: [{ id: uid(1), ma: "K1", ten: "" }], trang_thai: [{ id: uid(2), ma: "2", ten: "Mở bán", mau: null }] });
  deq(f.khu, [{ MaKhu: uid(1), TenKhu: "K1" }]);
  assert.equal(f.trangThai[0].ColorWeb, null);
  assert.equal(f.trangThai[0]._raw.item_code, "2");
  deq(lib.mapFilters(null), { khu: [], trangThai: [] });
});

test("ảnh căn: ảnh riêng (JSON / chuỗi phẩy) > mẫu loại căn > mẫu nhà > nền dự án > ảnh dự án > mặc định", () => {
  deq(lib.productImages({ hinh_anh_can: '["a.jpg",{"url":"https://h/b.jpg"}]' }), ["https://upload.beesky.vn/a.jpg", "https://h/b.jpg"]);
  deq(lib.productImages({ hinh_anh_can: "https://h/1.jpg, /2.jpg" }), ["https://h/1.jpg", "https://upload.beesky.vn/2.jpg"]);
  deq(lib.productImages({ hinh_anh_can: "[]", mau_loai_can: '{"Images":[{"path":"m1.jpg"}],"ImageUrl":"main.jpg"}' }),
    ["https://upload.beesky.vn/main.jpg", "https://upload.beesky.vn/m1.jpg"]);
  deq(lib.productImages({ mau_loai_can: '{"Images":[],"ImageUrl":""}', mau_nha: { Images: ["n.jpg"] } }), ["https://upload.beesky.vn/n.jpg"]);
  deq(lib.productImages({ nen_du_an: "https://f/bg.jpg", anh_du_an: "x.jpg" }), ["https://f/bg.jpg"]);
  deq(lib.productImages({ anh_du_an: "x.jpg" }), ["https://upload.beesky.vn/x.jpg"]);
  deq(lib.productImages(null), [lib.DEFAULT_BANNER_URL]);
});

test("chi tiết căn: đủ trường tạo booking, giây lock từ máy chủ, fallback giá theo tong_gom_pbt", () => {
  const d = lib.mapProductDetail({ id: uid(3), ma_sp: "SP1", ma_da: uid(4), ten_da: "DA", tong_gom_pbt: 100, tien_pbt: 5,
    don_gia_xay_dung: 7, tt_ma: "2", tt_ten: "Mở bán", tt_mau: "#0f0", khoa: { so_giay_con_lai: 125 } });
  assert.equal(d.ID, uid(3));
  assert.equal(d.TongGiaTriHDMB, 100);
  assert.equal(d.TongGiaGomVAT, 100);
  assert.equal(d.PhiBaoTri, 5);
  assert.equal(d.DonGiaXD, 7);
  assert.equal(d.MaTTCode, "2");
  assert.equal(d.ThoiGianConLai, 125);
  assert.equal(lib.mapProductDetail({ id: uid(3), khoa: { so_giay_con_lai: -4 } }).ThoiGianConLai, 0);
  assert.equal(lib.mapProductDetail(null), null);
});

test("quyền nút giao dịch: chỉ true khi máy chủ trả true (thiếu ⇒ ẩn)", () => {
  deq(lib.mapProductPerms({ quyen: { lock: true, booking: 1, phieu_tinh_gia: true } }),
    { lock: true, booking: false, deposit: false, investment: false, contract: false, priceSheet: true });
  deq(lib.mapProductPerms({}), { lock: false, booking: false, deposit: false, investment: false, contract: false, priceSheet: false });
});

test("sơ đồ: khu theo thứ tự, tầng theo danh mục, tầng lạ xếp sau theo tên, màu nền dự phòng theo trạng thái", () => {
  const T1 = uid(11), T2 = uid(12), TX = uid(19), K = uid(20);
  const g = lib.buildGrid({
    tang: [{ id: T1, ma: "01", ten: "Tầng 1" }, { id: T2, ma: "02", ten: "Tầng 2" }],
    vi_tri: [{ id: uid(30), ma: "01", ten: "" }],
    can: [
      { id: uid(1), ma_sp: "A", ky_hieu: "A-201", ma_khu: K, ten_khu: "Khu A", ma_tang: T2, ten_tang: "Tầng 2", vi_tri: uid(30), tt_mau: "#f00", tt_ten: "Lock" },
      { id: uid(2), ma_sp: "B", ky_hieu: "A-X", ma_khu: K, ten_khu: "Khu A", ma_tang: TX, ten_tang: "Áp mái", mau_nen: "#123" },
      { id: uid(3), ma_sp: "C", ky_hieu: "A-101", ma_khu: K, ten_khu: "Khu A", ma_tang: T1, ten_tang: "Tầng 1" },
      { id: uid(4), ma_sp: "D", ma_khu: null },
    ],
  });
  assert.equal(g.length, 1);
  assert.equal(g[0].tenKhu, "Khu A");
  deq(g[0].location, [{ maVT: uid(30), tenVT: "01" }]);
  deq(g[0].floor.map((f) => f.tenTang), ["Tầng 1", "Tầng 2", "Áp mái"]);
  const u = g[0].floor[1].detailFloor[0];
  assert.equal(u.MaSP, "A");
  assert.equal(u.MauNen, "#f00");
  assert.equal(u.ColorTT, "#f00");
  assert.equal(g[0].floor[2].detailFloor[0].MauNen, "#123");
});

/* ---------- service: gọi đúng endpoint + tham số (không còn rest/v1) ---------- */

function services(handler) {
  const calls = [];
  const nvApi = {
    callNv: async (fn, args) => { calls.push({ fn, args }); return handler(fn, args); },
    errorMessage: (e) => e?.message || "lỗi",
  };
  const san = loadTs("services/SanPhamApi.ts", { modules: { "@/lib/nvSanPham": lib, "./nvApi": nvApi } });
  const projectScope = loadTs("lib/projectScope.ts");
  const product = loadTs("sevicesSupabase/ProductService.ts", { modules: {
    "../lib/projectScope": projectScope, "@/services/nvApi": nvApi, "@/services/SanPhamApi": san,
    "./axiosApiSupabase": { default: { get: async () => { throw new Error("không được gọi rest/v1"); } } },
    "./cloudTenant": {},
  } });
  const project = loadTs("sevicesSupabase/ProjectService.ts", { modules: { "@/services/nvApi": nvApi, "@/services/SanPhamApi": san } });
  const price = loadTs("sevicesSupabase/PriceServices.ts", { modules: {
    "@/services/nvApi": nvApi, "@/services/SanPhamApi": san, "./ProductService": product,
  } });
  const filter = loadTs("sevicesSupabase/FilterService.ts", { modules: { "@/services/nvApi": nvApi, "@/services/SanPhamApi": san } });
  return { calls, san, product, project, price, filter };
}

const PROJECTS = { rows: [{ id: uid(4), ma_da_code: "148", ten_da: "DA 148" }], total: 1 };

test("danh sách căn: mã dự án ⇒ uuid (qua danh sách dự án), offSet ⇒ trang, đúng tham số API", async () => {
  const s = services((fn) => fn === "fn_nv_app_du_an_list" ? PROJECTS
    : { rows: [{ id: uid(9), ma_sp: "SP9", ky_hieu: "A-9", tt_ten: "Mở bán", tt_mau: "#0f0", tong_gom_pbt: 1 }], total: 31 });
  const r = await s.product.ProductService.getProducts({ MaDA: 148, MaKhu: uid(8), MaTT: "khong-phai-uuid", FormCode: "CAOTANG",
    KyHieu: " A-9 ", Limit: 30, offSet: 31 });
  assert.equal(r.total, 31);
  assert.equal(r.data[0].MaSP, "SP9");
  assert.equal(r.data[0].ColorTT, "#0f0");
  const call = s.calls.find((c) => c.fn === "fn_nv_app_san_pham_list");
  deq(call.args, { p_du_an_id: uid(4), p_khu_id: uid(8), p_trang_thai_id: null, p_loai: "CAOTANG", p_tu_khoa: "A-9", p_trang: 2, p_so_dong: 30 });
});

test("danh sách căn: tất cả dự án (-1) ⇒ không lọc dự án; mã dự án không thấy ⇒ rỗng, không gọi danh sách", async () => {
  const s = services((fn) => fn === "fn_nv_app_du_an_list" ? PROJECTS : { rows: [], total: 0 });
  await s.product.ProductService.getProducts({ MaDA: -1 });
  assert.equal(s.calls[0].args.p_du_an_id, null);
  const s2 = services((fn) => fn === "fn_nv_app_du_an_list" ? PROJECTS : assert.fail("không được gọi"));
  deq(await s2.product.ProductService.getProducts({ MaDA: "999" }), { data: [], total: 0 });
});

test("lỗi máy chủ ⇒ trả kèm error (màn báo được), không ném làm treo màn", async () => {
  const s = services(() => { throw new Error("Phiên đăng nhập hết hạn"); });
  const r = await s.product.ProductService.getProducts({ MaDA: uid(4) });
  assert.equal(r.error, "Phiên đăng nhập hết hạn");
  const p = await s.project.ProjectService.getProjects({});
  assert.equal(p.error, "Phiên đăng nhập hết hạn");
  deq(p.data, []);
});

test("dự án: mặc định 200 dòng (trước 50 ⇒ cắt cụt), từ khoá gửi lên máy chủ", async () => {
  const s = services(() => PROJECTS);
  const r = await s.project.ProjectService.getProjects({ keyword: " cap " });
  assert.equal(r.data[0].MaDA, "148");
  deq(s.calls[0].args, { p_tu_khoa: "cap", p_trang: 1, p_so_dong: 200 });
  await s.project.ProjectService.getProjects({ limit: 5 });
  assert.equal(s.calls[1].args.p_so_dong, 5);
});

test("chi tiết: 1 lời gọi dùng chung cho chi tiết + ảnh + giá (gọi song song)", async () => {
  const s = services(() => ({ id: uid(3), ma_sp: "SP1", anh: { anh_du_an: "a.jpg" }, gia: { id: uid(7), area: 10, unit_price: 2, vat_rate: 10 },
    quyen: { lock: true }, khoa: { so_giay_con_lai: 60 } }));
  const [d, b, g] = await Promise.all([
    s.product.ProductService.getDetailProducts({ maSP: "SP1" }),
    s.product.ProductService.getBannerProduct({ maSP: "SP1" }),
    s.price.PriceServices.getActivePriceForProduct({ productId: "SP1" }),
  ]);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].fn, "fn_nv_app_san_pham_chi_tiet");
  deq(s.calls[0].args, { p_id: "SP1" });
  assert.equal(d.data.ThoiGianConLai, 60);
  assert.equal(d.perms.lock, true);
  deq(b.data, [{ HinhAnh: "https://upload.beesky.vn/a.jpg" }]);
  assert.equal(g.data.total_before_vat, 20); // computeActivePriceTotals như web
  assert.equal(g.data.total_payment, 22);
});

test("chi tiết: không thấy ⇒ data null; tải lại (fresh) là request mới", async () => {
  const s = services(() => null);
  deq(await s.product.ProductService.getDetailProducts({ maSP: "X" }), { data: null, perms: null });
  await s.product.ProductService.getDetailProducts({ maSP: "X", fresh: true });
  assert.equal(s.calls.length, 2);
});

test("sơ đồ + khu + trạng thái qua API riêng", async () => {
  const s = services((fn, args) => {
    if (fn === "fn_nv_app_du_an_list") return PROJECTS;
    if (fn === "fn_nv_app_so_do") return { tang: [], vi_tri: [], can: [{ id: uid(1), ma_sp: "A", ma_khu: uid(2), ten_khu: "K" }] };
    if (fn === "fn_nv_app_san_pham_bo_loc") return args.p_du_an_id
      ? { khu: [{ id: uid(2), ten: "K" }], trang_thai: [] } : { khu: [], trang_thai: [{ id: uid(5), ma: "2", ten: "Mở bán", mau: "#0f0" }] };
    return null;
  });
  const grid = await s.price.PriceServices.getBlock({ maDA: "148" });
  assert.equal(grid.data[0].tenKhu, "K");
  deq(s.calls.find((c) => c.fn === "fn_nv_app_so_do").args, { p_du_an_id: uid(4) });
  deq((await s.product.ProductService.getKhuVuc({ maDA: uid(4) })).data, [{ MaKhu: uid(2), TenKhu: "K" }]);
  assert.equal((await s.filter.FilterService.getStatusSP({})).data[0].TenTT, "Mở bán");
  assert.equal((await s.filter.FilterService.getStatusSP({})).data[0].ColorWeb, "#0f0");
});
