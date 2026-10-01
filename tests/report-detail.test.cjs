// Mở chi tiết từ báo cáo: đợt tiến độ → chi tiết phiếu (cọc / hợp đồng), phiếu thu → chi tiết phiếu thu.
// Map phiếu thu theo web CashVoucherService.toUi / detailToUi + AccountingCloudService.hinhThucText.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const m = loadTs("lib/reportDetail.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const progress = (over = {}) => ({
  key: "p1-1",
  maPGC: "pgc-1",
  giaiDoan: "HDMB",
  tenDA: "BRG",
  kyHieu: "A1-1001",
  soHD: "HD-A1-1001",
  hoTenKH: "Nguyễn A",
  dotTT: "Đợt 1",
  ngayDenHan: "2026-10-01",
  phaiThu: 100,
  daThu: 0,
  conLai: 100,
  soNgayQuaHan: 0,
  trangThai: "HĐMB chờ duyệt",
  tongGiaTri: 1000,
  daThuHD: 300,
  diDong: "0912",
  ...over,
});

test("installment of a contract opens the contract detail keyed by the pgc", () => {
  const link = m.progressDocLink(progress());
  assert.equal(link.pathname, "/contract/[id]");
  assert.equal(link.params.id, "pgc-1");
  const data = JSON.parse(link.params.data);
  assert.equal(data.PhieuGiuChoId, "pgc-1");
  assert.equal(data.SoHDMB, "HD-A1-1001");
  assert.equal(data.TenKH, "Nguyễn A");
  assert.equal(data.KyHieu, "A1-1001");
  assert.equal(data.TenDA, "BRG");
  assert.equal(data.TenTT, "HĐMB chờ duyệt");
  assert.equal(data.TongGiaTriHDMB, 1000);
  assert.equal(data.DaThu, 300);
  assert.equal(data.DiDong, "0912");
});

test("capital contract (HDGV) also opens the contract detail", () => {
  assert.equal(m.progressDocLink(progress({ giaiDoan: "HDGV" })).pathname, "/contract/[id]");
});

test("installment of a deposit opens the deposit detail", () => {
  const link = m.progressDocLink(progress({ giaiDoan: "DATCOC", soHD: "DC-01" }));
  assert.equal(link.pathname, "/deposit/[id]");
  const data = JSON.parse(link.params.data);
  assert.equal(data.PhieuGiuChoId, "pgc-1");
  assert.equal(data.SoPhieu, "DC-01");
  assert.equal(data.KhachHang, "Nguyễn A");
  assert.equal(data.MaSanPham, "A1-1001");
});

test("row without a pgc id cannot be opened", () => {
  assert.equal(m.progressDocLink(progress({ maPGC: null })), null);
});

test("payment method text like web hinhThucText", () => {
  assert.equal(m.hinhThucText(true), "Chuyển khoản");
  assert.equal(m.hinhThucText("CK"), "Chuyển khoản");
  assert.equal(m.hinhThucText(false), "Tiền mặt");
  assert.equal(m.hinhThucText("tien mat"), "Tiền mặt");
  assert.equal(m.hinhThucText(""), null);
  assert.equal(m.hinhThucText("Ví điện tử"), "Ví điện tử");
});

test("voucher json (fn_cash_voucher_get_by_id) maps to the detail view, lines sorted", () => {
  const v = m.toVoucherDetail({
    id: "v1",
    so_phieu: "PT-01",
    ngay_phieu: "2026-10-01",
    nguoi_nop: "Người nộp",
    dia_chi: "Hà Nội",
    hinh_thuc: "CK",
    chung_tu_goc: "UNC 1",
    dien_giai: "Thu tiền đợt 1",
    so_tien: "2000",
    ngay_nhap: "2026-10-01T09:00:00",
    ten_nguoi_nhap: "Quản trị",
    khach: { ten_kh: null, ten_cong_ty: "Công ty X", dien_thoai: "0912" },
    du_an: { ten_da: "BRG" },
    chi_tiet: [
      { id: "d2", sort_order: 2, so_tien: 500, ky_hieu: "A2", dot_tt: 2, ten_loai: "Tiền HĐ", ten_nguon: "Vốn tự có", so_gd: "HD-2", pgc_id: "g2", ngay_thu_chi: "2026-10-01", dien_giai: "" },
      { id: "d1", sort_order: 1, so_tien: 1500, ky_hieu: "A1", dot_tt: 1, ten_loai: "Tiền HĐ", ten_nguon: null, so_gd: "HD-1", pgc_id: "g1", ngay_thu_chi: null, dien_giai: "x" },
    ],
  });
  assert.equal(v.soPhieu, "PT-01");
  assert.equal(v.tenKH, "Công ty X");
  assert.equal(v.tenDA, "BRG");
  assert.equal(v.hinhThuc, "Chuyển khoản");
  assert.equal(v.soTien, 2000);
  assert.equal(v.nguoiNhap, "Quản trị");
  assert.deepEqual(plain(v.lines.map((l) => l.id)), ["d1", "d2"]);
  assert.equal(v.lines[0].soTien, 1500);
  assert.equal(v.lines[0].soGiaoDich, "HD-1");
  assert.equal(v.lines[1].nguon, "Vốn tự có");
});

test("empty voucher payload maps to null", () => {
  assert.equal(m.toVoucherDetail(null), null);
  assert.equal(m.toVoucherDetail({}), null);
});
