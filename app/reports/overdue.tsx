import React, { useCallback } from "react";
import { useRouter } from "expo-router";

import { ProgressRowItem, progressSummary } from "@/components/reports/ProgressRowItem";
import { ReportList } from "@/components/reports/ReportList";
import { ProgressRow } from "@/lib/paymentMath";
import { progressDocLink } from "@/lib/reportDetail";
import { ReportService } from "@/sevicesSupabase/ReportService";

/** Đợt quá hạn: còn nợ và đã qua hạn (agingOf như báo cáo tiến độ web) – không lọc theo kỳ. */
export default function OverdueReportScreen() {
  const router = useRouter();
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
      renderRow={(r) => {
        // Chạm đợt → chi tiết phiếu chứa đợt (cọc / hợp đồng): lịch thanh toán + phiếu thu
        const link = progressDocLink(r);
        return <ProgressRowItem row={r} onPress={link ? () => router.push(link) : undefined} />;
      }}
    />
  );
}
