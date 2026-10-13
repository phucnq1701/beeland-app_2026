/* global __dirname */
// Tính giá phiếu tính giá (lib/priceSheetCalc.ts + lib/priceSheetSchedule.ts):
//  1) Phiếu THẬT trên web (BRG, PTG-0006, cao tầng, 3 vòng CK, tiến độ 4 đợt) – app tính lại phải ra đúng
//     số web đã lưu (payload.ChinhSach / GiaTriHopDongSauCK / LichThanhToan). Chỉ giữ số liệu, không giữ thông tin khách.
//  2) Lịch thanh toán so trực tiếp với beeland/src/components/Products/ContractForm/helpers.ts.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { loadTs } = require("./helpers/loadTs.cjs");

const evalLib = loadTs("lib/formulaEval.ts");
const formulas = loadTs("lib/priceSheetFormulas.ts", { modules: { "./formulaEval": evalLib } });
const calcLib = loadTs("lib/priceSheetCalc.ts", { modules: { "./priceSheetFormulas": formulas } });
const sched = loadTs("lib/priceSheetSchedule.ts", { modules: { "./priceSheetFormulas": formulas } });
const plain = (v) => JSON.parse(JSON.stringify(v));

const WEB = path.join(__dirname, "..", "..", "beeland", "src");
const hasWeb = fs.existsSync(WEB);

// Cấu hình CSCAOTANG c6174e95… (cloud_pricing_config_rounds, đọc 13/10/2026)
const CFG_ROUNDS = [
  { ID: "56a825af", Name: "CK1", Details: [
    { Code: "TongCK", Formula: "TienCKTienMat + GiaGocGomVAT * TyLeCK / 100" },
    { Code: "TongChuaVAT", Formula: "(TongGomVAT+DienTichThongThuy * DGDatPB*10/100)*100/110" },
    { Code: "VAT", Formula: "(TongChuaVAT - DienTichThongThuy * DGDatPB)*10/100" },
    { Code: "TongGomVAT", Formula: "GiaGocGomVAT - TongCK" },
    { Code: "PhiBaoTri", Formula: "TongChuaVAT * 2/100" },
    { Code: "TongGiaTri", Formula: "GiaGocGomVAT - TongCK+ TongChuaVAT * 2/100" },
  ] },
  ...["617400e4", "df8ffb5b", "6a6a5820"].map((id, i) => ({ ID: id, Name: `CK${i + 2}`, Details: [
    { Code: "TongCK", Formula: "TienCKTienMat + TongGomVAT_Prev* TyLeCK / 100" },
    { Code: "TongChuaVAT", Formula: "(TongGomVAT_Prev+DienTichThongThuy * DGDatPB*10/100)*100/110" },
    { Code: "VAT", Formula: "(TongChuaVAT - DienTichThongThuy * DGDatPB)*10/100" },
    { Code: "TongGomVAT", Formula: "TongGomVAT_Prev- TongCK" },
    { Code: "PhiBaoTri", Formula: "TongChuaVAT* 2/100" },
    { Code: "TongGiaTri", Formula: "TongGomVAT_Prev- TongCK+ TongChuaVAT * 2/100" },
  ] })),
];
// Chính sách b9e637d8… (detail) + tiền CK nhập tay trên phiếu (vòng 2, 3: 10.000.000)
const POLICY_DETAIL = [
  { TenChietKhau: "Mở bán", HeSo: 1, Loai: "percentage", GiaTri: 2 },
  { TenChietKhau: "ck booking sớm", HeSo: 1, Loai: "percentage", GiaTri: 5 },
  { TenChietKhau: "Ck thanh toán thường", HeSo: 2, Loai: "percentage", GiaTri: 2 },
];
// Tiến độ df434514… "TT vốn vay ngân hàng" (details)
const TEMPLATE = [1, 2, 3, 4].map((dot) => ({
  DotTT: dot, TenDot: `Đợt ${dot}`, SoNgay: [10, 30, 60, 90][dot - 1], MaLoai: 1,
  TyLeTT: [30, 40, 15, 15][dot - 1], TyLeVAT: 0, TyLePBT: dot === 3 ? 100 : 0,
  TuongUng: "TongGiaGomVAT * PhanTramTT / 100", TienVAT: "0",
  PhiBaoTri: dot === 3 ? "PhiBaoTri" : "0",
  TongCong: dot === 3 ? "TongGiaGomVAT * PhanTramTT / 100 + PhiBaoTri" : "TongGiaGomVAT * PhanTramTT / 100",
}));
const FORM = {
  isLowRise: false, tyLeVAT: 10, tyLePBT: 2, tienCoc: 200000000,
  dienTichThongThuy: 0, donGiaSuDungDat: 0, donGiaDatPhanBo: 2971006,
  dienTichDat: 0, donGiaDat: 0, dienTichXD: 0, tongDTSanXD: 0, donGiaXD: 0,
  rawTongGiaChuaVAT: 5636787781.818181, rawTongGiaDaVAT: 6200466560, rawTienVAT: 547397665.3018181,
  rawTienPhiBaoTri: 112735755.63636363, rawTongGomPBT: 6313202315.636364,
};
// Số web đã lưu (payload.ChinhSach[i] / GiaTriHopDongSauCK / LichThanhToan)
const SAVED_ROUNDS = [
  { CKTien: 124009331.2, TongGiaChuaVAT: 5524052026.181818, VAT: 552405202.6181817, TongGiaGomVAT: 6076457228.8, PhiBaoTri: 110481040.52363636, TongGiaTriHDMB: 6186938269.323637 },
  { CKTien: 313822861.44, TongGiaChuaVAT: 5524052026.181818, VAT: 552405202.6181817, TongGiaGomVAT: 5762634367.360001, PhiBaoTri: 110481040.52363636, TongGiaTriHDMB: 5873115407.883637 },
  { CKTien: 125252687.3472, TongGiaChuaVAT: 5238758515.781818, VAT: 523875851.57818186, TongGiaGomVAT: 5637381680.0128, PhiBaoTri: 104775170.31563637, TongGiaTriHDMB: 5742156850.328437 },
];
const SAVED_SCHEDULE = [
  { TuongUng: 1691214504.00384, ThueVAT: 0, PhiBT: 0, SoTien: 1691214504.00384 },
  { TuongUng: 2254952672.0051203, ThueVAT: 0, PhiBT: 0, SoTien: 2254952672.0051203 },
  { TuongUng: 845607252.00192, ThueVAT: 0, PhiBT: 104775170.31563637, SoTien: 950382422.3175564 },
  { TuongUng: 845607252.00192, ThueVAT: 0, PhiBT: 0, SoTien: 845607252.00192 },
];

function brgRounds() {
  const tpl = formulas.buildRoundTemplate(CFG_ROUNDS, false);
  const rounds = formulas.applyPolicyDetailsToRounds(POLICY_DETAIL.map(formulas.normalizePolicyDetail), tpl);
  rounds[1].tienCK = 10000000;
  rounds[2].tienCK = 10000000;
  return rounds;
}

test("phiếu thật BRG: các vòng chiết khấu ra đúng số web đã lưu", () => {
  const c = calcLib.computePriceSheet(FORM, brgRounds());
  assert.equal(c.roundResults.length, 3);
  c.roundResults.forEach((r, i) => {
    const s = SAVED_ROUNDS[i];
    assert.equal(r.tongCK, s.CKTien, `vòng ${i + 1} TongCK`);
    assert.equal(r.tongChuaVAT, s.TongGiaChuaVAT, `vòng ${i + 1} TongChuaVAT`);
    assert.equal(r.vat, s.VAT, `vòng ${i + 1} VAT`);
    assert.equal(r.tongGomVAT, s.TongGiaGomVAT, `vòng ${i + 1} TongGomVAT`);
    assert.equal(r.phiBaoTri, s.PhiBaoTri, `vòng ${i + 1} PhiBaoTri`);
    assert.equal(r.tongGiaTriHD, s.TongGiaTriHDMB, `vòng ${i + 1} TongGiaTriHD`);
  });
  assert.equal(c.tongGiaTriHD, 5742156850.328437);
  assert.equal(c.tienChietKhau, 563084879.9872);
  assert.equal(c.totalDiscountPercent, 9.99);
});

test("phiếu thật BRG: lịch thanh toán 4 đợt ra đúng số web đã lưu", () => {
  const c = calcLib.computePriceSheet(FORM, brgRounds());
  const rows = sched.recalcPaymentScheduleSequential(
    sched.scheduleRowsFromTemplate(TEMPLATE, false, 10),
    { calculations: c, rawTongGiaChuaVAT: FORM.rawTongGiaChuaVAT }
  );
  rows.forEach((r, i) => {
    const s = SAVED_SCHEDULE[i];
    assert.equal(r.soTien, s.TuongUng, `đợt ${i + 1} tương ứng`);
    assert.equal(r.tienVAT, s.ThueVAT, `đợt ${i + 1} VAT`);
    assert.equal(r.tienBaoTri, s.PhiBT, `đợt ${i + 1} PBT`);
    assert.equal(r.tongGiaTri, s.SoTien, `đợt ${i + 1} tổng`);
  });
  assert.equal(rows[0].kieuThanhToan, "Đợt 1");
});

test("không chọn chính sách: giá sau CSBH = giá sản phẩm", () => {
  const c = calcLib.computePriceSheet(FORM, []);
  assert.equal(c.tongGiaTriHD, FORM.rawTongGomPBT);
  assert.equal(c.tienChietKhau, 0);
  assert.equal(c.giaTriSauCK, FORM.rawTongGiaChuaVAT);
  assert.equal(c.phiBaoTri, FORM.rawTienPhiBaoTri);
});

test("vòng tắt giữ nguyên giá vòng trước; vòng không cài công thức ⇒ 0 (không dự phòng – như web)", () => {
  const rounds = brgRounds();
  rounds[0].enabled = false;
  const c = calcLib.computePriceSheet(FORM, rounds);
  assert.equal(c.roundResults[0].tongCK, 0);
  assert.equal(c.roundResults[0].tongGomVAT, FORM.rawTongGiaDaVAT);
  const broken = brgRounds();
  broken[0].formulas = { tongCK: "", evalOrder: broken[0].formulas.evalOrder };
  const c2 = calcLib.computePriceSheet(FORM, broken.slice(0, 1));
  assert.equal(c2.roundResults[0].tongCK, 0);
  assert.equal(c2.roundResults[0].tongChuaVAT, 0);
});

test("thấp tầng: vòng CK theo công thức đất / xây dựng", () => {
  const tpl = formulas.buildRoundTemplate([{ ID: "t1", Name: "CK", Details: [
    { Code: "TongCK", Formula: "TongGiaTriHDMB_Goc * TyLeCK / 100" },
    { Code: "GiaDatChuaVAT", Formula: "GiaDatChuaVAT_Prev - TongCK" },
    { Code: "VATDat", Formula: "GiaDatChuaVAT * 10 / 100" },
    { Code: "TongGiaDatVAT", Formula: "GiaDatChuaVAT + VATDat" },
    { Code: "TongXDChuaVAT", Formula: "TienXDChuaVAT_Prev" },
    { Code: "VATXD", Formula: "TienXDChuaVAT * 10 / 100" },
    { Code: "TongXDVAT", Formula: "TienXDChuaVAT + VATXD" },
    { Code: "TongGiaTriHDMB", Formula: "TongGiaDat + TienXDGomVAT" },
  ] }], true);
  const rounds = formulas.applyPolicyDetailsToRounds([{ TenChietKhau: "CK", CKPT: 1 }], tpl);
  const c = calcLib.computePriceSheet({
    ...FORM, isLowRise: true,
    rawTienDatChuaVAT: 1000, rawTienVATDat: 100, rawTongTienDatVAT: 1100,
    rawThanhTienXD: 500, rawTienVATXD: 50, rawTongGiaXDVAT: 550, rawTongGiaTriHDMB: 1650,
  }, rounds);
  const r = c.roundResults[0];
  assert.equal(r.tongCK, 16.5);
  assert.equal(r.giaDatChuaVAT, 983.5);
  assert.equal(r.tongGiaDat, 983.5 + (983.5 * 10) / 100);
  assert.equal(r.tienXDGomVAT, 550);
  assert.equal(c.tongGiaTriHDMB, r.tongGiaDat + 550);
  assert.equal(c.phiBaoTri, 0);
});

test("ngày thanh toán = ngày ký + số ngày / tháng (như dayjs.add)", () => {
  const row = { soNgay: 10, maLoaiNgay: 1 };
  assert.equal(sched.dueDateFor(row, new Date(2026, 8, 16, 14, 56)), "2026-09-26T00:00:00+07:00");
  assert.equal(sched.dueDateFor({ soNgay: 1, maLoaiNgay: 2 }, new Date(2026, 0, 31)), "2026-02-28T00:00:00+07:00");
  assert.equal(sched.dueDateFor({ ngayTT: "x" }, null), "x");
  assert.equal(sched.dueDateFor(row, null), null);
});

function runWeb(rel, modules) {
  const src = fs.readFileSync(path.join(WEB, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(out, { module, exports: module.exports, require: (n) => modules[n] ?? {}, console });
  return module.exports;
}

test("lịch thanh toán app == web helpers.ts (nhiều cấu hình)", { skip: !hasWeb && "không có repo web" }, () => {
  const webFormulas = runWeb("components/Products/ContractForm/formulas.ts", {});
  const web = runWeb("components/Products/ContractForm/helpers.ts", { "./formulas": webFormulas });
  const c = calcLib.computePriceSheet(FORM, brgRounds());
  const ctx = { calculations: c, rawTongGiaChuaVAT: FORM.rawTongGiaChuaVAT };
  const variants = [
    TEMPLATE,
    TEMPLATE.map((t) => ({ ...t, TuongUng: "", TienVAT: "", PhiBaoTri: "", TongCong: "", TyLeVAT: 10, TyLePBT: 2 })),
    TEMPLATE.map((t) => ({ ...t, TuongUng: "ROUND(TongGiaChuaVAT * PhanTramTT / 100, 3)", TienVAT: "LanNay_TuongUng * PhanTramVAT / 100", TyLeVAT: 10, TongCong: "LanNay_TuongUng + LanNay_VAT + LanNay_PBT + PrevTongCong * 0" })),
    TEMPLATE.slice(0, 3),
  ];
  for (const tplRows of variants) {
    const rows = sched.scheduleRowsFromTemplate(tplRows, false, 10);
    assert.deepEqual(
      plain(sched.recalcPaymentScheduleSequential(rows, ctx)),
      plain(web.recalcPaymentScheduleSequential(rows, ctx))
    );
  }
});

test("tính giá app == web ContractForm/calculations.ts (2.000 bộ dữ liệu ngẫu nhiên)", { skip: !hasWeb && "không có repo web" }, () => {
  const webFormulas = runWeb("components/Products/ContractForm/formulas.ts", {});
  const web = runWeb("components/Products/ContractForm/calculations.ts", { "./formulas": webFormulas, "./helpers": {} });
  let s = 12345;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const money = () => (r() < 0.15 ? null : Math.round(r() * 1e10) / 100);
  const HIGH = ["TienCKTienMat + GiaGocGomVAT * TyLeCK / 100", "TienCK", "", "GiaGoc - TongCK", "TongChuaVAT_Prev - TongCK", "TongChuaVAT * TyLeVAT / 100",
    "TongChuaVAT + VAT", "TongGomVAT_Prev - TongCK", "(TongGomVAT+DienTichThongThuy * DGDatPB*10/100)*100/110", "ROUND(TongChuaVAT * 2 / 100, 3)", "KhongCo + 1"];
  const LOW = ["TongGiaTriHDMB_Goc * TyLeCK / 100", "GiaDatChuaVAT_Prev - TongCK", "GiaDatChuaVAT * 10 / 100", "GiaDatChuaVAT + VATDat",
    "TienXDChuaVAT_Prev", "TienXDChuaVAT * TyLeVATXayDung / 100", "TienXDChuaVAT + VATXD", "TongGiaDat + TienXDGomVAT", "VATXD_Goc", "", "TienXDGomVAT_Prev"];
  const pick = (a) => a[Math.floor(r() * a.length)];
  for (let i = 0; i < 2000; i++) {
    const low = r() < 0.4;
    const form = {
      isLowRise: low, tyLeVAT: pick([0, 8, 10]), tyLePBT: pick([0, 2]), tienCoc: pick([0, 50000000]),
      dienTichThongThuy: pick([0, 54.8, 120]), donGiaSuDungDat: money() || 0, donGiaDatPhanBo: pick([0, 2971006]),
      dienTichDat: pick([0, 100]), donGiaDat: money() || 0, dienTichXD: pick([0, 80]), tongDTSanXD: pick([0, 240]), donGiaXD: money() || 0,
      rawTongGiaChuaVAT: money(), rawTongGiaDaVAT: money(), rawTienVAT: money(), rawTienPhiBaoTri: money(), rawTongGomPBT: money(),
      rawTongGiaTriHDMB: money(), rawTienDatChuaVAT: money(), rawTienVATDat: money(), rawTongTienDatVAT: money(), rawTienSDDat: money(),
      rawThanhTienXD: money(), rawTienVATXD: money(), rawTongGiaXDVAT: money(),
    };
    const n = Math.floor(r() * 4);
    const rounds = Array.from({ length: n }, (_, k) => {
      const keys = low
        ? ["tongCK", "giaDatChuaVAT", "vatDat", "tongGiaDat", "tienXDChuaVAT", "vatXD", "tienXDGomVAT", "tongGiaTriHDMB"]
        : ["tongCK", "tongChuaVAT", "vat", "tongGomVAT", "phiBaoTri", "tongGiaTriHD"];
      const formulasObj = { evalOrder: keys };
      keys.forEach((key) => (formulasObj[key] = pick(low ? LOW : HIGH)));
      return { key: `r${k}`, name: `CK${k}`, discountPercent: pick([0, 1, 2.5]), tienCK: pick([0, 10000000]), heSo: pick([1, 2]), enabled: r() < 0.85, formulas: formulasObj };
    });
    assert.deepEqual(plain(calcLib.computePriceSheet(form, rounds)), plain(web.computeSalesCalculations(form, rounds)), `lệch ở bộ ${i}`);
  }
});

test("dòng lịch từ mẫu tiến độ app == web helpers.scheduleRowsFromTemplate (tên đợt theo TenDot)", { skip: !hasWeb && "không có repo web" }, () => {
  const webFormulas = runWeb("components/Products/ContractForm/formulas.ts", {});
  const web = runWeb("components/Products/ContractForm/helpers.ts", { "./formulas": webFormulas });
  const tpl = [...TEMPLATE.map((t, i) => ({ ...t, TenDot: i === 1 ? "Ký HĐMB" : undefined })), { DotTT: 5, VATDat: "X", TienXayDung: "Y", TyLeXD: 3 }];
  for (const low of [false, true]) {
    assert.deepEqual(plain(sched.scheduleRowsFromTemplate(tpl, low, 10)), plain(web.scheduleRowsFromTemplate(tpl, low, 10)));
  }
  assert.equal(sched.scheduleRowsFromTemplate(tpl, false, 10)[1].kieuThanhToan, "Ký HĐMB");
});
