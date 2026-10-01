import React, { useCallback } from "react";
import { useRouter } from "expo-router";

import { ReportList } from "@/components/reports/ReportList";
import { DocTrailing } from "@/components/sales/SalesDocList";
import { ListItem, MoneyText, Text } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ReportService } from "@/sevicesSupabase/ReportService";

/** Báo cáo hợp đồng: hợp đồng mua bán ký trong kỳ (fn_contract_list – như danh sách HĐ web). */
export default function ContractReportScreen() {
  const router = useRouter();
  const load = useCallback((q: any) => ReportService.getContracts(q), []);
  return (
    <ReportList<any>
      title="Hợp đồng"
      load={load}
      emptyTitle="Không có hợp đồng ký trong kỳ"
      summary={(rows) => (
        <>
          <Text variant="caption" color="textSecondary">
            Tổng giá trị · {rows.length} hợp đồng
          </Text>
          <MoneyText value={rows.reduce((s: number, r: any) => s + (Number(r.TongGiaTriHDMB) || 0), 0)} variant="title" />
        </>
      )}
      keyOf={(r, i) => `${r.MaHD ?? r.ID}-${i}`}
      renderRow={(r) => (
        <ListItem
          title={r.TenKH || "—"}
          subtitle={[r.SoHDMB, r.KyHieu, r.TenDA].filter(Boolean).join(" · ") || undefined}
          meta={r.NgayKy ? `Ký ${formatDate(r.NgayKy)}` : undefined}
          trailing={<DocTrailing amount={r.TongGiaTriHDMB} status={r.TenTT} color={r.MauNen} />}
          onPress={() =>
            router.push({ pathname: "/contract/[id]", params: { id: String(r.MaHD ?? r.ID), data: JSON.stringify(r) } })
          }
        />
      )}
    />
  );
}
