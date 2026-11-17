/* global __dirname */
/**
 * Nạp module TypeScript của app (đặc biệt lib/web — bản chép web) trong node: biên dịch .ts khi require, `@/x` ⇒ thư mục app,
 * module giả cho các phụ thuộc chạy trên thiết bị (vd "@/services/nvApi", "@/services/session").
 *   const { loadApp } = require("./helpers/webLib.cjs");
 *   const m = loadApp("lib/web/components/PriceSheet/PriceSheetForm.logic.ts", { "@/services/nvApi": {...} });
 * Mỗi lần gọi xoá cache module app ⇒ module giả mới có hiệu lực.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const APP = path.join(__dirname, "..", "..");
let fakes = {};

if (!require.extensions[".ts"]) {
  require.extensions[".ts"] = (m, filename) => {
    const src = fs.readFileSync(filename, "utf8");
    const out = ts.transpileModule(src, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    m._compile(out, filename);
  };
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    if (Object.prototype.hasOwnProperty.call(fakes, request)) return `fake:${request}`;
    if (request.startsWith("@/")) request = path.join(APP, request.slice(2));
    const file = orig.call(this, request, parent, ...rest);
    // Giả cả khi module được import bằng đường dẫn tương đối: so theo "@/<đường dẫn app không đuôi>"
    const alias = "@/" + path.relative(APP, file).replace(/\\/g, "/").replace(/\.(tsx?|cjs|js)$/, "");
    if (!alias.startsWith("@/..") && Object.prototype.hasOwnProperty.call(fakes, alias)) return `fake:${alias}`;
    return file;
  };
  const origLoad = Module._load;
  Module._load = function (request, parent, ...rest) {
    if (Object.prototype.hasOwnProperty.call(fakes, request)) return fakes[request];
    const r = Module._resolveFilename(request, parent, ...rest);
    if (r.startsWith("fake:")) return fakes[r.slice(5)];
    return origLoad.call(this, request, parent, ...rest);
  };
}

function loadApp(rel, modules = {}) {
  fakes = modules;
  for (const k of Object.keys(require.cache)) if (k.startsWith(APP + path.sep) && !k.includes(`${path.sep}node_modules${path.sep}`)) delete require.cache[k];
  return require(path.join(APP, rel));
}

module.exports = { loadApp, APP };
