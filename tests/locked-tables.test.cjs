/* global __dirname */
// Bảng đã khoá đọc thẳng (REVOKE khỏi authenticated) — service chứng từ không được đọc qua rest/v1 hay embed PostgREST
// (embed làm hỏng cả câu truy vấn). Khách: sevicesSupabase/customerLookup (fn_customer_get_by_ids); đã thu: fn_pgc_collected /
// fn_cash_vouchers_by_pgc. Nguồn: beeland/supabase/migrations/20261020000510_ds_dot5_customer_revoke.sql (+ đợt ds_dot3).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "../sevicesSupabase");
// Màn / service khách hàng do nhánh riêng chuyển sang RPC; customerLookup chỉ nhắc tên bảng trong chú thích
const SKIP = new Set(["CustomerService.ts", "CustomerRulesService.ts", "CustomerRequestService.ts", "customerLookup.ts"]);
const LOCKED = ["cloud_customers", "cloud_cash_voucher_details", "cloud_cash_vouchers", "cloud_customer_requests", "cloud_workflows"];

test("document services do not read locked tables directly or embed them", () => {
  const bad = [];
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".ts") && !SKIP.has(f))) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    for (const t of LOCKED) {
      const re = new RegExp(`rest/v1/${t}\\b|["'\`(]${t}["'\`]|:${t}!|\\b${t}\\(`);
      if (re.test(src)) bad.push(`${f}: ${t}`);
    }
  }
  assert.deepEqual(bad, []);
});
