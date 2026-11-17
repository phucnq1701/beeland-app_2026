/* global __dirname */
// Bảng đã khoá đọc thẳng (REVOKE khỏi authenticated) — service chứng từ không được đọc qua rest/v1 hay embed PostgREST
// (embed làm hỏng cả câu truy vấn). Khách: services/customerLookup (fn_customer_get_by_ids); đã thu: fn_pgc_collected /
// fn_cash_vouchers_by_pgc. Nguồn: beeland/supabase/migrations/20261020000510_ds_dot5_customer_revoke.sql (+ đợt ds_dot3).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "../services");
// Màn / service khách hàng do nhánh riêng chuyển sang RPC; customerLookup chỉ nhắc tên bảng trong chú thích
const SKIP = new Set(["customerLookup.ts"]);
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

// Đã chuyển hẳn sang bộ API riêng app (api/app-nhan-vien/fn_nv_app_*): không còn gọi Supabase (rest / functions, axios Supabase).
// ("/storage/v1/" chỉ còn trong hàm đổi URL ký nội bộ → địa chỉ công khai, không phải lời gọi)
const MIGRATED = ["BookingService.ts", "CustomerService.ts", "CustomerRulesService.ts", "CustomerRequestService.ts", "ReportService.ts", "DatCocService.ts", "HopDongService.ts", "PaymentGatewayService.ts",
  "PaymentProgressService.ts", "PriceSheetService.ts", "ProductService.ts", "ProjectService.ts", "SigningService.ts", "customerLookup.ts",
  "ChatService.ts", "NotificationService.ts", "DocumentService.ts", "AccountDeletionService.ts", "StaffResetPasswordService.ts", "realtimeHub.ts"];

test("migrated services use only the app's own API (no Supabase rest / functions / storage)", () => {
  const bad = [];
  for (const f of MIGRATED) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    if (/axiosApiSupabase|rest\/v1|functions\/v1/.test(src)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});
