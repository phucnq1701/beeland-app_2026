import React from "react";
import { StyleSheet, View } from "react-native";

import { Badge, BadgeTone, MoneyText, Text } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { AGING_LABEL, Aging, ProgressRow, agingOf } from "@/lib/paymentMath";
import { space } from "@/theme";

const AGING_TONE: Record<Aging, BadgeTone> = {
  done: "success",
  current: "info",
  d30: "warning",
  d60: "warning",
  d90: "danger",
  d90p: "danger",
};

/** Thẻ tổng của báo cáo tiến độ: tổng còn lại + số đợt. */
export function progressSummary(rows: ProgressRow[], label: string) {
  return (
    <>
      <Text variant="caption" color="textSecondary">
        {label} · {rows.length} đợt
      </Text>
      <MoneyText value={rows.reduce((s, r) => s + r.conLai, 0)} variant="title" />
    </>
  );
}

/** Một đợt thanh toán: khách, hợp đồng · căn · dự án, đợt + hạn, còn lại, tình trạng (như cột web). */
export function ProgressRowItem({ row }: { row: ProgressRow }) {
  const aging = agingOf(row);
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="subhead" numberOfLines={1}>
          {row.hoTenKH || "—"}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {[row.soHD, row.kyHieu, row.tenDA].filter(Boolean).join(" · ")}
        </Text>
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {[row.dotTT, row.ngayDenHan ? `Hạn ${formatDate(row.ngayDenHan)}` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={styles.right}>
        <MoneyText value={row.conLai} short variant="subhead" />
        <Badge label={aging.startsWith("d") && row.soNgayQuaHan > 0 ? `Quá ${row.soNgayQuaHan} ngày` : AGING_LABEL[aging]} tone={AGING_TONE[aging]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  flex: { flex: 1, gap: 2 },
  right: { alignItems: "flex-end", gap: space.xs },
});
