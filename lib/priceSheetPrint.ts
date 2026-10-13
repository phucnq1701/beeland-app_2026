/**
 * HTML phiếu tính giá để in / chia sẻ PDF (expo-print) – cùng mẫu web:
 * beeland/src/utils/printPriceSheetRecord.ts + printPriceSheetHighRise.ts (mẫu Excel PTG tiến độ).
 * Khác web: màu nền dòng mục cố định (web lấy biến CSS --info), không tự gọi window.print.
 * Không import gì để test nạp được.
 */

const fmt = (n: any) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

const pct = (n: any) => {
  const v = Number(n) || 0;
  const p = v <= 1 ? v * 100 : v;
  return `${Number(p.toFixed(2))}%`;
};

const esc = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** dayjs(v).format("DD/MM/YYYY"); không hợp lệ → chuỗi gốc */
const d = (v: any) => {
  if (!v) return "";
  const dt = v instanceof Date ? v : new Date(v);
  if (isNaN(dt.getTime())) return String(v);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

export interface PrintInput {
  projectName?: string;
  sheetCode?: string;
  policyName?: string;
  policyDate?: any;
  paymentMethod?: string;
  productCode?: string;
  productType?: string;
  boughtCount?: string | number;
  view?: string;
  handoverOption?: string;
  area?: number;
  landUnitPrice?: number;
  unitPriceVAT?: number;
  totalListedPrice?: number;
  discounts?: { name: string; rate?: number; amount?: number }[];
  totalContractValue?: number;
  totalWithVATNoMaintenance?: number;
  totalNoVAT?: number;
  unitPriceNoVAT?: number;
  vatAmount?: number;
  maintenanceFee?: number;
  schedule?: { index?: number | string; name: string; ratio?: number | string; dueDate?: any; amount?: number }[];
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  transferContent?: string;
  city?: string;
  notes?: string;
}

const DEFAULT_NOTE = `- Nếu KH chậm trễ thanh toán theo tiến độ quy định tại chính sách, KH sẽ thanh toán thêm lãi chậm trả 0,05% trên số tiền và số ngày KH thanh toán muộn kể từ ngày đến hạn thanh toán.
- Nếu ngày giải ngân/thanh toán rơi vào ngày cuối tuần, lễ Tết, ngày nghỉ theo quy định của pháp luật thì ngày thanh toán thực tế được rời vào ngày làm việc đầu tiên tiếp ngay sau ngày nghỉ.
- Khách hàng đã đặt cọc mua căn hộ vào tài khoản CĐT không được nhận lại tiền cọc bằng bất kỳ lý do nào.
- Trường hợp lựa chọn hình thức thanh toán nhanh, Khách hàng không được thanh toán muộn quá 15 ngày kể từ ngày phải thanh toán theo quy định.
- Sau 30 ngày kể từ ngày đến hạn, nếu Khách hàng chưa ký HĐMB và thanh toán tiền đợt 1, Chủ đầu tư có quyền thu hồi căn hộ và bán cho Bên thứ ba bất kỳ mà không cần thông báo với Khách hàng.`;

/** Dữ liệu in từ bản ghi phiếu (ưu tiên snapshot đã lưu) – printPriceSheetRecord */
export function printInputFromSheet(sheet: any, snapshotOverride?: any): PrintInput {
  const snap = snapshotOverride ?? sheet?.snapshot;
  if (snap) {
    const t = snap.totals || {};
    const area = Number(snap.area) || Number(sheet?.area) || 0;
    return {
      projectName: snap.projectName || sheet?.project_name || sheet?.projects?.name || "",
      sheetCode: sheet?.sheet_code,
      policyName: snap.policyName,
      policyDate: snap.policyDate || sheet?.created_at,
      productCode: snap.productCode || sheet?.product_code,
      productType: snap.productType || sheet?.product_type || "",
      view: snap.view,
      area,
      unitPriceVAT: t.unitPriceVAT,
      totalListedPrice: t.totalListedPrice,
      discounts: snap.discounts,
      totalContractValue: t.totalContractValue,
      totalWithVATNoMaintenance: t.totalWithVATNoMaintenance,
      totalNoVAT: t.totalNoVAT,
      unitPriceNoVAT: area ? Number(t.totalNoVAT || 0) / area : 0,
      vatAmount: t.vatAmount,
      maintenanceFee: t.maintenanceFee,
      schedule: snap.schedule,
      transferContent: `${snap.customerName || ""} thanh toan can ${snap.productCode || sheet?.product_code}`,
    };
  }
  const area = Number(sheet?.area) || 0;
  const total = Number(sheet?.base_price) || 0;
  const vatRate = Number(sheet?.vat_rate ?? 10) / 100;
  const bhRate = Number(sheet?.maintenance_rate ?? 2) / 100;
  const totalNoVAT = vatRate ? total / (1 + vatRate) : total;
  const vatAmount = total - totalNoVAT;
  const maintenanceFee = totalNoVAT * bhRate;
  return {
    projectName: sheet?.project_name || sheet?.projects?.name || "",
    sheetCode: sheet?.sheet_code,
    policyName: sheet?.policy_name || sheet?.pricing_policies?.name || "",
    policyDate: sheet?.created_at,
    productCode: sheet?.product_code,
    productType: sheet?.product_name || sheet?.product_type || "",
    area,
    unitPriceVAT: Number(sheet?.unit_price) || (area ? total / area : 0),
    totalListedPrice: total,
    totalContractValue: total + maintenanceFee,
    totalWithVATNoMaintenance: total,
    totalNoVAT,
    unitPriceNoVAT: area ? totalNoVAT / area : 0,
    vatAmount,
    maintenanceFee,
    transferContent: `${sheet?.customer_name || ""} thanh toan can ${sheet?.product_code}`,
  };
}

export function buildPriceSheetHtml(input: PrintInput, now: Date = new Date()): string {
  const discounts = input.discounts || [];
  const schedule = input.schedule || [];
  const totalRatio = schedule.reduce((s, x) => {
    const r = Number(x.ratio);
    return s + (isNaN(r) ? 0 : r <= 1 ? r : r / 100);
  }, 0);
  const totalAmount = schedule.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const row = (no: string, label: string, value: string, bold = false) => `
    <tr class="${bold ? "b" : ""}">
      <td class="no">${esc(no)}</td>
      <td class="lbl" colspan="2">${esc(label)}</td>
      <td class="val">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Phiếu tính giá ${esc(input.productCode || "")}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11.5pt; color: #000; margin: 0; }
  h1 { font-size: 17pt; margin: 0; text-align: center; letter-spacing: .5px; }
  h2 { font-size: 13pt; margin: 2px 0 10px; text-align: center; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
  .sec td { background: #DDE9FD; font-weight: bold; text-transform: uppercase; }
  .no { width: 40px; text-align: center; }
  .val { width: 200px; text-align: right; white-space: nowrap; }
  .b td { font-weight: bold; }
  .center { text-align: center; }
  .right { text-align: right; }
  .meta { margin: 10px 0 6px; }
  .meta div { margin: 2px 0; }
  .note { border: 1px solid #000; border-top: 0; padding: 6px; font-size: 9.5pt; white-space: pre-line; }
  .pay { margin-top: 10px; font-size: 10.5pt; }
  .sign { margin-top: 22px; width: 100%; }
  .sign td { border: 0; text-align: center; font-weight: bold; height: 90px; vertical-align: top; }
  .sign .place { font-style: italic; font-weight: normal; text-align: right; height: auto; padding-bottom: 8px; }
  thead th { background: #DDE9FD; font-weight: bold; text-align: center; }
</style></head>
<body>
  <h1>PHIẾU TÍNH GIÁ</h1>
  <h2>DỰ ÁN ${esc((input.projectName || "").toUpperCase())}</h2>

  <div class="meta">
    <div><b>Khách hàng chọn phương án:</b> ${esc(input.paymentMethod || "Thanh toán theo tiến độ thông thường")}</div>
    <div><b>CSBH ngày:</b> ${esc(d(input.policyDate) || d(now))}${input.policyName ? ` — ${esc(input.policyName)}` : ""}${
      input.sheetCode ? ` &nbsp;&nbsp; <b>Số phiếu:</b> ${esc(input.sheetCode)}` : ""
    }</div>
  </div>

  <table>
    <tr class="sec"><td class="no">1</td><td colspan="3">Thông tin</td></tr>
    ${row("1.1", "Mã căn", esc(input.productCode || ""))}
    ${row("1.2", "Loại căn", esc(input.productType || ""))}
    ${row("1.3", "Số lượng căn hộ khách hàng đã mua", esc(input.boughtCount ?? ""))}
    ${row("1.4", "View", esc(input.view || ""))}
    ${row("1.5", "Phương án nhận bàn giao", esc(input.handoverOption || ""))}

    <tr class="sec"><td class="no">2</td><td colspan="3">Giá trị niêm yết</td></tr>
    ${row("2.1", "Diện tích thông thủy (m2)", esc(input.area ?? ""))}
    ${row("", "- Đơn giá QSD đất không chịu VAT /m2 thông thủy", fmt(input.landUnitPrice))}
    ${row("2.2", "Đơn giá bán/m2 thông thủy (gồm VAT)", fmt(input.unitPriceVAT))}
    ${row("", "Tổng giá trị căn hộ gồm VAT", fmt(input.totalListedPrice), true)}

    <tr class="sec"><td class="no">3</td><td>Giá trị chiết khấu</td><td class="center" style="width:70px">Tỷ lệ</td><td class="val">Giá trị</td></tr>
    ${
      discounts.length
        ? discounts
            .map(
              (x, i) => `<tr>
        <td class="no">3.${i + 1}</td>
        <td>${esc(x.name)}</td>
        <td class="center">${x.rate ? pct(x.rate) : ""}</td>
        <td class="val">${fmt(x.amount)}</td>
      </tr>`
            )
            .join("")
        : `<tr><td class="no"></td><td colspan="3" class="center">Không áp dụng chiết khấu</td></tr>`
    }

    <tr class="sec"><td class="no">4</td><td colspan="3">Giá trị sau chiết khấu</td></tr>
    ${row("4.1", "Tổng giá trị căn hộ vào HĐMB (bao gồm VAT và KPBT)", fmt(input.totalContractValue), true)}
    ${row("4.2", "Tổng giá trị căn hộ đã bao gồm VAT chưa gồm KPBT", fmt(input.totalWithVATNoMaintenance))}
    ${row("4.3", "Tổng giá trị căn hộ chưa bao gồm VAT", fmt(input.totalNoVAT))}
    ${row("4.4", "Đơn giá chưa VAT/m2", fmt(input.unitPriceNoVAT))}
    ${row("4.5", "Tổng thuế GTGT", fmt(input.vatAmount))}
    ${row("4.6", "Kinh phí bảo trì", fmt(input.maintenanceFee))}
  </table>

  <div style="height:10px"></div>

  <table>
    <tr class="sec"><td colspan="5">5. Tiến độ thanh toán</td></tr>
    <thead><tr>
      <th style="width:40px">STT</th>
      <th>Tiến độ</th>
      <th style="width:90px">Tỷ lệ</th>
      <th style="width:110px">Ngày thanh toán</th>
      <th style="width:150px">Số tiền thanh toán</th>
    </tr></thead>
    <tbody>
      ${
        schedule.length
          ? schedule
              .map(
                (x, i) => `<tr>
          <td class="center">${esc(x.index ?? i + 1)}</td>
          <td>${esc(x.name)}</td>
          <td class="center">${typeof x.ratio === "string" ? esc(x.ratio) : x.ratio != null ? pct(x.ratio) : ""}</td>
          <td class="center">${esc(d(x.dueDate))}</td>
          <td class="right">${fmt(x.amount)}</td>
        </tr>`
              )
              .join("")
          : `<tr><td colspan="5" class="center">Chưa có lịch thanh toán</td></tr>`
      }
      <tr class="b">
        <td colspan="2" class="center">Tổng cộng</td>
        <td class="center">${pct(totalRatio)}</td>
        <td></td>
        <td class="right">${fmt(totalAmount || input.totalContractValue)}</td>
      </tr>
    </tbody>
  </table>
  <div class="note"><b>Lưu ý:</b>\n${esc(input.notes || DEFAULT_NOTE)}</div>

  <div class="pay">
    <div>Quý KH vui lòng thanh toán theo số tài khoản sau:</div>
    <div>Tên chủ tài khoản: ${esc(input.bankAccountName || "")}</div>
    <div>Số tài khoản: ${esc(input.bankAccountNumber || "")}</div>
    <div>Ngân hàng: ${esc(input.bankName || "")}</div>
    <div>Nội dung: ${esc(input.transferContent || "")}</div>
    <div style="margin-top:6px"><b>KH cần lưu ý:</b> “Trường hợp có sai sót trong tính toán và số liệu mà Bên Bán hoặc Bên Mua chứng minh được là sai theo các điều khoản, điều kiện của Hợp đồng, các Phụ lục và/hoặc các văn bản, thỏa thuận liên quan mà các Bên đã ký thì Bên kia phải chấp nhận số liệu tính toán điều chỉnh”.</div>
  </div>

  <table class="sign">
    <tr><td colspan="3" class="place">${esc(input.city || "Hà Nội")}, ngày ..... tháng ..... năm ${now.getFullYear()}</td></tr>
    <tr><td>Kiểm soát DVKH</td><td>Chuyên viên DVKH</td><td>Khách hàng</td></tr>
  </table>
</body></html>`;
}
