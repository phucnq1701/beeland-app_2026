import React, { useCallback } from "react";

import { ReportList } from "@/components/reports/ReportList";
import { ListItem, MoneyText, Text } from "@/components/ui";
import { formatDate, formatVND } from "@/lib/format";
import { ReceiptRow, ReportService } from "@/sevicesSupabase/ReportService";

/** Báo cáo thu tiền: phiếu thu trong kỳ (fn_cash_voucher_list loại THU – như màn Phiếu thu web). */
export default function PaymentReportScreen() {
  const load = useCallback((q: any) => ReportService.getReceipts(q), []);
  return (
    <ReportList<ReceiptRow>
      title="Thu tiền"
      load={load}
      emptyTitle="Không có phiếu thu trong kỳ"
      summary={(rows) => (
        <>
          <Text variant="caption" color="textSecondary">
            Tổng thu · {rows.length} phiếu
          </Text>
          <MoneyText value={rows.reduce((s, r) => s + r.soTien, 0)} variant="title" />
        </>
      )}
      keyOf={(r, i) => `${r.id}-${i}`}
      renderRow={(r) => (
        <ListItem
          title={r.tenKH || "—"}
          subtitle={[r.soPhieu, r.tenDA].filter(Boolean).join(" · ") || undefined}
          meta={[r.ngay ? formatDate(r.ngay) : null, r.hinhThuc, r.dienGiai].filter(Boolean).join(" · ") || undefined}
          trailing={<Text variant="subhead" numeric>{formatVND(r.soTien)}</Text>}
        />
      )}
    />
  );
}
