import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { buildPriceSheetHtml, printInputFromSheet } from "@/lib/priceSheetPrint";

/** Xuất phiếu tính giá ra PDF (mẫu in của web) rồi mở bảng chia sẻ (Zalo, mail, lưu tệp…) */
export async function sharePriceSheetPdf(sheet: any): Promise<void> {
  const html = buildPriceSheetHtml(printInputFromSheet(sheet));
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (!(await Sharing.isAvailableAsync())) {
    await Print.printAsync({ html });
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Phiếu tính giá ${sheet?.product_code || ""}`.trim(),
  });
}
