/* global __dirname */
// Nạp một file TS thuần (không import react-native) để test bằng node:test.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compileSource(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

/**
 * @param {string} file đường dẫn tính từ gốc repo
 * @param {{ source?: string, modules?: Record<string, unknown> }} [opts]
 *   source: nội dung thay cho file trên đĩa; modules: ánh xạ tên require → exports
 */
function loadTs(file, opts = {}) {
  const source = opts.source ?? fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");
  const module = { exports: {} };
  vm.runInNewContext(compileSource(source), {
    module,
    exports: module.exports,
    require: (name) => {
      if (opts.modules && name in opts.modules) return opts.modules[name];
      throw new Error(`loadTs: không có module "${name}" cho ${file}`);
    },
    Date, Math, Number, String, Object, Array, JSON, RegExp, Error,
  });
  return module.exports;
}

module.exports = { loadTs };
