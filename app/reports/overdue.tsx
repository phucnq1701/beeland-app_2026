import React, { useCallback } from "react";

import { ProgressRowItem, progressSummary } from "@/components/reports/ProgressRowItem";
import { ReportList } from "@/components/reports/ReportList";
import { ProgressRow } from "@/lib/paymentMath";
import { ReportService } from "@/sevicesSupabase/ReportService";

/** Đợt quá hạn: còn nợ và đã qua hạn (agingOf như báo cáo tiến độ web) – không lọc theo kỳ. */
export default function OverdueReportScreen() {
  const load = useCallback(async (q: any) => {
    const res = await ReportService.getProgress(q);
    return { rows: res.overdue, error: res.error };
  }, []);
  return (
    <ReportList<ProgressRow>
      title="Đợt quá hạn"
      showPeriod={false}
      load={load}
      emptyTitle="Không có đợt quá hạn"
      summary={(rows) => progressSummary(rows, "Nợ quá hạn")}
      keyOf={(r, i) => `${r.key}-${i}`}
      renderRow={(r) => <ProgressRowItem row={r} />}
    />
  );
}
