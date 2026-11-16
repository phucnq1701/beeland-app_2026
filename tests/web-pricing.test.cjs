// lib/web = bản chép NGUYÊN VĂN logic phiếu tính giá của web (scripts/sync-web-pricing.cjs):
//  1. lib/web khớp từng ký tự với repo web (khi có repo web cạnh app) — web đổi ⇒ test đỏ, chạy lại script.
//  2. Shim viết tay (supabase ⇒ fn_nv_app_*, sonner, session) đúng hợp đồng.
//  3. Lắp các phần trích từ PriceSheetForm (webCalculations, lịch thanh toán, dựng dữ liệu lưu) ra đúng số web đã lưu của phiếu thật.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { loadApp, APP } = require("./helpers/webLib.cjs");

const plain = (v) => JSON.parse(JSON.stringify(v));
const hasWeb = fs.existsSync(path.join(APP, "..", "beeland", "src"));

test("lib/web khớp nguyên văn repo web", { skip: !hasWeb && "không có repo web cạnh app" }, () => {
  const out = execFileSync(process.execPath, [path.join(APP, "scripts", "sync-web-pricing.cjs"), "--check"], { encoding: "utf8" });
  assert.match(out, /khớp web/);
});

function fakeNv(handler) {
  const calls = [];
  return {
    calls,
    mod: {
      callNv: async (fn, args) => { calls.push({ fn, args }); return handler(fn, args); },
      errorMessage: (e, f) => e?.message || f || "lỗi",
    },
  };
}

test("shim supabase: chỉ 2 hàm đọc đối chiếu sang fn_nv_app_*; hàm lạ / bảng lạ ⇒ error; da_projects qua danh sách dự án", async () => {
  const nv = fakeNv((fn) => (fn === "fn_nv_app_chinh_sach_chi_tiet" ? [{ id: "p1" }] : fn === "fn_nv_app_du_an_list" ? { rows: [{ id: "d1", ten_da: "Dự án 1", ma_da_code: "DA1" }] } : null));
  const { supabase } = loadApp("lib/web/_shims/integrations/supabase/client.ts", { "@/services/nvApi": nv.mod });
  const r = await supabase.rpc("fn_get_byid_sales_policy", { p_id: "p1", p_ma_ctdk: "x" });
  assert.deepEqual(plain(r), { data: [{ id: "p1" }], error: null });
  assert.deepEqual(plain(nv.calls[0]), { fn: "fn_nv_app_chinh_sach_chi_tiet", args: { p_id: "p1" } }, "không gửi công ty");
  await supabase.rpc("fn_get_byid_payment_schedule", { p_id: "s1" });
  assert.equal(nv.calls[1].fn, "fn_nv_app_lich_tt_chi_tiet");
  const bad = await supabase.rpc("fn_sales_policy_save", {});
  assert.equal(bad.data, null);
  assert.match(bad.error.message, /không hỗ trợ/);
  assert.equal(nv.calls.length, 2, "hàm lạ không gọi máy chủ");
  const prj = await supabase.from("da_projects").select("id, ten_da").eq("ma_ctdk", "x").order("ten_da");
  assert.deepEqual(plain(prj.data), [{ id: "d1", ten_da: "Dự án 1", ma_da_code: "DA1" }]);
  const tbl = await supabase.from("cloud_customers").select("*");
  assert.match(tbl.error.message, /không đọc thẳng/);
});

test("shim sonner + session", async () => {
  const { toast, onWebToast } = loadApp("lib/web/_shims/sonner.ts");
  const got = [];
  const off = onWebToast((t) => got.push(t));
  toast.warning("Chính sách chờ duyệt");
  toast("x");
  off();
  toast.error("không ai nghe");
  assert.deepEqual(got, [{ type: "warning", message: "Chính sách chờ duyệt" }, { type: "info", message: "x" }]);
  const s = loadApp("lib/web/_shims/lib/session.ts", { "@/services/session": { getUser: async () => ({ company_id: "c1" }) } });
  assert.equal(s.sessionCompanyId(), "");
  await s.primeWebSession();
  assert.equal(s.sessionCompanyId(), "c1");
});

// Phiếu thật BRG (cấu hình CSCAOTANG c6174e95…, chính sách b9e637d8…, tiến độ df434514…) — số web đã lưu, như tests/price-sheet-calc
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
const POLICY_DETAIL = [
  { TenChietKhau: "Mở bán", HeSo: 1, Loai: "percentage", GiaTri: 2 },
  { TenChietKhau: "ck booking sớm", HeSo: 1, Loai: "percentage", GiaTri: 5 },
  { TenChietKhau: "Ck thanh toán thường", HeSo: 2, Loai: "percentage", GiaTri: 2 },
];
const FORM = {
  loaiSP: "Chung cư", maSanPham: "C1-1001", tyLeVAT: 10, tyLePBT: 2, tienCoc: 200000000,
  dienTichThongThuy: 0, donGiaSuDungDat: 0, donGiaDatPhanBo: 2971006,
  dienTichDat: 0, donGiaDat: 0, dienTichXD: 0, tongDTSanXD: 0, donGiaXD: 0,
  rawTongGiaChuaVAT: 5636787781.818181, rawTongGiaDaVAT: 6200466560, rawTienVAT: 547397665.3018181,
  rawTienPhiBaoTri: 112735755.63636363, rawTongGomPBT: 6313202315.636364,
};
const SAVED_ROUNDS = [
  { CKTien: 124009331.2, TongGiaChuaVAT: 5524052026.181818, VAT: 552405202.6181817, TongGiaGomVAT: 6076457228.8, PhiBaoTri: 110481040.52363636, TongGiaTriHDMB: 6186938269.323637 },
  { CKTien: 313822861.44, TongGiaChuaVAT: 5524052026.181818, VAT: 552405202.6181817, TongGiaGomVAT: 5762634367.360001, PhiBaoTri: 110481040.52363636, TongGiaTriHDMB: 5873115407.883637 },
  { CKTien: 125252687.3472, TongGiaChuaVAT: 5238758515.781818, VAT: 523875851.57818186, TongGiaGomVAT: 5637381680.0128, PhiBaoTri: 104775170.31563637, TongGiaTriHDMB: 5742156850.328437 },
];

async function brg() {
  const deps = { "@/services/nvApi": fakeNv(() => null).mod, "@/services/session": { getUser: async () => null } };
  const helpers = loadApp("lib/web/components/Products/ContractForm/helpers.ts", deps);
  const logic = loadApp("lib/web/components/PriceSheet/PriceSheetForm.logic.ts", deps);
  const template = await helpers.loadRoundsFromCauHinh("c6174e95", false, {
    getDetailById: async () => ({ data: CFG_ROUNDS }),
    getDetailByIdByDetail: async () => ({ status: 2000, details: [] }),
  }, () => []);
  // Như web khi chọn chính sách: dòng RPC thô ⇒ DaSalesPolicyService (chép) chuẩn hoá ListChiTiet ⇒ dựng bảng CK
  const svc = loadApp("lib/web/services/DaSalesPolicyService.ts", deps);
  const details = svc.fromRpcRow({ id: "b9e637d8", ten_cs: "CS BRG", detail: POLICY_DETAIL }).ListChiTiet;
  const rounds = helpers.buildRoundsFromPolicyDetails(details, template);
  rounds[1].tienCK = 10000000;
  rounds[2].tienCK = 10000000;
  const calc = logic.webCalculations({
    formData: FORM, policyRounds: rounds, product: null, restoredChinhSachSnapshot: null, financialEdited: true,
    selectedDiscountIds: [], discounts: [], getRestoredRoundResults: logic.webGetRestoredRoundResults({}),
  });
  return { helpers, logic, rounds, calc };
}

test("phiếu thật BRG: webCalculations (chép nguyên văn PriceSheetForm) ra đúng số web đã lưu", async () => {
  const { calc } = await brg();
  assert.equal(calc.roundResults.length, 3);
  calc.roundResults.forEach((r, i) => {
    const s = SAVED_ROUNDS[i];
    assert.equal(r.tongCK, s.CKTien, `vòng ${i + 1} TongCK`);
    assert.equal(r.tongChuaVAT, s.TongGiaChuaVAT, `vòng ${i + 1} TongChuaVAT`);
    assert.equal(r.vat, s.VAT, `vòng ${i + 1} VAT`);
    assert.equal(r.tongGomVAT, s.TongGiaGomVAT, `vòng ${i + 1} TongGomVAT`);
    assert.equal(r.phiBaoTri, s.PhiBaoTri, `vòng ${i + 1} PhiBaoTri`);
    assert.equal(r.tongGiaTriHD, s.TongGiaTriHDMB, `vòng ${i + 1} TongGiaTriHD`);
  });
  assert.equal(calc.tongGiaTriHD, 5742156850.328437);
});

test("chưa chọn chính sách ⇒ giá giữ nguyên giá bảng giá (nhánh không vòng)", async () => {
  const { logic } = await brg();
  const c = logic.webCalculations({ formData: FORM, policyRounds: [], product: null, restoredChinhSachSnapshot: null, financialEdited: false,
    selectedDiscountIds: [], discounts: [], getRestoredRoundResults: logic.webGetRestoredRoundResults({}) });
  assert.equal(c.tongGiaTriHD, FORM.rawTongGomPBT);
  assert.equal(c.tienChietKhau, 0);
  assert.equal(c.conPhaiThanhToan, FORM.rawTongGomPBT - FORM.tienCoc);
});
