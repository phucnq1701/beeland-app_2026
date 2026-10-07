const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const r = loadTs("lib/customerRules.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));
const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
const ago = (d) => new Date(NOW - d * DAY).toISOString();

const form = (over = {}) => ({
  isPersonal: true, name: "", phone: "", phone2: "", email: "", cccd: "", taxCode: "",
  diaChi: "", statusId: "", sourceId: "", notes: "", nguoiDaiDienPl: "", chucVu: "",
  nddDienThoai: "", nddEmail: "", nddSoCccd: "", ...over,
});

// Nguồn web: services/CustomerDuplicateConfigService.ts
test("duplicate config defaults to the web defaults", () => {
  const cfg = plain(r.normalizeDuplicateConfig(null));
  assert.equal(cfg.defaultMode, "block");
  assert.equal(cfg.ownDuplicateMode, "block");
  assert.equal(cfg.protectionEnabled, true);
  assert.deepEqual(cfg.rules, {});
  assert.deepEqual(cfg.protection, {
    contract: { enabled: true, mode: "block" },
    deposit: { enabled: true, mode: "block" },
    booking: { enabled: true, mode: "request" },
    care_recent: { enabled: true, mode: "request", days: 30 },
    care_old: { enabled: false, mode: "request", days: 90 },
    new_contact: { enabled: true, mode: "request", days: 7 },
  });
});

test("duplicate config keeps valid values and falls back field by field", () => {
  const cfg = r.normalizeDuplicateConfig({
    defaultMode: "allow", rules: { phone: "request", email: "weird" },
    protection: { booking: { enabled: false, mode: "block" }, care_recent: { days: -3 } },
    protectionEnabled: "yes",
  });
  assert.equal(cfg.defaultMode, "allow");
  assert.equal(r.modeOf(cfg, "phone"), "request");
  assert.equal(r.modeOf(cfg, "email"), "allow", "invalid rule → default mode");
  assert.deepEqual(plain(cfg.protection.booking), { enabled: false, mode: "block" });
  assert.equal(cfg.protection.care_recent.days, 30);
  assert.equal(cfg.protectionEnabled, true);
});

// Nguồn web: services/CustomerDuplicateService.ts (evaluateProtection)
test("protection follows the web rule order (strong → weak)", () => {
  const cfg = r.normalizeDuplicateConfig(null);
  const ev = (o) => r.evaluateProtection({ stages: [], careCount: 0, lastCareAt: null, createdAt: null, now: NOW, ...o }, cfg);
  const c = ev({ stages: ["HDMB"] });
  assert.equal(c.level, "high");
  assert.equal(c.ruleKey, "contract");
  assert.equal(c.ruleMode, "block");
  assert.equal(c.hasTransaction, true);
  assert.equal(ev({ stages: ["DATCOC"] }).ruleKey, "deposit");
  const b = ev({ stages: ["GIUCHO"] });
  assert.deepEqual([b.ruleKey, b.ruleMode, b.level], ["booking", "request", "medium"]);
  assert.equal(ev({ careCount: 2, lastCareAt: ago(10) }).ruleKey, "care_recent");
  // Tạo 3 ngày, có 1 chăm sóc hôm qua → care_recent đứng trước new_contact
  assert.equal(ev({ careCount: 1, lastCareAt: ago(1), createdAt: ago(3) }).ruleKey, "care_recent");
  // care_old mặc định tắt
  assert.equal(ev({ careCount: 1, lastCareAt: ago(200) }).ruleKey, null);
  const none = ev({});
  assert.equal(none.level, "none");
  assert.equal(none.ruleMode, null);
  const off = r.evaluateProtection(
    { stages: ["HDMB"], careCount: 0, lastCareAt: null, createdAt: null, now: NOW },
    { ...cfg, protectionEnabled: false }
  );
  assert.equal(off.ruleMode, null);
  assert.equal(off.score, 100);
});

test("final mode per match: own duplicates use ownDuplicateMode, others are raised by protection", () => {
  const cfg = r.normalizeDuplicateConfig({ ownDuplicateMode: "allow" });
  const prot = { ruleMode: "request" };
  assert.equal(r.finalDuplicateMode(["allow"], prot, false, cfg), "request");
  assert.equal(r.finalDuplicateMode(["block", "allow"], prot, false, cfg), "block");
  assert.equal(r.finalDuplicateMode(["block"], prot, true, cfg), "allow");
  assert.equal(r.finalDuplicateMode(["request"], { ruleMode: null }, false, cfg), "request");
  assert.equal(r.strictest("request", "block"), "block");
});

test("duplicate values come from the form like the web payload", () => {
  assert.deepEqual(plain(r.duplicateValues(form({ name: " Nguyễn A ", phone: "0901", cccd: "0123", taxCode: "999" }))), {
    cccd: "0123", phone: "0901", email: "", tax_code: "", full_name: "",
  });
  // Trùng tên không tính là trùng khách (nhiều người trùng họ tên)
  // Web: tab Doanh nghiệp nhập SĐT/email vào DienThoaiCT/EmailCT nên không kiểm DiDong/Email/SoCMND
  const org = plain(r.duplicateValues(form({ isPersonal: false, name: "Cty B", taxCode: "0312", cccd: "x", phone: "0902", email: "b@c.d" })));
  assert.deepEqual(org, { cccd: "", phone: "", email: "", tax_code: "0312", full_name: "" });
});

test("save payload only sends the fields of the current customer type", () => {
  const personal = r.customerSavePayload(form({ name: "A", phone: "0901", cccd: "012", taxCode: "TNCN1" }), "edit");
  assert.equal(personal.cccd, "012");
  assert.equal(personal.taxCode, "TNCN1", "edit keeps the personal tax code");
  assert.equal(r.customerSavePayload(form({ name: "A", taxCode: "x" }), "create").taxCode, null);
  const org = r.customerSavePayload(form({ isPersonal: false, name: "Cty", cccd: "012", taxCode: "0312", nguoiDaiDienPl: "B" }), "create");
  assert.equal(org.cccd, null, "a CCCD typed before switching to business is not saved");
  assert.equal(org.tenCongTy, "Cty");
  assert.equal(org.taxCode, "0312");
  assert.equal(org.nguoiDaiDienPl, "B");
  assert.equal("nguoiDaiDienPl" in personal, false);
});

test("save payload carries the customer note (cloud_customers.ghi_chu), blank → null", () => {
  assert.equal(r.customerSavePayload(form({ name: "A", notes: "  Quan tâm căn 2PN  " }), "create").ghiChu, "Quan tâm căn 2PN");
  assert.equal(r.customerSavePayload(form({ name: "A", notes: "  " }), "edit").ghiChu, null);
});

// Nguồn web: services/RequiredFieldService.ts + config/requiredFieldCatalog.ts (agencyFormKey)
test("form key: agency accounts use agency_customer for personal customers (web agencyFormKey)", () => {
  assert.equal(r.customerFormKey(true, false), "customer");
  assert.equal(r.customerFormKey(true, true), "agency_customer");
  assert.equal(r.customerFormKey(false, false), "customer_org");
  assert.equal(r.customerFormKey(false, true), "customer_org", "the web catalog has no agency_customer_org");
});

test("required fields: app fields get inline errors, hidden ones are skipped, missing app fields block", () => {
  const res = r.checkRequired(
    ["TenKH", "NgaySinh", "Email", "MaSoKH", "MaNguon", "DiDong2", "MaSoTTNCN"],
    new Set(["Email"]),
    form({ sourceId: "u1" }),
    { NgaySinh: "Ngày sinh" }
  );
  assert.equal(res.ok, false);
  assert.equal(res.fieldErrors.name, "Vui lòng nhập Họ và tên");
  assert.equal(res.fieldErrors.email, undefined);
  assert.equal(res.fieldErrors.sourceId, undefined);
  assert.equal(res.fieldErrors.phone2, "Vui lòng nhập Số điện thoại phụ");
  assert.equal(res.fieldErrors.taxCode, undefined, "personal form has no MST TNCN field");
  assert.deepEqual(plain(res.unsupported), ["Ngày sinh", "Số thuế TNCN"]);
  assert.match(res.message, /Ngày sinh/);
  const ok = r.checkRequired(["DienThoaiCT", "MaSoThueCT"], new Set(), form({ isPersonal: false, phone: "09", taxCode: "03" }), {});
  assert.equal(ok.ok, true);
  assert.equal(ok.message, "");
});

test("required keys outside the web form catalog are ignored like the web", () => {
  // Trường cá nhân lẫn vào cấu hình doanh nghiệp (web: tự bỏ qua, không chặn lưu)
  const res = r.checkRequired(["TenKH", "NgaySinh", "XyzLa"], new Set(), form({ isPersonal: false, name: "Cty" }), {});
  assert.equal(res.ok, true);
  assert.deepEqual(plain(res.unsupported), []);
});

test("stage labels and transaction mapping", () => {
  assert.equal(r.stageLabel("GIUCHO"), "Giữ chỗ / booking");
  assert.equal(r.stageLabel("datcoc"), "Đặt cọc");
  assert.equal(r.stageLabel("HDMB"), "HĐ mua bán");
  assert.equal(r.stageLabel("XYZ"), "XYZ");
  const t = r.mapCustomerTransaction(
    { id: "p1", so_phieu_gc: "BK-1", giai_doan: "DATCOC", gia_tri_hd: 900, gia_tri_hd_sau_ck: 800, tien_coc: 50, da_thu: 20,
      san_pham_id: "s1", project_id: "d1", trang_thai_id: "t1", created_at: "2026-09-01T00:00:00Z" },
    { products: { s1: { ky_hieu: "B2-608", ma_sp: "SP1" } }, projects: { d1: { ten_da: "Dự án A" } }, statuses: { t1: { item_name: "Đã cọc", color_code: "#123456" } } }
  );
  assert.deepEqual(plain(t), {
    id: "p1", soPhieu: "BK-1", giaiDoan: "DATCOC", stageLabel: "Đặt cọc", tenDA: "Dự án A", projectId: "d1", kyHieu: "B2-608",
    giaTri: 800, tienCoc: 50, daThu: 20, status: "Đã cọc", statusColor: "#123456", createdAt: "2026-09-01T00:00:00Z",
  });
  const bare = r.mapCustomerTransaction({ id: "p2", gia_tri_hd: 700 }, { products: {}, projects: {}, statuses: {} });
  assert.equal(bare.giaTri, 700);
  assert.equal(bare.stageLabel, "Giữ chỗ / booking");
  assert.equal(bare.soPhieu, "");
  assert.equal(bare.projectId, null);
});

test("transactionTarget: giai đoạn → màn chi tiết (cọc / hợp đồng / còn lại là booking)", () => {
  assert.equal(r.transactionTarget("DATCOC"), "deposit");
  assert.equal(r.transactionTarget("datcoc"), "deposit");
  assert.equal(r.transactionTarget("HDMB"), "contract");
  assert.equal(r.transactionTarget("HDGV"), "contract");
  assert.equal(r.transactionTarget("THANHLY"), "contract");
  assert.equal(r.transactionTarget("GIUCHO"), "booking");
  assert.equal(r.transactionTarget(""), "booking");
  assert.equal(r.transactionTarget(null), "booking");
});
