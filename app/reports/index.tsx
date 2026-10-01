import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { AlertTriangle, CalendarClock, FileText, Wallet } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { DEFAULT_REPORT_FILTER, ReportFilters, ReportFilterValue, reportQuery } from "@/components/reports/ReportFilters";
import { AppHeader, Card, ErrorState, Screen, Skeleton, Text } from "@/components/ui";
import { formatVNDShort } from "@/lib/format";
import { PERIOD_LABEL } from "@/lib/reportPeriod";
import { colors, radius, space } from "@/theme";
import { ReportService } from "@/sevicesSupabase/ReportService";

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

type Overview = Awaited<ReturnType<typeof ReportService.getOverview>>;

/**
 * Báo cáo – tổng quan 4 chỉ số trong kỳ, tính trên Cloud từ đúng nguồn của 4 báo cáo chi tiết
 * (không còn gọi API cũ /api/bao-cao/summary).
 */
export default function ReportsScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [filter, setFilter] = useState<ReportFilterValue>(DEFAULT_REPORT_FILTER);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const version = useRef(0);

  const load = useCallback(
    async (refresh = false) => {
      const v = ++version.current;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await ReportService.getOverview(reportQuery(filter));
        if (v === version.current) setData(res);
      } catch {
        if (v === version.current) setData(null);
      } finally {
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const open = (pathname: string) =>
    router.push({
      pathname: pathname as any,
      params: {
        period: filter.period,
        customFrom: filter.customFrom ?? "",
        customTo: filter.customTo ?? "",
        projectId: filter.projectId ?? "",
      },
    });

  const period = PERIOD_LABEL[filter.period].toLowerCase();
  const cards: { title: string; subtitle: string; value: string; icon: LucideIcon; tone: string; route: string }[] = data
    ? [
        { title: "Thu tiền", subtitle: `Tổng thu ${period}`, value: formatVNDShort(data.thuTien), icon: Wallet, tone: colors.success, route: "/reports/payment" },
        { title: "Hợp đồng", subtitle: `${data.soHopDong} HĐMB ký ${period}`, value: formatVNDShort(data.hopDong), icon: FileText, tone: colors.info, route: "/reports/contract" },
        { title: "Sắp đến hạn", subtitle: `Đợt thanh toán ${period}`, value: `${data.sapDenHan} đợt`, icon: CalendarClock, tone: colors.warning, route: "/reports/payment-due" },
        { title: "Đợt quá hạn", subtitle: "Cần xử lý ngay", value: `${data.quaHan} đợt`, icon: AlertTriangle, tone: colors.danger, route: "/reports/overdue" },
      ]
    : [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={<AppHeader title="Báo cáo" hideBack={embedded} />}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        bottomInset={embedded ? TAB_BAR_SPACE : 0}
      >
        <ReportFilters value={filter} onChange={setFilter} />
        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={112} style={styles.cell} />
            ))}
          </View>
        ) : !data || data.error ? (
          <ErrorState description="Không tải được số liệu báo cáo." onRetry={() => void load()} />
        ) : (
          <View style={styles.grid}>
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.title} onPress={() => open(c.route)} style={styles.cell} accessibilityLabel={`${c.title}: ${c.value}`}>
                  <View style={styles.icon}>
                    <Icon size={20} color={c.tone} />
                  </View>
                  <Text variant="caption" color="textSecondary">
                    {c.title}
                  </Text>
                  <Text variant="heading" numeric numberOfLines={1} adjustsFontSizeToFit>
                    {c.value}
                  </Text>
                  <Text variant="label" color="textTertiary" numberOfLines={2}>
                    {c.subtitle}
                  </Text>
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  cell: { flexBasis: "47%", flexGrow: 1, gap: 2 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    marginBottom: space.xs,
  },
});
