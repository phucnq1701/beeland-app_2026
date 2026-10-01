import React, { useCallback } from "react";

import { ProgressRowItem, progressSummary } from "@/components/reports/ProgressRowItem";
import { ReportList } from "@/components/reports/ReportList";
import { ProgressRow } from "@/lib/paymentMath";
import { ReportService } from "@/sevicesSupabase/ReportService";

/** Đợt thanh toán sắp đến hạn: còn nợ, chưa quá hạn, hạn trong kỳ (tiến độ thanh toán như web). */
export default function PaymentDueReportScreen() {
  const load = useCallback(async (q: any) => {
    const res = await ReportService.getProgress(q);
    return { rows: res.upcoming, error: res.error };
  }, []);
  return (
    <ReportList<ProgressRow>
      title="Sắp đến hạn"
      load={load}
      emptyTitle="Không có đợt đến hạn trong kỳ"
      summary={(rows) => progressSummary(rows, "Còn phải thu")}
      keyOf={(r, i) => `${r.key}-${i}`}
      renderRow={(r) => <ProgressRowItem row={r} />}
    />
  );
}
