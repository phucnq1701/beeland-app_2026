// In / chia sẻ phiếu tính giá (lib/priceSheetPrint.ts) + nhãn trạng thái (lib/priceSheetStatus.ts) — đọc ảnh chụp `_snapshot`
// do form web dựng (lib/web: PriceSheetForm handleSave) — cùng khoá với web.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const status = loadTs("lib/priceSheetStatus.ts");
const print = loadTs("lib/priceSheetPrint.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("trạng thái + in phiếu: nhãn như web, HTML có số liệu và thoát ký tự", () => {
  assert.deepEqual(plain(status.priceSheetStatus("approved")), { label: "Đã duyệt", color: "green" });
  assert.equal(status.canApprove("approved"), false);
  assert.equal(status.canReject("draft"), true);
  const snapshot = {
    projectName: "BRG SMART CITY", productCode: "A1-12B09", productType: "Căn hộ", isLowRise: false, view: "Đông Nam", area: 70,
    policyName: "CS BRG", policyDate: "2026-10-13T00:00:00.000Z", customerName: "<b>x</b>", customerPhone: "",
    discounts: [{ name: "Mở bán", rate: 2, amount: 124009331.2 }],
    schedule: [{ index: 1, name: "Đợt 1", ratio: 30, dueDate: "2026-10-23T00:00:00+07:00", amount: 1691214504 }],
    totals: { totalListedPrice: 6313202315.64, totalContractValue: 5742156850.33, totalWithVATNoMaintenance: 5637381680.01,
      totalNoVAT: 5238758515.78, vatAmount: 523875851.58, maintenanceFee: 104775170.32, discountAmount: 563084879.99, discountPercent: 9.99 },
  };
  const html = print.buildPriceSheetHtml(print.printInputFromSheet({ sheet_code: "PTG-1", product_code: "A1-12B09", snapshot }), new Date(2026, 9, 13));
  assert.match(html, /PHIẾU TÍNH GIÁ/);
  assert.match(html, /BRG SMART CITY/);
  assert.match(html, /PTG-1/);
  assert.match(html, /5\.742\.156\.850/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt; thanh toan can A1-12B09/);
  assert.match(html, /năm 2026/);
  const legacy = print.printInputFromSheet({ product_code: "X", base_price: 1100, vat_rate: 10, maintenance_rate: 2, area: 10 });
  assert.ok(Math.abs(legacy.totalNoVAT - 1000) < 1e-9);
  assert.ok(Math.abs(legacy.maintenanceFee - 20) < 1e-9);
});
