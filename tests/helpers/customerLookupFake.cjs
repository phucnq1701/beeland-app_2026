/* global __dirname */
/**
 * Nạp sevicesSupabase/customerLookup.ts thật với axios giả: RPC fn_customer_get_by_ids đọc từ `getRows()` (mảng khách
 * trong fixture), lọc theo p_ids (uuid) hoặc p_refs (ma_so_kh / di_dong) như máy chủ. Dùng cho harness vm của các service
 * chứng từ (bảng cloud_customers đã khoá đọc thẳng — app không được gọi rest/v1/cloud_customers).
 * `calls` (tuỳ chọn) nhận { fn, body } mỗi lần gọi RPC.
 */
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

function loadCustomerLookup(getRows, { calls, fail } = {}) {
  const http = {
    post: async (url, body) => {
      const fn = url.replace("rest/v1/rpc/", "");
      if (calls) calls.push({ fn, body });
      if (fn !== "fn_customer_get_by_ids") throw new Error(`unexpected rpc ${fn}`);
      if (fail) throw new Error("RPC failed");
      const rows = getRows() || [];
      const ids = (body.p_ids || []).map((x) => String(x).toLowerCase());
      const refs = body.p_refs || [];
      return {
        data: rows.filter(
          (r) => ids.includes(String(r.id).toLowerCase()) || refs.includes(r.ma_so_kh) || refs.includes(r.di_dong)
        ),
      };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../../sevicesSupabase/customerLookup.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    console,
    require: (name) => {
      if (name === "./axiosApiSupabase") return { default: http };
      throw new Error(`unexpected require ${name}`);
    },
  });
  return exports;
}

module.exports = { loadCustomerLookup };
