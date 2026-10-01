/* global __dirname */
// Tính tiền tiến độ thanh toán – chép web, một phần SO TRỰC TIẾP với code web:
//  - allocatePaidToSchedule: beeland/src/pages/contracts/components/chi-tiet-hop-dong/index.tsx
//  - agingOf:               beeland/src/pages/Reports/DebtProgressReport.tsx
//  - phần còn lại:          beeland/src/services/AccountingCloudService.ts, ContractScheduleService.ts
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { loadTs } = require("./helpers/loadTs.cjs");

const m = loadTs("lib/paymentMath.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));
const WEB = path.join(__dirname, "..", "..", "beeland");
const hasWeb = fs.existsSync(path.join(WEB, "src"));

/** Cắt nguyên văn một hàm const khỏi file web và chạy độc lập. */
function webFn(file, startMarker, endMarker, name, requires = {}) {
  const src = fs.readFileSync(path.join(WEB, "src", file), "utf8");
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `found ${name} in ${file}`);
  const body = src.slice(start, end + endMarker.length);
  const out = ts.transpileModule(`${body}\nexports.fn = ${name};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: (n) => requires[n], Math, Number, Date, ...requires });
  return exports.fn;
}

test("allocatePaidToSchedule: principal first, then maintenance fee – same as web", { skip: !hasWeb && "no web repo" }, () => {
  const web = webFn(
    // Web dời src/pages/Contracts → src/pages/contracts (commit 77ad33db7)
    "pages/contracts/components/chi-tiet-hop-dong/index.tsx",
    "const allocatePaidToSchedule = (rows: any[], totalPaid: number) => {",
    "\n    return result;\n  };",
    "allocatePaidToSchedule"
  );
  const rows = [
    { DotTT: 2, PhaiThu: 300, PhaiThuPBT: 20 },
    { DotTT: 1, PhaiThu: 100, PhaiThuPBT: 10 },
    { Dot: 3, PhaiThu: 50 },
    { PhaiThu: "40", PhaiThuPBT: null },
  ];
  for (const paid of [0, 50, 100, 420, 455, 470, 9999, -5, "130.6", null]) {
    assert.deepEqual(plain(m.allocatePaidToSchedule(rows, paid)), plain(web(rows, paid)), `paid=${paid}`);
  }
  assert.deepEqual(plain(m.allocatePaidToSchedule([], 100)), []);
});

test("aging buckets – same as web agingOf", { skip: !hasWeb && "no web repo" }, () => {
  const dayjs = require(path.join(WEB, "node_modules", "dayjs"));
  const web = webFn("pages/Reports/DebtProgressReport.tsx", "const agingOf = (r: Row) => {", "\n};", "agingOf", { dayjs });
  const today = new Date();
  const ymd = (offset) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const cases = [
    { conLai: 0, soNgayQuaHan: 50, ngayDenHan: ymd(-50) },
    { conLai: 10, soNgayQuaHan: 0, ngayDenHan: ymd(0) },
    { conLai: 10, soNgayQuaHan: 0, ngayDenHan: ymd(5) },
    { conLai: 10, soNgayQuaHan: 0, ngayDenHan: ymd(-1) },
    { conLai: 10, soNgayQuaHan: 0, ngayDenHan: ymd(-30) },
    { conLai: 10, soNgayQuaHan: 0, ngayDenHan: ymd(-31) },
    { conLai: 10, soNgayQuaHan: 61, ngayDenHan: null },
    { conLai: 10, soNgayQuaHan: 91, ngayDenHan: null },
    { conLai: 10, soNgayQuaHan: 0, ngayDenHan: null },
  ];
  for (const c of cases) assert.equal(m.agingOf(c), web(c), JSON.stringify(c));
  assert.equal(m.AGING_LABEL.d30, "Quá hạn ≤ 30 ngày");
});

test("schedule rows from fn_contract_payment_schedule map like the web", () => {
  const r = m.mapScheduleRpcRow({
    dot_tt: 2, dot_tt_text: null, ngay_tt: "2026-11-01", ty_le_tt: "30", phai_thu: "300", da_thu: 120,
    con_lai: 180, phai_thu_pbt: 20, da_thu_pbt: 5, con_lai_pbt: 15, dien_giai: null,
  });
  assert.deepEqual(plain(r), {
    DotTT: 2, DotTTText: "Đợt 2", NgayTT: "2026-11-01", TyLeTT: 30, PhaiThu: 300, DaThu: 120, ConLai: 180,
    PhaiThuPBT: 20, PhiBT: 20, DaThuPBT: 5, ConNoPBT: 15, DienGiai: "",
  });
});

test("receipts of one sales doc only count the part that belongs to it (so_tien_pgc)", () => {
  assert.equal(m.pgcVoucherTotal([{ so_tien: 1000, so_tien_pgc: 300 }, { so_tien: 200, so_tien_pgc: "200" }, {}]), 500);
});

test("receipt lines are summed per sales doc like the web (maintenance fee apart, aliases)", () => {
  const map = m.sumReceiptLines(
    [
      { pgc_id: "pgc1", ma_loai: "L1", so_tien: 100 },
      { pgc_id: "ct1", ma_loai: "PBT", so_tien: 7 },
      { pgc_id: "pgc1", ma_loai: "L1", so_tien: 0 },
      { pgc_id: null, ma_loai: "L1", so_tien: 50 },
    ],
    { alias: { ct1: "pgc1" }, code: { pgc1: "BK-1", ct1: "HD-1" }, pbtLoai: new Set(["PBT"]) }
  );
  assert.deepEqual(plain(map.get("pgc1")), { daThu: 100, daThuPBT: 7 });
  assert.deepEqual(plain(map.get("BK-1")), { daThu: 100, daThuPBT: 7 });
  assert.deepEqual(plain(map.get("HD-1")), { daThu: 0, daThuPBT: 7 });
  assert.equal(m.isPbtLoaiName("Phí bảo trì"), true);
  assert.equal(m.isPbtLoaiName("Thu theo tiến độ"), false);
});

test("installments: paid money flows over installments in order; overdue only when money is still owed", () => {
  const now = Date.UTC(2026, 9, 1, 5); // 01/10/2026 12:00 giờ VN
  const parents = [
    {
      MaPGC: "p1", SoHD: "HD-1", TenDA: "DA", KyHieu: "A-1", HoTenKH: "Khách", MaDA: "d1", DaThu: 150, DaThuPBT: 0, TenTT: "HĐMB",
      LichThanhToan: [
        { DotTT: 2, SoTien: 200, NgayTT: "2026-10-10" },
        { DotTT: 1, SoTien: 100, NgayTT: "2026-09-01", PhiBT: 10 },
        { DotTT: 3, SoTien: 300, NgayTT: "2026-09-20", NgayGiaHan: "2026-10-20" },
      ],
    },
    { MaPGC: "p2", DaThu: 0, LichThanhToan: [] },
  ];
  const rows = m.buildInstallments(parents, { now });
  assert.deepEqual(plain(rows.map((r) => [r.DotTT, r.DaThu, r.ConNo, r.ConNoPBT, r.SoNgayQuaHan])), [
    [1, 100, 0, 10, 30],
    [3, 0, 300, 0, 0],
    [2, 50, 150, 0, 0],
  ]);
  assert.equal(rows[0].DotTTText, "Đợt 1");
  const ranged = m.buildInstallments(parents, { now, from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(plain(ranged.map((r) => r.DotTT)), [2]);
});

test("progress rows for the report (web DebtProgressReport TIENDO mapping)", () => {
  const row = m.toProgressRow({ MaPGC: "p1", SoHD: "HD-1", DotTT: 1, SoTien: 100, PhiBT: 10, DaThu: 100, DaThuPBT: 0, ConNo: 0, ConNoPBT: 10, NgayTT: "2026-09-01", SoNgayQuaHan: 30, TenDA: "DA", KyHieu: "A-1", HoTenKH: "Khách" });
  assert.equal(row.phaiThu, 110);
  assert.equal(row.daThu, 100);
  assert.equal(row.conLai, 10);
  assert.equal(row.dotTT, "Đợt 1");
  assert.equal(row.soHD, "HD-1");
  assert.equal(m.isDroppedStatus("Đã hủy"), true);
  assert.equal(m.isDroppedStatus("Thanh lý"), true);
  assert.equal(m.isDroppedStatus("Hợp đồng mua bán"), false);
});

test("progress row keeps the parent doc info for opening its detail", () => {
  const row = m.toProgressRow({
    MaPGC: "p1",
    GiaiDoan: "HDMB",
    SoHD: "HD-1",
    DotTT: 2,
    SoTien: 100,
    DaThu: 40,
    DaThuHD: 540,
    TongGiaTriHD: 1000,
    DiDong: "0912",
    TenTT: "Hợp đồng mua bán",
  });
  assert.equal(row.maPGC, "p1");
  assert.equal(row.giaiDoan, "HDMB");
  assert.equal(row.tongGiaTri, 1000);
  assert.equal(row.daThuHD, 540);
  assert.equal(row.diDong, "0912");
  // Thiếu thông tin phiếu → giá trị rỗng an toàn
  const bare = m.toProgressRow({ MaPGC: "p2" });
  assert.equal(bare.giaiDoan, "");
  assert.equal(bare.tongGiaTri, 0);
  assert.equal(bare.daThuHD, 0);
});
