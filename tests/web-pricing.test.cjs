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
  assert.deepEqual(plain(prj.data), [{ id: "d1", ten_da: "Dự án 1", ten_viet_tat: null, ma_da_code: "DA1" }]);
  const tbl = await supabase.from("cloud_customers").select("*");
  assert.match(tbl.error.message, /đọc thẳng bảng/);
  const w = await supabase.from("da_projects").insert({ id: "x" });
  assert.match(w.error.message, /ghi bảng/);
});

test("shim supabase: đổi tham số web ⇒ app (bỏ công ty), đọc bảng cấu hình tính giá qua endpoint app", async () => {
  const nv = fakeNv((fn, a) => (fn === "fn_nv_app_cau_hinh_tinh_gia_list" ? [{ id: "c1", ma_da: undefined, form_code: "CSCAOTANG", ten: "A" }] : fn === "fn_nv_app_cau_hinh_tinh_gia_dot" ? [{ id: "r1", cau_hinh_id: "c1" }] : []));
  const { supabase, RPC_MAP } = loadApp("lib/web/_shims/integrations/supabase/client.ts", { "@/services/nvApi": nv.mod });
  await supabase.rpc("fn_get_current_price_lists", { p_ma_ctdk_uid: "T", p_da_project_id: "D", p_type: "Chung cư", p_product_id: "S" });
  await supabase.rpc("fn_get_payment_schedules", { p_ma_ctdk: "T", p_company_id: "D", p_form_code: "CAOTANG" });
  await supabase.rpc("fn_sales_setting_resolve", { p_ma_da: "D", p_at: "2026-11-16" });
  await supabase.rpc("fn_sales_policy_option_usage", { p_policy_id: "P", p_exclude_pgc_id: null });
  await supabase.rpc("fn_price_sheet_save", { p_row: { id: 1 }, p_host_form: "/x" });
  assert.deepEqual(plain(nv.calls), [
    { fn: "fn_nv_app_bang_gia_hien_hanh", args: { p_du_an_id: "D", p_loai: "Chung cư", p_san_pham_id: "S" } },
    { fn: "fn_nv_app_lich_tt_list", args: { p_du_an_id: "D", p_form_code: "CAOTANG" } },
    { fn: "fn_nv_app_cai_dat_ban_hang", args: { p_du_an_id: "D", p_ngay: "2026-11-16" } },
    { fn: "fn_nv_app_tuy_chon_da_dung", args: { p_chinh_sach_id: "P", p_tru_pgc_id: null } },
    { fn: "fn_nv_app_ptg_luu", args: { p_row: { id: 1 } } },
  ]);
  for (const k of Object.keys(RPC_MAP)) assert.equal(JSON.stringify(RPC_MAP[k].args({ p_ma_ctdk: "T", p_ma_ctdk_uid: "T" })).includes('"T"'), false, `${k} không gửi công ty`);
  nv.calls.length = 0;
  const cfg = await supabase.from("cloud_pricing_configs").select("*").eq("ma_ctdk", "T").eq("ma_da", "D").eq("form_code", "CSCAOTANG").order("created_at");
  assert.deepEqual(plain(nv.calls[0]), { fn: "fn_nv_app_cau_hinh_tinh_gia_list", args: { p_du_an_id: "D", p_form_codes: ["CSCAOTANG"] } });
  assert.equal(cfg.data.length, 1);
  const shared = await supabase.from("cloud_pricing_configs").select("*").eq("la_mau_chung", true).in("ma_ctdk", ["x"]);
  assert.deepEqual(plain(shared.data), []);
  const rd = await supabase.from("cloud_pricing_config_rounds").select("*").eq("id", "r1").maybeSingle();
  assert.equal(rd.data.id, "r1");
  assert.deepEqual(plain(nv.calls[1].args), { p_id: "r1" });
});

test("shim supabase (form booking): giá căn theo bảng giá = SP web, bds_products theo uuid / .or(ma_sp, ky_hieu)", async () => {
  const nv = fakeNv((fn, a) =>
    fn === "fn_nv_app_gia_can_bang_gia" ? [{ id: "i1" }]
    : fn === "fn_nv_app_san_pham_tinh_gia" ? (a.p_id === "C6-2301" || a.p_id === "u1" ? { id: "u1", ma_da: "d1", ma_sp: "M1", ky_hieu: "C6-2301" } : null)
    : null);
  const { supabase } = loadApp("lib/web/_shims/integrations/supabase/client.ts", { "@/services/nvApi": nv.mod });
  const pi = await supabase.rpc("fn_get_price_list_item_by_product", { p_price_list_id: "B", p_product_id: "u1", p_ma_ctdk_uid: "T" });
  assert.deepEqual(plain(nv.calls[0]), { fn: "fn_nv_app_gia_can_bang_gia", args: { p_price_list_id: "B", p_product_id: "u1" } });
  assert.deepEqual(plain(pi.data), [{ id: "i1" }]);
  const da = await supabase.from("bds_products").select("ma_da").eq("id", "u1").limit(1).maybeSingle();
  assert.equal(da.data.ma_da, "d1");
  nv.calls.length = 0;
  const byCode = await supabase.from("bds_products").select("id").eq("ma_ctdk", "T").limit(1).or("ma_sp.eq.XX,ky_hieu.eq.C6-2301").maybeSingle();
  assert.equal(byCode.data.id, "u1", "khớp ký hiệu");
  assert.deepEqual(nv.calls.map((c) => c.args.p_id), ["XX", "C6-2301"], "thử lần lượt từng khoá");
  const none = await supabase.from("bds_products").select("id").or("ma_sp.eq.ZZ").maybeSingle();
  assert.equal(none.data, null);
  const nokey = await supabase.from("bds_products").select("id");
  assert.match(nokey.error.message, /thiếu khoá/);
});

test("shim CodeGenService: số phiếu xem trước qua fn_nv_app_ma_phieu (như web: bỏ biến rỗng, viết hoa), {TenDA} = tên viết tắt", async () => {
  const nv = fakeNv((fn, a) =>
    fn === "fn_nv_app_ma_phieu" ? (a.p_form_code === "BOOKING" ? "BK-CS-2026-0001" : null)
    : fn === "fn_nv_app_du_an_list" ? { rows: [{ id: "11111111-1111-4111-8111-111111111111", ten_da: "Capital Square 2", ten_viet_tat: "CS", ma_da_code: "CS2" }, { id: "22222222-2222-4222-8222-222222222222", ten_da: "Dự án B", ten_viet_tat: "", ma_da_code: "B" }] }
    : null);
  const fakes = { "@/services/nvApi": nv.mod };
  fakes["../integrations/supabase/client"] = loadApp("lib/web/_shims/integrations/supabase/client.ts", fakes);
  const cg = loadApp("lib/web/_shims/services/CodeGenService.ts", fakes);
  assert.equal(await cg.generateFormCode("booking", { MaSP: "C1-1001", TenDA: "CS", Rong: "  ", Null: null }), "BK-CS-2026-0001");
  assert.deepEqual(plain(nv.calls[0]), { fn: "fn_nv_app_ma_phieu", args: { p_form_code: "BOOKING", p_vars: { MaSP: "C1-1001", TenDA: "CS" } } });
  assert.equal(await cg.generateFormCode("KHONGCO", {}), null, "chưa cấu hình ⇒ null");
  assert.equal(await cg.projectTenDA("11111111-1111-4111-8111-111111111111", "x"), "CS");
  assert.equal(await cg.projectTenDA("B", "x"), "Dự án B", "không có viết tắt ⇒ tên đầy đủ");
  assert.equal(await cg.projectTenDA(null, "Dự phòng"), "Dự phòng");
  assert.deepEqual(plain(await cg.getProjectCodeVars("CS2")), { TenDA: "CS", MaDA: "CS2" });
});

test("shim ProductService.addBookingAPI: body như web ⇒ fn_nv_app_booking_tao, báo phiếu vừa tạo; lỗi ⇒ status 500 + lời máy chủ", async () => {
  let fail = false;
  const nv = fakeNv((fn) => {
    if (fail) throw new Error("Sản phẩm đang ở trạng thái \"HĐMB\" nên không lập được phiếu giữ chỗ");
    return fn === "fn_nv_app_booking_tao" ? { phieu_giu_cho_id: "G1", booking_id: "B1", so_phieu: "BK-1" } : null;
  });
  const mod = loadApp("lib/web/_shims/services/Product.ts", { "@/services/nvApi": nv.mod });
  const got = [];
  const off = mod.onWebBookingCreated((c) => got.push(c.BookingId));
  const res = await mod.ProductService.addBookingAPI({
    SanPhamId: "S", MaSP: "M", KyHieu: "K", MaKH: "KH", MaSan: "SAN", SoPhieu: "", TienGiuCho: "50,000,000", MaDotGia: "BG", MaCS: "CS",
    MaCSTong: "CT", KhuyenMai: [{ ID: "km1" }], Payload: { TTHopDong: { CongTyBanHangId: "CT1" } }, LockId: "L1", TongGiaGomVAT: "100", GiaNaked: 90,
  });
  const body = nv.calls[0].args.p_payload;
  assert.equal(nv.calls[0].fn, "fn_nv_app_booking_tao");
  assert.equal(body.san_pham_id, "S"); assert.equal(body.khach_hang_id, "KH"); assert.equal(body.san_id, "SAN");
  assert.equal(body.tien_giu_cho, 50000000); assert.deepEqual(plain(body.promotion_ids), ["km1"]);
  assert.deepEqual(plain(body.tt_hop_dong), { CongTyBanHangId: "CT1" }); assert.equal(body.lock_id, "L1");
  assert.equal(body.gia.gia_tri_hd, 100, "thiếu tổng gồm PBT ⇒ tổng gồm VAT (như web)"); assert.equal(body.gia.gia_naked, 90);
  assert.equal("ma_ctdk_uid" in body, false, "công ty do máy chủ app lấy từ phiên");
  assert.equal(res.status, 2000); assert.equal(res.data.BookingId, "B1"); assert.equal(res.data.SoPhieu, "BK-1");
  assert.deepEqual(got, ["B1"]);
  off(); fail = true;
  const bad = await mod.ProductService.addBookingAPI({ SanPhamId: "S" });
  assert.equal(bad.status, 500); assert.match(bad.message, /HĐMB/);
  assert.deepEqual(got, ["B1"], "lỗi ⇒ không báo tạo");
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
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `x.${b64({ company_id: "c1", company_code: "BRG", ma_nv: "NV1", type_account: "AGENCY", is_full_access: true, per_id: "00000000-0000-0000-0000-000000000009" })}.y`;
  const s = loadApp("lib/web/_shims/lib/session.ts", { "@/services/session": { getJwt: async () => jwt, getUser: async () => ({ company_id: "khac", branch_id: "b1" }) } });
  assert.equal(s.sessionCompanyId(), "");
  await s.primeWebSession();
  assert.deepEqual(plain(s.tenantScope()), { companyId: "c1", companyCode: "brg", maNV: "NV1", perId: 0, packageCode: "", branchId: "b1", isFullAccess: true, accountType: "AGENCY" });
  assert.equal(s.sessionPermGroupUid(), "00000000-0000-0000-0000-000000000009");
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
