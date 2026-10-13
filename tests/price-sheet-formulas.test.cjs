/* global __dirname */
// Công thức phiếu tính giá – SO TRỰC TIẾP với code web (nạp từ repo beeland cùng workspace):
//  - beeland/src/components/Products/ContractForm/formulas.ts (evaluateRoundFormula, ROUND)
//  - beeland/src/utils/pricingEngine.ts (evaluateFormula, computeAllFormulas)
// Web dùng `new Function`, app dùng lib/formulaEval.ts → kết quả phải trùng từng số.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { loadTs } = require("./helpers/loadTs.cjs");

const evalLib = loadTs("lib/formulaEval.ts");
const f = loadTs("lib/priceSheetFormulas.ts", { modules: { "./formulaEval": evalLib } });

const WEB = path.join(__dirname, "..", "..", "beeland", "src");
const hasWeb = fs.existsSync(WEB);

function runWeb(rel) {
  const src = fs.readFileSync(path.join(WEB, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(out, { module, exports: module.exports, require: () => ({}), console });
  return module.exports;
}

test("evalArithmetic: phép tính cơ bản, ưu tiên toán tử, dấu phẩy", () => {
  const e = evalLib.evalArithmetic;
  assert.equal(e("1 + 2 * 3"), 7);
  assert.equal(e("(1 + 2) * 3"), 9);
  assert.equal(e("10 / 4 - 1"), 1.5);
  assert.equal(e("- -5"), 5);
  assert.equal(e("2 * -3"), -6);
  assert.equal(e("(1, 2)"), 2);
  assert.equal(e(".5 + 5."), 5.5);
  assert.throws(() => e("1 --5"));
  assert.throws(() => e("05 + 1"));
  assert.throws(() => e("()"));
  assert.throws(() => e("1 2"));
  assert.throws(() => e("1.2.3"));
  assert.throws(() => e("abc"));
});

test("evaluateRoundFormula: ca nghiệp vụ thật (cấu hình CK1 của BRG)", () => {
  const vars = { TienCKTienMat: 0, GiaGocGomVAT: 6200466560, TyLeCK: 2 };
  assert.equal(f.evaluateRoundFormula("TienCKTienMat + GiaGocGomVAT * TyLeCK / 100", vars), 124009331.2);
  assert.equal(f.evaluateRoundFormula("ROUND(1234567, 3)", {}), 1235000);
  assert.equal(f.evaluateRoundFormula("ROUND(1234.5)", {}), 1234.5);
  assert.equal(f.evaluateRoundFormula("ChuaCo + 1", {}), 0);
  assert.equal(f.evaluateRoundFormula("", {}), 0);
  assert.equal(f.evaluateRoundFormula("1 / 0", {}), 0);
});

// Sinh biểu thức ngẫu nhiên (có ROUND, dấu âm, thừa toán tử cuối, biến lạ…) để so app ↔ web
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const VAR_NAMES = ["GiaGoc", "GiaGocGomVAT", "TongCK", "TongChuaVAT", "TongChuaVAT_Prev", "TyLeCK", "HeSo", "TienCK", "X"];
function genExpr(r, depth = 0) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const leaf = () => {
    const k = r();
    if (k < 0.35) return pick(VAR_NAMES);
    if (k < 0.45) return String(Math.floor(r() * 3)); // 0,1,2 (có 0 để chia 0)
    if (k < 0.5) return "0" + Math.floor(r() * 9); // số 0 đứng đầu
    return String(Math.round(r() * 100000) / 100);
  };
  if (depth > 3 || r() < 0.3) return leaf();
  const k = r();
  if (k < 0.15) return `ROUND(${genExpr(r, depth + 1)}, ${pick(["0", "3", "-2", "1", "x"])})`;
  if (k < 0.25) return `(${genExpr(r, depth + 1)})`;
  if (k < 0.3) return `-${genExpr(r, depth + 1)}`;
  if (k < 0.33) return `${genExpr(r, depth + 1)} ${pick(["+", "*"])}`;
  return `${genExpr(r, depth + 1)} ${pick(["+", "-", "*", "/", "--", ""])} ${genExpr(r, depth + 1)}`;
}

test("evaluateRoundFormula app == web trên 5000 biểu thức ngẫu nhiên", { skip: !hasWeb && "không có repo web" }, () => {
  const web = runWeb("components/Products/ContractForm/formulas.ts");
  const r = rng(42);
  for (let i = 0; i < 5000; i++) {
    const expr = genExpr(r);
    const vars = {};
    for (const n of VAR_NAMES.slice(0, 8)) if (r() < 0.85) vars[n] = r() < 0.2 ? -Math.round(r() * 1e6) : Math.round(r() * 1e9) / 10;
    const a = f.evaluateRoundFormula(expr, vars);
    const b = web.evaluateRoundFormula(expr, vars);
    assert.ok(Object.is(a, b), `Lệch ở "${expr}" vars=${JSON.stringify(vars)}: app=${a} web=${b}`);
  }
});

test("evaluateFormula / computeAllFormulas app == web (cấu hình sản phẩm)", { skip: !hasWeb && "không có repo web" }, () => {
  const web = runWeb("utils/pricingEngine.ts");
  const fields = [
    { key: "DienTichThongThuy", label: "", type: "input" },
    { key: "DonGiaChuaVAT", label: "", type: "input" },
    { key: "TyLeVAT", label: "", type: "input" },
    { key: "TongGiaChuaVAT", label: "", type: "formula", formula: "round(DienTichThongThuy * DonGiaChuaVAT)" },
    { key: "TienVAT", label: "", type: "formula", formula: "TongGiaChuaVAT * TyLeVAT / 100" },
    { key: "TongGiaDaVAT", label: "", type: "formula", formula: "TongGiaChuaVAT + TienVAT" },
    { key: "Le", label: "", type: "formula", formula: "floor(TongGiaDaVAT / 3, 2) + ceil(1.234, 1) + dien_tich" },
    { key: "Hong", label: "", type: "formula", formula: "TongGiaDaVAT + alert(1)" },
  ];
  const r = rng(7);
  for (let i = 0; i < 500; i++) {
    const data = { DienTichThongThuy: Math.round(r() * 10000) / 100, DonGiaChuaVAT: Math.round(r() * 1e8), TyLeVAT: r() < 0.5 ? 10 : 8 };
    assert.deepEqual(
      JSON.parse(JSON.stringify(f.computeAllFormulas(data, fields))),
      JSON.parse(JSON.stringify(web.computeAllFormulas(data, fields)))
    );
  }
  const detail = [
    { Code: "B", Name: "b", Type: "CONGTHUC", Formula: "A*2", OrderBy: 2 },
    { Code: "A", Name: "a", Type: "TUNHAP", OrderBy: 1 },
  ];
  const list = [{ ID: "x", Status: false, Detail: detail }, { ID: "y", Status: true, Detail: [] }];
  assert.deepEqual(
    JSON.parse(JSON.stringify(f.getPriceFieldsFromApi(list, "x"))),
    JSON.parse(JSON.stringify(web.getPriceFieldsFromApi(list, "high", "x")))
  );
});

test("applyPolicyDetailsToRounds: số dòng theo chính sách, dòng dư dùng khung vòng cuối", () => {
  const tpl = f.buildRoundTemplate(
    [
      { ID: "r1", Name: "CK1", Details: [{ Code: "TongCK", Formula: "TienCK" }] },
      { ID: "r2", Name: "CK2", Details: [] },
    ],
    false
  );
  const out = f.applyPolicyDetailsToRounds(
    [f.normalizePolicyDetail({ TenChietKhau: "Mở bán", Loai: "percentage", GiaTri: 2, HeSo: 0 }),
     f.normalizePolicyDetail({ TenChietKhau: "Tiền mặt", Loai: "fixed_amount", GiaTri: 5000000, HeSo: 2 }),
     f.normalizePolicyDetail({ TenChietKhau: "Thêm", CKPT: 1 })],
    tpl
  );
  assert.deepEqual(out.map((r) => [r.key, r.name, r.discountPercent, r.tienCK, r.heSo]), [
    ["r1", "Mở bán", 2, 0, 1],
    ["r2", "Tiền mặt", 0, 5000000, 2],
    ["r2_extra_2", "Thêm", 1, 0, 1],
  ]);
  assert.equal(out[0].formulas.tongCK, "TienCK");
  assert.equal(f.applyPolicyDetailsToRounds([], []).length, 0);
});
