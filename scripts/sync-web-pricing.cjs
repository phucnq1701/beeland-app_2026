#!/usr/bin/env node
/**
 * Đồng bộ NGUYÊN VĂN các module tính giá / phiếu tính giá THUẦN (không React / UI / gọi API) từ web sang app.
 *
 *   node scripts/sync-web-pricing.cjs [--web <đường dẫn repo web>] [--check] [--plan]
 *
 * - Bắt đầu từ ENTRIES, dò toàn bộ import nội bộ (`@/…`, `./…`) ⇒ chép vào lib/web/<đường dẫn như web dưới src/>.
 * - Chỉ đổi đường dẫn import (`@/x` ⇒ tương đối trong lib/web) — phần còn lại giữ nguyên từng ký tự.
 * - Import CHỈ KIỂU (`import type …`) từ module không thuần (services, React…) ⇒ trỏ sang tệp kiểu thay thế
 *   lib/web/_stubs/<đường dẫn>.ts (`export type X = any`) — không kéo mã gọi API sang app.
 * - Import chạy thật từ module không thuần ⇒ DỪNG báo lỗi (phải đưa module đó ra ngoài phạm vi chép, hoặc thêm vào ALLOW_PKGS).
 * - --check: không ghi, so lib/web hiện có với web (test tests/web-pricing-sync.test.cjs dùng) ⇒ mã thoát 1 khi lệch.
 * - --plan : chỉ in danh sách module + thư viện ngoài.
 * Mặc định repo web: ../beeland (cạnh app) — trong worktree _wt là liên kết tới _wt/web-ref.
 */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const APP = path.join(__dirname, "..");
const OUT = path.join(APP, "lib", "web");

/** Module gốc (đường dẫn dưới src/ của web, không đuôi) — form phiếu tính giá web dùng trực tiếp */
const ENTRIES = [
  "components/Products/ContractForm/formulas",
  "components/Products/ContractForm/roundVars",
  "components/Products/ContractForm/mocTinh",
  "components/Products/ContractForm/hdmbLanVars",
  "components/Products/ContractForm/vatCuoiPbtVar",
  "components/Products/ContractForm/helpers",
  "components/Products/ContractForm/discountOptions",
  "components/Products/ContractForm/optionConditions",
  "components/Products/ContractForm/priorOptionState",
  "components/Products/ContractForm/paymentScheduleOptions",
  "components/Products/ContractForm/types",
  "components/Sales/salesConfig/expiryPickOptions",
  "components/Sales/salesConfig/policyScope",
  "components/Sales/salesConfig/unitFundPriceList",
  "lib/tdttThoiHan",
  "lib/tdttGiaoDich",
  "lib/tdttHieuLuc",
  "lib/priceSheetExpiry",
  "utils/productType",
  // Lớp dữ liệu + hook form dùng (chép nguyên văn; gọi máy chủ qua shim supabase.rpc ⇒ fn_nv_app_*)
  "components/PriceSheet/savedSheetPrices",
  "utils/pricingEngine",
  "components/PriceSheet/print/templates/index",
  "components/Sales/salesConfig/useUnitFundPriceList",
  "components/Sales/salesConfig/useSalesConfigOptions",
  "components/Sales/salesConfig/useExceptionAllowIds",
  "components/Products/ContractForm/useOptionUsage",
  "components/Products/ContractForm/useSalesPolicyGate",
  "components/Products/ContractForm/disabledReasons",
  "components/shared/salesCompanyControl",
  "services/sales/sales-settings/index",
  "services/priceListItem",
];

/**
 * TRÍCH LOGIC TỪ COMPONENT (React) — nguyên văn, không sửa: các phần thuần nằm ngay trong component web
 * (useMemo tính giá, hàm const, dãy câu lệnh dựng dữ liệu lưu) ⇒ hàm `fn(ctx)`; biến cục bộ của component (state, props, hàm khác)
 * thành trường của ctx (app tự cung cấp / lắp các phần với nhau); hàm import ⇒ giữ import (module kéo vào tập chép).
 *  kind "memo":  const <name> = useMemo(() => {…}, deps)  ⇒ fn(ctx) trả kết quả
 *  kind "fn":    const <name> = <biểu thức>                ⇒ fn(ctx) trả giá trị (thường là hàm)
 *  kind "range": trong hàm <inside>, khối chứa câu lệnh bắt đầu bằng <from>: từ câu đó tới khai báo <until> (gồm),
 *                cộng các khai báo <plus> (tìm trong <inside>) ⇒ fn(ctx) trả { …returns }
 */
const COMPONENT_EXTRACTS = [
  {
    // Trang Phiếu tính giá: dựng dòng gửi fn_price_sheet_save từ payload form (handlePriceSheetSaved)
    file: "pages/products/gia-gio-hang/phieu-tinh-gia/index.tsx",
    out: "pages/products/gia-gio-hang/phieu-tinh-gia/saveRow.ts",
    parts: [
      { kind: "range", fn: "webPriceSheetSaveRow", inside: "handlePriceSheetSaved", from: "const tt = payload?.TTHopDong", until: "row", returns: ["row"] },
      { kind: "fn", name: "handleEdit", fn: "webHandleEdit" },
      { kind: "fn", name: "handlePriceSheetSaved", fn: "webHandlePriceSheetSaved" },
    ],
  },
  {
    file: "components/PriceSheet/PriceSheetForm.tsx",
    out: "components/PriceSheet/PriceSheetForm.logic.ts",
    parts: [
      { kind: "memo", name: "calculations", fn: "webCalculations" },
      { kind: "fn", name: "getRestoredRoundResults", fn: "webGetRestoredRoundResults" },
      { kind: "fn", name: "formulaCtx", fn: "webFormulaCtx" },
      { kind: "fn", name: "recalcPaymentScheduleSequential", fn: "webRecalcPaymentScheduleSequential" },
      { kind: "fn", name: "dueDatesOf", fn: "webDueDatesOf" },
      { kind: "range", fn: "webBuildSave", inside: "handleSave", from: "const num =", until: "payload", plus: ["snapshot"], returns: ["payload", "snapshot"] },
    ],
  },
];

/**
 * COMPONENT ⇒ HOOK (nguyên văn): toàn bộ thân component web (state, ref, useEffect, handler, useMemo) thành hook React dùng được trên
 * app — chỉ bỏ câu `return (<JSX>)` cuối và các câu dính giao diện (JSX, antd / icon / component .tsx). Props giữ nguyên tham số.
 * Hook trả mọi tên khai báo ở thân. Câu giữ dùng tên chỉ khai báo ở câu bị bỏ ⇒ lỗi (trừ `allowMissing`).
 * Module không thuần hook import để chạy (services .js cũ…) ⇒ stub tự sinh (gọi ⇒ log + lỗi) trừ khi có shim viết tay.
 */
const COMPONENT_HOOKS = [
  {
    file: "components/PriceSheet/PriceSheetForm.tsx",
    component: "PriceSheetForm",
    out: "components/PriceSheet/PriceSheetForm.hook.ts",
    hook: "useWebPriceSheetForm",
    allowMissing: [],
  },
];
const UI_PKG = /^(antd|lucide-react|@ant-design|react-dom|react-router|@tanstack)/;
const UI_PATH = [/^components\/ui\//, /^components\/UiCustoms\//];

/** Thư viện ngoài được phép (đã có / thêm vào package.json của app) */
const ALLOW_PKGS = new Set(["dayjs", "react", "date-fns"]);
/**
 * Module web thay bằng tệp app viết tay lib/web/_shims/<khoá>.ts (giữ nguyên khi đồng bộ, có test riêng):
 * client supabase ⇒ chỉ .rpc qua bảng đối chiếu sang fn_nv_app_*; sonner ⇒ toast của app.
 */
const SHIMS = new Set(["integrations/supabase/client", "sonner", "lib/session", "components/PriceSheet/priceSheetConstants",
  "services/Product", "services/Project"]);
/** (cũ) service chép nguyên văn — nay mọi service .ts chép được nếu cả chuỗi phụ thuộc thuần */
const COPY_SERVICES = new Set([]);
/**
 * Module KHÔNG thuần nhưng có vài hàm thuần cần dùng ⇒ TRÍCH nguyên văn các khai báo đó (+ khai báo cùng tệp chúng tham chiếu)
 * sang lib/web/_extract/<khoá>.ts. Khai báo trích mà dùng import của tệp gốc ⇒ báo lỗi (phải xử lý tay).
 */
const EXTRACT = {
  "services/system/permitted-company": ["cleanCompanyIds", "isUid"],
  "components/Products/ContractForm/InterestIncentiveFields": ["createInterestIncentiveInfo", "InterestIncentiveInfo"],
  "components/Products/ContractForm/ApartmentTypeField": ["apartmentTypeName"],
};
/** Đường dẫn (dưới src/) KHÔNG chép: chỉ được import kiểu ⇒ thay bằng kiểu any */
const IMPURE = [/^integrations\//, /^contexts\//, /^pages\//, /\.tsx$/, /\.js$/, /^components\/ui\//];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const WEB = path.resolve(arg("--web") || path.join(APP, "..", "beeland"));
const SRC = path.join(WEB, "src");
const CHECK = process.argv.includes("--check");
const PLAN = process.argv.includes("--plan");

function resolveFile(rel) {
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const p = path.join(SRC, rel + ext);
    if (fs.existsSync(p)) return { rel: path.relative(SRC, p).replace(/\\/g, "/"), abs: p };
  }
  return null;
}

/** Các import / export-from của 1 tệp: { spec, typeOnly, start, end } (start/end = vị trí chuỗi đường dẫn, kể cả dấu nháy) */
function importsOf(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const out = [];
  for (const st of sf.statements) {
    let spec = null;
    let typeOnly = false;
    if (ts.isImportDeclaration(st)) {
      spec = st.moduleSpecifier;
      const cl = st.importClause;
      typeOnly = !!cl && (cl.isTypeOnly ||
        (!cl.name && !!cl.namedBindings && ts.isNamedImports(cl.namedBindings) && cl.namedBindings.elements.length > 0 &&
          cl.namedBindings.elements.every((e) => e.isTypeOnly)));
      if (!cl) typeOnly = false; // import "x" (tác dụng phụ)
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier) {
      spec = st.moduleSpecifier;
      typeOnly = st.isTypeOnly;
    }
    if (spec && ts.isStringLiteral(spec)) out.push({ spec: spec.text, typeOnly, start: spec.getStart(sf), end: spec.getEnd(), node: st });
  }
  // import("x").Kieu trong khai báo kiểu ⇒ chỉ kiểu
  const walk = (n) => {
    if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal)) {
      const lit = n.argument.literal;
      const name = n.qualifier ? (ts.isIdentifier(n.qualifier) ? n.qualifier.text : n.qualifier.right.text) : null;
      out.push({ spec: lit.text, typeOnly: true, start: lit.getStart(sf), end: lit.getEnd(), node: null, typeName: name });
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

function toSrcRel(fromRel, spec) {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  return null; // thư viện ngoài
}

const isImpure = (rel) => !COPY_SERVICES.has(rel) && IMPURE.some((re) => re.test(rel));
const keyOf = (rel) => rel.replace(/\.(tsx?)$/, "").replace(/\/index$/, "");
const isShim = (key) => SHIMS.has(keyOf(key));
const isExtract = (key) => Object.prototype.hasOwnProperty.call(EXTRACT, keyOf(key));

/** Trích các khai báo top-level `names` (+ phụ thuộc cùng tệp) nguyên văn; trả { text, errors } */
function extractDecls(key, names = EXTRACT[key], what = "trích nguyên văn") {
  const f = resolveFile(key);
  if (!f) return { text: "", errors: [`Không thấy ${key} để trích`] };
  const text = fs.readFileSync(f.abs, "utf8");
  const sf = ts.createSourceFile(f.abs, text, ts.ScriptTarget.Latest, true, f.abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declOf = new Map(); // tên ⇒ câu lệnh
  const imported = new Map(); // tên ⇒ { spec, line }
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const cl = st.importClause;
      const spec = st.moduleSpecifier.text;
      const put = (local, txt) => imported.set(local, { spec, txt });
      if (cl?.name) put(cl.name.text, `import ${cl.isTypeOnly ? "type " : ""}${cl.name.text} from ${JSON.stringify(spec)};`);
      if (cl?.namedBindings && ts.isNamedImports(cl.namedBindings))
        cl.namedBindings.elements.forEach((e) => put(e.name.text, `import { ${cl.isTypeOnly || e.isTypeOnly ? "type " : ""}${e.propertyName ? e.propertyName.text + " as " : ""}${e.name.text} } from ${JSON.stringify(spec)};`));
      if (cl?.namedBindings && ts.isNamespaceImport(cl.namedBindings)) put(cl.namedBindings.name.text, `import * as ${cl.namedBindings.name.text} from ${JSON.stringify(spec)};`);
    } else if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && declOf.set(d.name.text, st));
    else if ((ts.isFunctionDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isClassDeclaration(st)) && st.name)
      declOf.set(st.name.text, st);
  }
  const want = new Set();
  const errors = [];
  const importLines = new Set();
  const visit = (name) => {
    const st = declOf.get(name);
    if (!st) { errors.push(`${key}: không thấy khai báo ${name}`); return; }
    if (want.has(st)) return;
    want.add(st);
    const walk = (n) => {
      if (ts.isIdentifier(n)) {
        if (n.text !== name && declOf.has(n.text) && declOf.get(n.text) !== st) visit(n.text);
        const imp = imported.get(n.text);
        if (imp) {
          // Thư viện ngoài đã cho phép ⇒ giữ câu import; import nội bộ ⇒ không trích được (xử lý tay)
          if (!imp.spec.startsWith(".") && !imp.spec.startsWith("@/") && ALLOW_PKGS.has(imp.spec.split("/")[0])) importLines.add(imp.txt);
          else errors.push(`${key}: ${name} dùng import ${n.text} — không trích được`);
        }
      }
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(st, walk);
  };
  names.forEach(visit);
  const parts = sf.statements.filter((st) => want.has(st)).map((st) => text.slice(st.getFullStart(), st.getEnd()).replace(/^\n+/, "")
    // import("@/x").Kieu trỏ module không chép ⇒ any (chỉ ở phần trích kiểu)
    .replace(/import\(\s*["']@\/[^"']+["']\s*\)(\.[A-Za-z_$][\w$]*)+/g, "any"));
  return {
    text: `// ⚠️ TỰ SINH — ${what} từ web src/${f.rel} (scripts/sync-web-pricing.cjs): ${names.join(", ")}. KHÔNG SỬA TAY.\n` +
      [...importLines].join("\n") + (importLines.size ? "\n\n" : "") + parts.join("\n\n") + "\n",
    errors,
  };
}

function collect() {
  const files = new Map(); // rel ⇒ { abs, text, imports }
  const stubs = new Map(); // rel(no ext) ⇒ Set(names)
  const pkgs = new Set();
  const shimsUsed = new Set();
  const errors = [];
  const queue = ENTRIES.map((e) => ({ rel: e, from: "(gốc)" }));
  for (const ce of COMPONENT_EXTRACTS) {
    const plan = planComponent(ce);
    errors.push(...plan.errors);
    plan.imports.forEach((im) => {
      if (im.srcRel) queue.push({ rel: im.srcRel, from: ce.file + " (trích)" });
      else if (SHIMS.has(im.spec)) shimsUsed.add(im.spec);
      else if (!ALLOW_PKGS.has(im.spec.split("/")[0])) errors.push(`${ce.file}: phần trích dùng thư viện ngoài "${im.spec}"`);
    });
  }
  const runtimeStubs = new Map(); // khoá ⇒ Set(tên) — module không thuần hook dùng khi chạy
  for (const hk of COMPONENT_HOOKS) {
    const plan = planHook(hk);
    errors.push(...plan.errors);
    for (const im of plan.imports) {
      if (im.srcRel === null) {
        if (SHIMS.has(im.spec)) { shimsUsed.add(im.spec); continue; }
        if (!ALLOW_PKGS.has(im.spec.split("/")[0]) && !im.allType) errors.push(`${hk.file}: hook dùng thư viện ngoài "${im.spec}"`);
        else if (!im.allType) pkgs.add(im.spec);
        continue;
      }
      const tf = resolveFile(im.srcRel);
      const tRel = tf ? tf.rel : im.srcRel;
      if (isShim(tRel)) { shimsUsed.add(keyOf(tRel)); continue; }
      if (isExtract(tRel)) continue;
      if (isImpure(tRel) || !tf) {
        const key = keyOf(tRel);
        const set = im.allType ? (stubs.get(key) || new Set()) : (runtimeStubs.get(key) || new Set());
        for (const [, m] of im.names) set.add(m.isDefault ? "default" : m.ns ? "*" : m.imported);
        (im.allType ? stubs : runtimeStubs).set(key, set);
        continue;
      }
      queue.push({ rel: im.srcRel, from: hk.file + " (hook)" });
    }
  }
  while (queue.length) {
    const { rel, from } = queue.shift();
    const f = resolveFile(rel);
    if (!f) { errors.push(`Không thấy ${rel} (từ ${from})`); continue; }
    if (files.has(f.rel)) continue;
    if (isImpure(f.rel)) { errors.push(`${f.rel} không thuần nhưng được import chạy thật từ ${from}`); continue; }
    const text = fs.readFileSync(f.abs, "utf8");
    const imports = importsOf(f.abs, text);
    files.set(f.rel, { abs: f.abs, text, imports });
    for (const im of imports) {
      const target = toSrcRel(f.rel, im.spec);
      if (target === null) {
        if (im.typeOnly || SHIMS.has(im.spec)) { if (SHIMS.has(im.spec)) shimsUsed.add(im.spec); continue; }
        if (!ALLOW_PKGS.has(im.spec.split("/")[0])) errors.push(`${f.rel}: thư viện ngoài "${im.spec}" chưa cho phép`);
        pkgs.add(im.spec);
        continue;
      }
      const tf = resolveFile(target);
      const tRel = tf ? tf.rel : target;
      if (isShim(tRel)) { shimsUsed.add(keyOf(tRel)); continue; }
      if (isExtract(tRel)) continue;
      if (isImpure(tRel) || !tf) {
        if (!im.typeOnly) {
          // Chạy thật từ module không thuần / .js ⇒ stub chạy thật (gọi ⇒ lỗi rõ), luồng app cần thì thêm shim
          const key = keyOf(tRel);
          const set = runtimeStubs.get(key) || new Set();
          const cl = im.node?.importClause;
          if (cl?.namedBindings && ts.isNamedImports(cl.namedBindings)) cl.namedBindings.elements.forEach((e) => set.add((e.propertyName || e.name).text));
          if (cl?.namedBindings && ts.isNamespaceImport(cl.namedBindings)) set.add("*");
          if (cl?.name) set.add("default");
          runtimeStubs.set(key, set);
          continue;
        }
        const key = tRel.replace(/\.(tsx?)$/, "").replace(/\/index$/, "");
        const names = stubs.get(key) || new Set();
        if (im.typeName) names.add(im.typeName);
        const cl = im.node?.importClause;
        if (cl?.namedBindings && ts.isNamedImports(cl.namedBindings))
          cl.namedBindings.elements.forEach((e) => names.add((e.propertyName || e.name).text));
        if (cl?.namedBindings && ts.isNamespaceImport(cl.namedBindings)) names.add("*");
        if (cl?.name) names.add("default");
        stubs.set(key, names);
        continue;
      }
      queue.push({ rel: target, from: f.rel });
    }
  }
  return { files, stubs, pkgs, errors, shimsUsed, runtimeStubs };
}

/** Tách thân component: câu giữ / bỏ, import cần, tên trả về */
function planHook(hk) {
  const f = resolveFile(keyOf(hk.file));
  if (!f) return { errors: [`Không thấy ${hk.file}`], imports: [] };
  const text = fs.readFileSync(f.abs, "utf8");
  const sf = ts.createSourceFile(f.abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  let comp = null;
  for (const st of sf.statements) if (ts.isFunctionDeclaration(st) && st.name?.text === hk.component) comp = st;
  if (!comp) return { errors: [`${hk.file}: không thấy component ${hk.component}`], imports: [] };
  const importOf = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const spec = st.moduleSpecifier.text, cl = st.importClause;
    const add = (local, m) => importOf.set(local, { spec, ...m, typeOnly: cl.isTypeOnly || m.typeOnly });
    if (cl.name) add(cl.name.text, { isDefault: true });
    if (cl.namedBindings && ts.isNamespaceImport(cl.namedBindings)) add(cl.namedBindings.name.text, { ns: true });
    if (cl.namedBindings && ts.isNamedImports(cl.namedBindings))
      cl.namedBindings.elements.forEach((e) => add(e.name.text, { imported: (e.propertyName || e.name).text, typeOnly: e.isTypeOnly }));
  }
  const isUiImport = (local) => {
    const m = importOf.get(local);
    if (!m || m.typeOnly) return false;
    if (UI_PKG.test(m.spec)) return true;
    const rel = toSrcRel(f.rel, m.spec);
    if (rel === null) return false;
    const tf = resolveFile(rel);
    const r = tf ? tf.rel : rel;
    if (isShim(r) || isExtract(r)) return false;
    return UI_PATH.some((re) => re.test(r)) || /\.tsx$/.test(r);
  };
  const hasJsx = (n) => { let hit = false; const w = (x) => { if (hit) return; if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { hit = true; return; } ts.forEachChild(x, w); }; w(n); return hit; };
  const runtimeIds = (n) => {
    const out = new Set();
    const w = (x) => {
      if (ts.isIdentifier(x)) {
        const p = x.parent;
        const skip = p && ((ts.isPropertyAccessExpression(p) && p.name === x) || (ts.isPropertyAssignment(p) && p.name === x) ||
          (ts.isQualifiedName(p)) || ts.isTypeReferenceNode(p) || (ts.isBindingElement(p) && p.propertyName === x));
        if (!skip) out.add(x.text);
      }
      if (ts.isTypeNode(x) && !ts.isTypeReferenceNode(x)) return; // bỏ qua kiểu
      ts.forEachChild(x, w);
    };
    w(n);
    return out;
  };
  const allIds = (n) => { const out = new Set(); const w = (x) => { if (ts.isIdentifier(x)) out.add(x.text); ts.forEachChild(x, w); }; w(n); return out; };
  const declNames = (st) => {
    const out = [];
    const add = (b) => { if (ts.isIdentifier(b)) out.push(b.text); else if (b.elements) b.elements.forEach((e) => e.name && add(e.name)); };
    if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach((d) => add(d.name));
    if (ts.isFunctionDeclaration(st) && st.name) out.push(st.name.text);
    return out;
  };
  const stmts = comp.body.statements;
  const last = stmts[stmts.length - 1];
  const kept = [], dropped = [];
  for (const st of stmts) {
    if (st === last && ts.isReturnStatement(st)) continue;
    const ui = hasJsx(st) || [...runtimeIds(st)].some(isUiImport);
    (ui ? dropped : kept).push(st);
  }
  const keptIds = new Set(); kept.forEach((st) => allIds(st).forEach((x) => keptIds.add(x)));
  const keptRuntime = new Set(); kept.forEach((st) => runtimeIds(st).forEach((x) => keptRuntime.add(x)));
  const keptDecl = new Set(); kept.forEach((st) => declNames(st).forEach((n) => keptDecl.add(n)));
  for (const st of dropped) for (const n of declNames(st))
    if (keptIds.has(n) && !keptDecl.has(n) && !hk.allowMissing.includes(n))
      errors.push(`${hk.file}: logic dùng "${n}" khai báo ở câu giao diện (dòng ${sf.getLineAndCharacterOfPosition(st.getStart()).line + 1})`);
  // Import cần
  const need = new Map();
  for (const n of keptIds) {
    const m = importOf.get(n);
    if (!m) continue;
    const e = need.get(m.spec) || { spec: m.spec, names: new Map(), srcRel: toSrcRel(f.rel, m.spec), allType: true };
    const asType = m.typeOnly || !keptRuntime.has(n);
    e.names.set(n, { ...m, typeOnly: asType });
    if (!asType) e.allType = false;
    need.set(m.spec, e);
  }
  const param = comp.parameters[0];
  return {
    errors, imports: [...need.values()], kept, dropped, sf, text, f,
    paramText: param ? text.slice(param.name.getStart(sf), param.name.getEnd()) : "",
    returns: [...keptDecl],
  };
}

function renderHook(hk) {
  const plan = planHook(hk);
  const lines = [`// ⚠️ TỰ SINH — thân component ${hk.component} của web src/${plan.f.rel} chép NGUYÊN VĂN thành hook (scripts/sync-web-pricing.cjs).`,
    `// Bỏ câu return JSX + ${plan.dropped.length} câu giao diện: ${plan.dropped.map((st) => plan.sf.getLineAndCharacterOfPosition(st.getStart()).line + 1).join(", ")}. KHÔNG SỬA TAY.`,
    `// @ts-nocheck`, `/* eslint-disable */`];
  for (const im of plan.imports) {
    let spec = im.spec;
    if (im.srcRel !== null) {
      const tf = resolveFile(im.srcRel);
      const tRel = keyOf(tf ? tf.rel : im.srcRel);
      const dest = isShim(tRel) ? `_shims/${tRel}` : isExtract(tRel) ? `_extract/${tRel}` : (isImpure(tf ? tf.rel : im.srcRel) || !tf) ? `_stubs/${tRel}` : tRel;
      spec = path.posix.relative(path.posix.dirname(hk.out), dest);
      if (!spec.startsWith(".")) spec = "./" + spec;
    } else if (SHIMS.has(im.spec)) {
      spec = path.posix.relative(path.posix.dirname(hk.out), `_shims/${im.spec}`);
      if (!spec.startsWith(".")) spec = "./" + spec;
    }
    const named = [];
    for (const [local, m] of im.names) {
      if (m.isDefault) lines.push(`import ${m.typeOnly ? "type " : ""}${local} from ${JSON.stringify(spec)};`);
      else if (m.ns) lines.push(`import ${m.typeOnly ? "type " : ""}* as ${local} from ${JSON.stringify(spec)};`);
      else named.push(`${m.typeOnly ? "type " : ""}${m.imported === local ? local : `${m.imported} as ${local}`}`);
    }
    if (named.length) lines.push(`import { ${named.join(", ")} } from ${JSON.stringify(spec)};`);
  }
  lines.push("", `export function ${hk.hook}(${plan.paramText}: any = {}) {`);
  for (const st of plan.kept) lines.push("  " + plan.text.slice(st.getStart(plan.sf), st.getEnd()));
  lines.push(`  return { ${plan.returns.join(", ")} };`, "}");
  return lines.join("\n") + "\n";
}

/** Stub chạy thật cho module không thuần hook import (gọi ⇒ log + Promise lỗi / ném) */
function renderRuntimeStub(key, names) {
  const lines = [`// ⚠️ TỰ SINH (scripts/sync-web-pricing.cjs): stub cho web src/${key} — module không thuần, app không chép.`,
    `// Gọi vào ⇒ log + lỗi "App không hỗ trợ" (thêm shim viết tay lib/web/_shims/${key}.ts nếu luồng app cần).`,
    `// @ts-nocheck`,
    `const make = (path: string): any => new Proxy(function () {}, {`,
    `  get: (_t, k) => (k === "then" ? undefined : make(\`\${path}.\${String(k)}\`)),`,
    `  apply: () => { console.log(\`[lib/web stub] app không hỗ trợ \${path}\`); return Promise.reject(new Error(\`App không hỗ trợ \${path}\`)); },`,
    `});`];
  for (const n of [...names].sort()) {
    if (n === "*") continue;
    if (n === "default") lines.push(`export default make(${JSON.stringify(key + ".default")});`);
    else lines.push(`export const ${n}: any = make(${JSON.stringify(key + "." + n)});`, `export type ${n} = any;`);
  }
  return lines.join("\n") + "\n";
}

const JS_GLOBALS = new Set(["Number", "Math", "String", "Array", "Object", "undefined", "console", "isFinite", "JSON", "Boolean", "Date",
  "NaN", "parseFloat", "parseInt", "Set", "Map", "Infinity", "isNaN", "Promise", "Error", "RegExp", "Symbol", "BigInt", "encodeURIComponent",
  "decodeURIComponent", "structuredClone", "globalThis", "Intl", "Record", "Partial", "Pick", "Omit", "ReturnType", "Readonly", "NonNullable",
  "Exclude", "Extract", "Required", "Parameters", "Awaited", "this", "arguments"]);

/** Phân tích 1 component: các phần trích (nút + định danh tự do) và import cần giữ */
function planComponent(ce) {
  const f = resolveFile(ce.file.replace(/\.tsx?$/, ""));
  const errors = [];
  if (!f) return { errors: [`Không thấy ${ce.file}`], imports: [], parts: [] };
  const text = fs.readFileSync(f.abs, "utf8");
  const sf = ts.createSourceFile(f.abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importOf = new Map(); // tên cục bộ ⇒ { spec, imported, isDefault, ns, typeOnly }
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const spec = st.moduleSpecifier.text, cl = st.importClause;
    if (cl.name) importOf.set(cl.name.text, { spec, isDefault: true, typeOnly: cl.isTypeOnly });
    if (cl.namedBindings && ts.isNamespaceImport(cl.namedBindings)) importOf.set(cl.namedBindings.name.text, { spec, ns: true, typeOnly: cl.isTypeOnly });
    if (cl.namedBindings && ts.isNamedImports(cl.namedBindings))
      cl.namedBindings.elements.forEach((e) => importOf.set(e.name.text, { spec, imported: (e.propertyName || e.name).text, typeOnly: cl.isTypeOnly || e.isTypeOnly }));
  }
  const findVar = (root, name) => {
    let hit = null;
    const go = (n) => { if (hit) return; if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) { hit = n; return; } ts.forEachChild(n, go); };
    go(root);
    return hit;
  };
  const stmtOf = (decl) => { let n = decl; while (n && !ts.isVariableStatement(n)) n = n.parent; return n; };
  const parts = [];
  for (const part of ce.parts) {
    let nodes = [], code = "";
    if (part.kind === "memo" || part.kind === "fn") {
      const d = findVar(sf, part.name);
      if (!d) { errors.push(`${ce.file}: không thấy ${part.name}`); continue; }
      let init = d.initializer;
      if (part.kind === "memo") {
        if (!ts.isCallExpression(init) || !/useMemo$/.test(init.expression.getText())) { errors.push(`${part.name} không phải useMemo`); continue; }
        init = init.arguments[0];
        code = `  return (${text.slice(init.getStart(sf), init.getEnd())})();`;
      } else code = `  return ${text.slice(init.getStart(sf), init.getEnd())};`;
      nodes = [init];
    } else if (part.kind === "range") {
      const fnDecl = findVar(sf, part.inside);
      if (!fnDecl) { errors.push(`${ce.file}: không thấy ${part.inside}`); continue; }
      let block = null, fromIdx = -1;
      const go = (n) => {
        if (block) return;
        if (ts.isBlock(n)) {
          const i = n.statements.findIndex((st) => st.getText(sf).startsWith(part.from));
          if (i >= 0) { block = n; fromIdx = i; return; }
        }
        ts.forEachChild(n, go);
      };
      go(fnDecl.initializer);
      if (!block) { errors.push(`${part.fn}: không thấy câu "${part.from}"`); continue; }
      const untilIdx = block.statements.findIndex((st, i) => i >= fromIdx && ts.isVariableStatement(st) &&
        st.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === part.until));
      if (untilIdx < 0) { errors.push(`${part.fn}: không thấy khai báo ${part.until}`); continue; }
      nodes = block.statements.slice(fromIdx, untilIdx + 1);
      for (const extra of part.plus || []) {
        const d = findVar(fnDecl.initializer, extra);
        const st = d && stmtOf(d);
        if (!st) { errors.push(`${part.fn}: không thấy khai báo ${extra}`); continue; }
        nodes.push(st);
      }
      code = nodes.map((st) => "  " + text.slice(st.getStart(sf), st.getEnd())).join("\n") +
        `\n  return { ${part.returns.join(", ")} };`;
    }
    // Định danh tự do
    const declared = new Set();
    const addB = (b) => { if (ts.isIdentifier(b)) declared.add(b.text); else if (b.elements) b.elements.forEach((e) => e.name && addB(e.name)); };
    const collectDecl = (n) => {
      if (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) addB(n.name);
      if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) declared.add(n.name.text);
      ts.forEachChild(n, collectDecl);
    };
    nodes.forEach(collectDecl);
    const free = new Set(), typesUsed = new Set();
    const walk = (n) => {
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        const skip = p && ((ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) ||
          (ts.isQualifiedName(p) && p.right === n) || (ts.isPropertySignature(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n) ||
          (ts.isBindingElement(p) && p.propertyName === n) || ts.isLabeledStatement(p));
        const inType = p && (ts.isTypeReferenceNode(p) || ts.isExpressionWithTypeArguments(p) || (ts.isQualifiedName(p) && p.left === n));
        if (!skip && !declared.has(n.text) && !JS_GLOBALS.has(n.text)) (inType ? typesUsed : free).add(n.text);
        if (ts.isShorthandPropertyAssignment(p) && !declared.has(n.text) && !JS_GLOBALS.has(n.text)) free.add(n.text);
      }
      ts.forEachChild(n, walk);
    };
    nodes.forEach(walk);
    parts.push({ ...part, code, free: [...free].sort(), types: [...typesUsed].sort() });
  }
  // Import giữ lại
  const need = new Map();
  for (const pt of parts) {
    for (const n of [...pt.free, ...pt.types]) {
      const im = importOf.get(n);
      if (!im) continue;
      const k = im.spec;
      const entry = need.get(k) || { spec: k, names: new Map(), srcRel: toSrcRel(ce.file, k) };
      entry.names.set(n, im);
      need.set(k, entry);
    }
  }
  return { errors, imports: [...need.values()], parts, importOf, file: f.rel };
}

/** Văn bản tệp trích từ component */
function renderComponent(ce) {
  const plan = planComponent(ce);
  const lines = [`// ⚠️ TỰ SINH — trích nguyên văn logic từ web src/${plan.file} (scripts/sync-web-pricing.cjs): ${ce.parts.map((p) => p.fn).join(", ")}.`,
    `// KHÔNG SỬA TAY. Biến của component (state / props / hàm khác) truyền qua ctx.`,
    `// Web biên dịch với strict: false; trích ra khỏi component thì state mất kiểu suy luận ⇒ bỏ kiểm kiểu (hành vi kiểm bằng test so web).`,
    `// @ts-nocheck`, `/* eslint-disable */`];
  for (const im of plan.imports) {
    let spec = im.spec;
    if (im.srcRel !== null) {
      const tf = resolveFile(im.srcRel);
      const tRel = keyOf(tf ? tf.rel : im.srcRel);
      const dest = isShim(tRel) ? `_shims/${tRel}` : isExtract(tRel) ? `_extract/${tRel}` : tRel;
      spec = path.posix.relative(path.posix.dirname(ce.out), dest);
      if (!spec.startsWith(".")) spec = "./" + spec;
    } else if (SHIMS.has(im.spec)) {
      spec = path.posix.relative(path.posix.dirname(ce.out), `_shims/${im.spec}`);
      if (!spec.startsWith(".")) spec = "./" + spec;
    }
    const named = [], defs = [];
    for (const [local, m] of im.names) {
      if (m.isDefault) defs.push(`import ${local} from ${JSON.stringify(spec)};`);
      else if (m.ns) defs.push(`import * as ${local} from ${JSON.stringify(spec)};`);
      else named.push(`${m.typeOnly ? "type " : ""}${m.imported === local ? local : `${m.imported} as ${local}`}`);
    }
    lines.push(...defs);
    if (named.length) lines.push(`import { ${named.join(", ")} } from ${JSON.stringify(spec)};`);
  }
  for (const pt of plan.parts) {
    const ctxFields = pt.free.filter((n) => !plan.importOf.has(n));
    const localTypes = pt.types.filter((n) => !plan.importOf.has(n));
    for (const t of localTypes) lines.push(`type ${t} = any;`);
    const ctxName = pt.fn[0].toUpperCase() + pt.fn.slice(1) + "Ctx";
    lines.push("", `export interface ${ctxName} {`, ...ctxFields.map((n) => `  ${n}: any;`), "}", "",
      `export function ${pt.fn}(__ctx: ${ctxName}): any {`,
      ctxFields.length ? `  const { ${ctxFields.join(", ")} } = __ctx;` : "", pt.code, "}");
  }
  return lines.join("\n") + "\n";
}

const HEADER = (rel) =>
  `// ⚠️ TỰ SINH — bản chép nguyên văn web src/${rel} (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.\n` +
  `// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).\n// @ts-nocheck\n`;

/** Nội dung tệp đích: đầu tệp + văn bản web với đường dẫn import đổi sang tương đối trong lib/web */
function render(rel, file, stubs) {
  let text = file.text;
  const edits = [];
  for (const im of file.imports) {
    const target = toSrcRel(rel, im.spec);
    if (target === null && !SHIMS.has(im.spec)) continue;
    const tf = target === null ? null : resolveFile(target);
    const tRel = target === null ? im.spec : (tf ? tf.rel : target).replace(/\.(tsx?)$/, "").replace(/\/index$/, "");
    const dest = isShim(tRel) ? `_shims/${tRel}` : isExtract(tRel) ? `_extract/${tRel}` : (target !== null && (!tf || isImpure(tf.rel))) ? `_stubs/${tRel}` : tRel;
    let r = path.posix.relative(path.posix.dirname(rel), dest);
    if (!r.startsWith(".")) r = "./" + r;
    edits.push({ start: im.start, end: im.end, val: JSON.stringify(r) });
  }
  edits.sort((a, b) => b.start - a.start).forEach((e) => { text = text.slice(0, e.start) + e.val + text.slice(e.end); });
  return HEADER(rel) + text;
}

function renderStub(key, names) {
  const lines = [`// ⚠️ TỰ SINH (scripts/sync-web-pricing.cjs): kiểu thay thế cho web src/${key} — module không thuần, app không chép.`];
  for (const n of [...names].sort()) {
    if (n === "*" || n === "default") continue;
    lines.push(`export type ${n} = any;`);
  }
  return lines.join("\n") + "\n";
}

function main() {
  if (!fs.existsSync(SRC)) { console.error(`Không thấy repo web: ${SRC}`); process.exit(2); }
  const { files, stubs, pkgs, errors, shimsUsed, runtimeStubs } = collect();
  for (const k of shimsUsed) if (!fs.existsSync(path.join(OUT, "_shims", k + ".ts"))) errors.push(`Thiếu shim viết tay lib/web/_shims/${k}.ts`);
  if (PLAN) {
    console.log(`shim viết tay: ${[...shimsUsed].join(", ") || "-"}`);
    console.log(`${files.size} module:`); [...files.keys()].sort().forEach((k) => console.log("  " + k));
    console.log(`kiểu thay thế:`); [...stubs].forEach(([k, v]) => console.log(`  ${k}: ${[...v].join(", ")}`));
    console.log(`thư viện ngoài: ${[...pkgs].join(", ") || "-"}`);
    console.log(`stub chạy thật (gọi ⇒ lỗi):`); [...runtimeStubs].forEach(([k, v]) => console.log(`  ${k}: ${[...v].join(", ")}`));
  }
  if (errors.length) { console.error("LỖI:\n  " + errors.join("\n  ")); process.exit(1); }
  if (PLAN) return;
  const want = new Map();
  for (const [rel, f] of files) want.set(rel, render(rel, f, stubs));
  for (const [key, names] of stubs) {
    if (runtimeStubs.has(key)) continue;
    const list = [...names].filter((n) => n !== "*" && n !== "default").sort();
    const ex = extractDecls(key, list, "kiểu trích nguyên văn (module không thuần)");
    want.set(`_stubs/${key}.ts`, ex.errors.length ? renderStub(key, names) : ex.text);
  }
  for (const ce of COMPONENT_EXTRACTS) want.set(ce.out, renderComponent(ce));
  for (const hk of COMPONENT_HOOKS) want.set(hk.out, renderHook(hk));
  for (const [key, names] of runtimeStubs) {
    // Vừa cần kiểu vừa cần chạy ⇒ stub chạy thật kèm kiểu any (tệp @ts-nocheck)
    const all = new Set([...names, ...(stubs.get(key) || [])]);
    want.set(`_stubs/${key}.ts`, renderRuntimeStub(key, all));
  }
  for (const key of Object.keys(EXTRACT)) {
    const ex = extractDecls(key);
    if (ex.errors.length) { console.error("LỖI trích:\n  " + ex.errors.join("\n  ")); process.exit(1); }
    want.set(`_extract/${key}.ts`, ex.text);
  }
  const have = new Map();
  const walk = (d) => fs.existsSync(d) && fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (path.relative(OUT, p) !== "_shims") walk(p); }
    else if (/\.tsx?$/.test(e.name)) have.set(path.relative(OUT, p).replace(/\\/g, "/"), fs.readFileSync(p, "utf8"));
  });
  walk(OUT);
  const diff = [];
  for (const [rel, txt] of want) if (have.get(rel) !== txt) diff.push((have.has(rel) ? "khác  " : "thiếu ") + rel);
  for (const rel of have.keys()) if (!want.has(rel)) diff.push("thừa  " + rel);
  if (CHECK) {
    if (diff.length) { console.error(`lib/web lệch web (${WEB}):\n  ` + diff.join("\n  ")); process.exit(1); }
    console.log(`lib/web khớp web: ${want.size} tệp`);
    return;
  }
  for (const e of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (e !== "_shims") fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
  for (const [rel, txt] of want) {
    const p = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, txt);
  }
  console.log(`Đã chép ${files.size} module + ${stubs.size} kiểu thay thế vào lib/web (${diff.length} thay đổi).`);
}

main();
