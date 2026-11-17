/* global __dirname */
// Shim viết tay các bước Phiếu tính giá (lib/web/_shims/.../priceSheetConstants.ts) phải cùng id + THỨ TỰ với web
// (src/components/PriceSheet/priceSheetConstants.tsx, bỏ dòng chú thích). Web đổi thứ tự bước (vd 2026-11-17 Khách hàng lên đầu) ⇒ test đỏ.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WEB = path.join(__dirname, "..", "..", "beeland");
const ids = (src) =>
  src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n")
    .match(/PRICESHEET_STEPS\s*=\s*\[([\s\S]*?)\];/)[1]
    .match(/id:\s*"([^"]+)"/g)
    .map((m) => m.replace(/id:\s*"|"/g, ""));

test("bước Phiếu tính giá của app (shim) = web: cùng id, cùng thứ tự", { skip: !fs.existsSync(WEB) && "không có repo web cạnh app" }, () => {
  const web = ids(fs.readFileSync(path.join(WEB, "src/components/PriceSheet/priceSheetConstants.tsx"), "utf8"));
  const app = ids(fs.readFileSync(path.join(__dirname, "..", "lib/web/_shims/components/PriceSheet/priceSheetConstants.ts"), "utf8"));
  assert.deepEqual(app, web);
});
