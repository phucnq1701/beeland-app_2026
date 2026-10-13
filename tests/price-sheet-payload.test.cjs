// Dữ liệu lưu phiếu tính giá (lib/priceSheetPayload.ts) – cùng định dạng web (PriceSheetForm.handleSave +
// phieu-tinh-gia/index.handlePriceSheetSaved) để web mở lại / in được; số liệu đối chiếu phiếu thật BRG (PTG-0006).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const evalLib = loadTs("lib/formulaEval.ts");
const formulas = loadTs("lib/priceSheetFormulas.ts", { modules: { "./formulaEval": evalLib } });
const calcLib = loadTs("lib/priceSheetCalc.ts", { modules: { "./priceSheetFormulas": formulas } });
const sched = loadTs("lib/priceSheetSchedule.ts", { modules: { "./priceSheetFormulas": formulas } });
const bookingPrice = loadTs("lib/bookingPrice.ts");
const P = loadTs("lib/priceSheetPayload.ts", {
  modules: { "./bookingPrice": bookingPrice, "./priceSheetSchedule": sched, "./priceSheetCalc": {}, "./priceSheetFormulas": {} },
});
const status = loadTs("lib/priceSheetStatus.ts");
const print = loadTs("lib/priceSheetPrint.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const PRODUCT = P.mapProductRow({
  id: "11111111-1111-1111-1111-111111111111",
  ma_sp: "CT2-1",
  ky_hieu: "A1-12B09",
  form_code: "CAOTANG",
  ma_da: "6a7ea4c6-63ca-46c2-ab42-5d15ddd45fdf",
  da: { ten_da: "BRG Smart City" },
  dien_tich_thong_thuy: 54.8,
  dg_dat_pb: 2971006,
  ty_le_vat: 10,
  ty_le_phi_bao_tri: 2,
  don_gia_da_vat: 113147200,
  tong_gia_chua_vat: 5636787781.818181,
  tong_gia_da_vat: 6200466560,
  tien_vat: 547397665.3018181,
  tien_phi_bao_tri: 112735755.63636363,
  tong_gom_pbt: 6313202315.636364,
});

function brgRounds() {
  const tpl = formulas.buildRoundTemplate(
    [1, 2, 3].map((i) => ({
      ID: `r${i}`,
      Name: `CK${i}`,
      Details: [
        { Code: "TongCK", Formula: i === 1 ? "TienCKTienMat + GiaGocGomVAT * TyLeCK / 100" : "TienCKTienMat + TongGomVAT_Prev* TyLeCK / 100" },
        { Code: "TongChuaVAT", Formula: `(${i === 1 ? "TongGomVAT" : "TongGomVAT_Prev"}+DienTichThongThuy * DGDatPB*10/100)*100/110` },
        { Code: "VAT", Formula: "(TongChuaVAT - DienTichThongThuy * DGDatPB)*10/100" },
        { Code: "TongGomVAT", Formula: i === 1 ? "GiaGocGomVAT - TongCK" : "TongGomVAT_Prev- TongCK" },
        { Code: "PhiBaoTri", Formula: "TongChuaVAT * 2/100" },
        { Code: "TongGiaTri", Formula: `${i === 1 ? "GiaGocGomVAT" : "TongGomVAT_Prev"} - TongCK+ TongChuaVAT * 2/100` },
      ],
    })),
    false
  );
  const r = formulas.applyPolicyDetailsToRounds(
    [
      { TenChietKhau: "Mở bán", CKPT: 2, HeSo: 1, MaCK: "ck-1" },
      { TenChietKhau: "ck booking sớm", CKPT: 5, HeSo: 1, MaCK: "ck-2" },
      { TenChietKhau: "Ck thanh toán thường", CKPT: 2, HeSo: 2, MaCK: "ck-3" },
    ],
    tpl
  );
  r[1].tienCK = 10000000;
  r[2].tienCK = 10000000;
  return r;
}

function brgDraft() {
  const form = { ...P.formFromProduct(PRODUCT, new Date(2026, 8, 16, 14, 56, 1)), dienTichThongThuy: 0, tienCoc: 200000000 };
  const rounds = brgRounds();
  const calc = calcLib.computePriceSheet(form, rounds);
  const tpl = [30, 40, 15, 15].map((ty, i) => ({
    DotTT: i + 1, SoNgay: [10, 30, 60, 90][i], MaLoai: 1, TyLeTT: ty, TyLeVAT: 0, TyLePBT: i === 2 ? 100 : 0,
    TuongUng: "TongGiaGomVAT * PhanTramTT / 100", TienVAT: "0", PhiBaoTri: i === 2 ? "PhiBaoTri" : "0",
    TongCong: i === 2 ? "TongGiaGomVAT * PhanTramTT / 100 + PhiBaoTri" : "TongGiaGomVAT * PhanTramTT / 100",
  }));
  const schedule = sched.recalcPaymentScheduleSequential(sched.scheduleRowsFromTemplate(tpl, false, 10), {
    calculations: calc,
    rawTongGiaChuaVAT: form.rawTongGiaChuaVAT,
  });
  return {
    calc,
    draft: {
      product: PRODUCT,
      form,
      priceListId: "pl-1",
      policyId: "pol-1",
      policyName: "CHÍNH SÁCH BH T9",
      policyConfigId: "cfg-1",
      policyDetails: [],
      rounds,
      templateId: "tpl-1",
      templateName: "TT vốn vay ngân hàng",
      schedule,
      promotions: [{ ID: "km-1", TenQuaTang: "Quà tặng vàng", SoLuong: 50, GiaTri: 0 }],
      customer: P.customerFromRow({ id: "kh-1", is_personal: true, ten_kh: "Khách A", di_dong: "0900000000" }),
    },
  };
}

test("mapProductRow + formFromProduct: giá gốc của căn như form web", () => {
  assert.equal(PRODUCT.KyHieu, "A1-12B09");
  assert.equal(PRODUCT.TenDA, "BRG Smart City");
  const f = P.formFromProduct(PRODUCT);
  assert.equal(f.isLowRise, false);
  assert.equal(f.rawTongGiaDaVAT, 6200466560);
  assert.equal(f.donGiaSuDungDat, 113147200);
  assert.equal(f.donGiaDatPhanBo, 2971006);
  assert.equal(f.tienCoc, 50000000);
  assert.equal(f.loaiSP, "Chung cư");
});

test("applyPriceListItem: bảng giá ưu tiên, thiếu thì giá sản phẩm; không có dòng ⇒ giá sản phẩm", () => {
  const f = P.formFromProduct(PRODUCT);
  const withItem = P.applyPriceListItem(f, { total_after_vat: 7000000000, unit_price_vat: 120000000, vat_rate: 8, maintenance_amount: null }, PRODUCT);
  assert.equal(withItem.rawTongGiaDaVAT, 7000000000);
  assert.equal(withItem.donGiaSuDungDat, 120000000);
  assert.equal(withItem.tyLeVAT, 8);
  assert.equal(withItem.rawTienPhiBaoTri, 112735755.63636363);
  const none = P.applyPriceListItem({ ...f, rawTongGiaDaVAT: 1 }, null, PRODUCT);
  assert.equal(none.rawTongGiaDaVAT, 6200466560);
});

test("cấu hình tính giá sản phẩm: priceCodeValues → computeAllFormulas → applyPriceInputs (mã trùng đích: mã sau thắng)", () => {
  const f = P.formFromProduct(PRODUCT);
  const fields = formulas.getPriceFieldsFromApi(
    [{ ID: "c", Status: true, Detail: [
      { Code: "DonGiaDaVAT", Type: "TUNHAP", OrderBy: "1" },
      { Code: "DienTichThongThuy", Type: "TUNHAP", OrderBy: "0" },
      { Code: "TongGiaDaVAT", Type: "CONGTHUC", Formula: "DonGiaDaVAT * DienTichThongThuy", OrderBy: "9" },
      { Code: "TongThanhToan", Type: "CONGTHUC", Formula: "TongGiaDaVAT + 1", OrderBy: "13" },
    ] }],
    "c"
  );
  const next = formulas.computeAllFormulas(P.priceCodeValues(f), fields);
  const out = P.applyPriceInputs(f, next);
  assert.equal(out.rawTongGiaDaVAT, Math.round(113147200 * 54.8));
  // TongThanhToan → rawTongGomPBT nhưng TongGiaTriHD (cùng đích, đứng sau) giữ giá trị cũ – như web
  assert.equal(out.rawTongGomPBT, 6313202315.636364);
});

test("buildPayload: ChinhSach / GiaTriHopDongSauCK / LichThanhToan trùng số phiếu thật web đã lưu", () => {
  const { calc, draft } = brgDraft();
  const { payload, snapshot } = P.buildPayload(draft, calc);
  const tt = payload.TTHopDong;
  assert.equal(tt.MaSP, "CT2-1");
  assert.equal(tt.MaCan, "A1-12B09");
  assert.equal(tt.MaDA, PRODUCT.MaDA);
  assert.equal(tt.MaCS, "pol-1");
  assert.equal(tt.MaDotGia, "pl-1");
  assert.equal(tt.CauHinhTinhGiaID, "cfg-1");
  assert.equal(tt.NgayKy, "2026-09-16T14:56:01");
  assert.equal(tt.TienCoc, 200000000);
  assert.equal(tt.GiaTriHopDong.TongGomVAT, 6200466560);
  assert.equal(tt.GiaTriHopDong.TongChuaVAT, 6200466560 / 1.1);
  assert.equal(tt.GiaTriHopDongSauCK.TongGiaGomVATPBT, 5742156850.328437);
  assert.equal(tt.GiaTriHopDongSauCK.TongGomVAT, 5637381680.0128);
  assert.equal(tt.GiaTriHopDongSauCK.TienPhiBaoTri, 104775170.31563637);
  assert.deepEqual(
    plain(payload.ChinhSach.map((c) => [c.CKPT, c.CKDonGia, c.CKTien, c.TongGiaGomVAT, c.TongGiaTriHDMB, c.PhiBaoTri, c.MaCSTong])),
    [
      [2, null, 124009331.2, 6076457228.8, 6186938269.323637, 110481040.52363636, "cfg-1"],
      [5, 10000000, 313822861.44, 5762634367.360001, 5873115407.883637, 110481040.52363636, "cfg-1"],
      [2, 10000000, 125252687.3472, 5637381680.0128, 5742156850.328437, 104775170.31563637, "cfg-1"],
    ]
  );
  assert.deepEqual(
    plain(payload.LichThanhToan.map((l) => [l.DotTT, l.NgayTT, l.TuongUng, l.PhiBT, l.SoTien, l.MaTH])),
    [
      [1, "2026-09-26T00:00:00+07:00", 1691214504.00384, 0, 1691214504.00384, "tpl-1"],
      [2, "2026-10-16T00:00:00+07:00", 2254952672.0051203, 0, 2254952672.0051203, "tpl-1"],
      [3, "2026-11-15T00:00:00+07:00", 845607252.00192, 104775170.31563637, 950382422.3175564, "tpl-1"],
      [4, "2026-12-15T00:00:00+07:00", 845607252.00192, 0, 845607252.00192, "tpl-1"],
    ]
  );
  assert.deepEqual(plain(payload.KhuyenMai), [{ MaPGC: null, PromotionID: "km-1", SoLuong: 50, TieuDe: "Quà tặng vàng", SoTien: 0 }]);
  assert.equal(payload.TTKhachHang.MaKH, "kh-1");
  assert.equal(payload.TTKhachHang.IsPersonal, true);
  assert.equal(plain(payload.TTKhachHang.ListKhachHang).length, 0);
  assert.equal(payload._snapshot, snapshot);
  assert.equal(snapshot.totals.totalContractValue, 5742156850.328437);
  assert.equal(snapshot.totals.discountAmount, 563084879.9872);
  assert.equal(snapshot.totals.discountPercent, 9.99);
  assert.deepEqual(plain(snapshot.discounts.map((x) => x.amount)), [124009331.2, 313822861.44, 125252687.3472]);
  assert.equal(snapshot.policyRounds[2].heSo, 2);
  assert.equal(snapshot.customerName, "Khách A");

  const row = P.buildSaveRow(payload, snapshot, { product: PRODUCT });
  assert.equal(row.id, undefined);
  assert.equal(row.product_type, "Cao tầng");
  assert.equal(row.base_price, 5742156850.328437);
  assert.equal(row.product_code, "A1-12B09");
  const upd = P.buildSaveRow(payload, snapshot, { id: "s-1", sheetCode: "PTG-0006", product: PRODUCT });
  assert.equal(upd.id, "s-1");
  assert.equal(upd.sheet_code, "PTG-0006");
});

test("không chiết khấu: GiaTriHopDongSauCK toàn null, ChinhSach rỗng (như web)", () => {
  const { draft } = brgDraft();
  const d = { ...draft, rounds: draft.rounds.map((r) => ({ ...r, discountPercent: 0, tienCK: 0 })) };
  const calc = calcLib.computePriceSheet(d.form, d.rounds);
  const { payload } = P.buildPayload(d, calc);
  assert.equal(payload.ChinhSach.length, 0);
  assert.ok(Object.values(payload.TTHopDong.GiaTriHopDongSauCK).every((v) => v === null));
});

test("sửa phiếu: formFromSheet + roundsFromSheet tính lại ra đúng số đã lưu", () => {
  const { calc, draft } = brgDraft();
  const { payload, snapshot } = P.buildPayload(draft, calc);
  const sheet = { id: "s-1", status: "draft", payload, snapshot };
  assert.equal(P.appEditBlockReason(sheet), null);
  const f = P.formFromSheet(sheet, snapshot.product);
  const tpl = formulas.buildRoundTemplate(
    [1, 2, 3].map((i) => ({ ID: `r${i}`, Name: `CK${i}`, Details: draft.rounds[i - 1].formulas ? [] : [] })),
    false
  ).map((t, i) => ({ ...t, formulas: draft.rounds[i].formulas }));
  const rounds = P.roundsFromSheet(sheet, tpl);
  const again = calcLib.computePriceSheet(f, rounds);
  assert.equal(again.tongGiaTriHD, calc.tongGiaTriHD);
  assert.equal(rounds[1].tienCK, 10000000);
  assert.equal(P.customerFromSheet(sheet).TenKH, "Khách A");
});

test("appEditBlockReason: chỉ phiếu nháp đơn giản sửa trên app", () => {
  const base = { status: "draft", snapshot: { product: {} }, payload: { TTHopDong: {}, TTKhachHang: { ListKhachHang: [] }, TT360KhachHang: {} } };
  assert.equal(P.appEditBlockReason(base), null);
  assert.match(P.appEditBlockReason({ ...base, status: "approved" }), /nháp/);
  assert.match(P.appEditBlockReason({ ...base, pgc_id: "x" }), /chứng từ/);
  assert.match(P.appEditBlockReason({ ...base, payload: { ...base.payload, TTKhachHang: { ListKhachHang: [{ MaKH: 1 }] } } }), /đồng sở hữu/);
  assert.match(P.appEditBlockReason({ ...base, payload: { ...base.payload, UuDaiLaiSuat: { a: 1 } } }), /lãi suất/);
  assert.match(P.appEditBlockReason({ ...base, payload: { ...base.payload, TT360KhachHang: { thuNhap: "cao" } } }), /360/);
  assert.match(P.appEditBlockReason({ ...base, deleted_at: "x" }), /xoá/);
  assert.match(P.appEditBlockReason(null), /tải/);
});

test("customerFromRow: cá nhân / doanh nghiệp như handleCustomerSelect", () => {
  const p = P.customerFromRow({ id: "k", is_personal: true, ten_kh: "A", so_cmnd: "0123", di_dong: "09" });
  assert.deepEqual([p.MaKH, p.IsPersonal, p.TenKH, p.SoCMND, p.DiDong], ["k", true, "A", "0123", "09"]);
  const b = P.customerFromRow({ id: "d", is_personal: false, ten_cong_ty: "Cty X", ma_so_thue_ct: "MST", nguoi_dai_dien_pl: "B" });
  assert.deepEqual([b.IsPersonal, b.TenCongTy, b.MaSoThueCT, b.NguoiDaiDienPL], [false, "Cty X", "MST", "B"]);
  assert.deepEqual(plain(P.customerLabel(b)), { name: "Cty X", phone: "" });
});

test("trạng thái + in phiếu: nhãn như web, HTML có số liệu và thoát ký tự", () => {
  assert.deepEqual(plain(status.priceSheetStatus("approved")), { label: "Đã duyệt", color: "green" });
  assert.equal(status.canApprove("approved"), false);
  assert.equal(status.canReject("draft"), true);
  const { calc, draft } = brgDraft();
  const { snapshot } = P.buildPayload({ ...draft, customer: { MaKH: null, IsPersonal: true, TenKH: "<b>x</b>" } }, calc);
  const html = print.buildPriceSheetHtml(print.printInputFromSheet({ sheet_code: "PTG-1", product_code: "A1-12B09", snapshot }), new Date(2026, 9, 13));
  assert.match(html, /PHIẾU TÍNH GIÁ/);
  assert.match(html, /BRG SMART CITY/);
  assert.match(html, /PTG-1/);
  assert.match(html, /5\.742\.156\.850/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt; thanh toan can A1-12B09/);
  assert.match(html, /năm 2026/);
  const legacy = print.printInputFromSheet({ product_code: "X", base_price: 1100, vat_rate: 10, maintenance_rate: 2, area: 10 });
  assert.ok(Math.abs(legacy.totalNoVAT - 1000) < 1e-9);
  assert.ok(Math.abs(legacy.maintenanceFee - 20) < 1e-9);
});
