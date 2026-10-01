import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { FileX2 } from "lucide-react-native";

import { AppHeader, Card, EmptyState, ErrorState, Screen, SkeletonList } from "@/components/ui";
import { PeriodType } from "@/lib/reportPeriod";
import { colors, space } from "@/theme";

import { DEFAULT_REPORT_FILTER, ReportFilters, ReportFilterValue, reportQuery } from "./ReportFilters";

/** Bộ lọc nhận từ màn Tổng quan (params) để mở báo cáo chi tiết đúng kỳ / dự án đang xem. */
export function useInitialReportFilter(): ReportFilterValue {
  const p = useLocalSearchParams<{ period?: string; customFrom?: string; customTo?: string; projectId?: string }>();
  return {
    period: (p.period as PeriodType) || DEFAULT_REPORT_FILTER.period,
    customFrom: p.customFrom || null,
    customTo: p.customTo || null,
    projectId: p.projectId || null,
  };
}

/**
 * Khung báo cáo dạng danh sách: bộ lọc + thẻ tổng + danh sách; kéo làm mới; bỏ kết quả cũ khi lọc đổi nhanh.
 */
export function ReportList<T>({
  title,
  showPeriod = true,
  load,
  summary,
  renderRow,
  keyOf,
  emptyTitle,
}: {
  title: string;
  showPeriod?: boolean;
  load: (q: { from: string; to: string; projectId: string | null }) => Promise<{ rows: T[]; error?: boolean }>;
  summary: (rows: T[]) => React.ReactNode;
  renderRow: (item: T) => React.ReactElement;
  keyOf: (item: T, i: number) => string;
  emptyTitle: string;
}) {
  const initial = useInitialReportFilter();
  const [filter, setFilter] = useState<ReportFilterValue>(initial);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const version = useRef(0);

  const run = useCallback(
    async (refresh = false) => {
      const v = ++version.current;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await load(reportQuery(filter));
        if (v !== version.current) return;
        setRows(res.rows);
        setError(!!res.error);
      } catch {
        if (v === version.current) setError(true);
      } finally {
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter, load]
  );

  useEffect(() => {
    void run();
  }, [run]);

  const header = (
    <View style={styles.header}>
      <ReportFilters value={filter} onChange={setFilter} showPeriod={showPeriod} />
      {!loading && !error ? <Card>{summary(rows)}</Card> : null}
    </View>
  );

  const empty = () => {
    if (loading) return <SkeletonList />;
    if (error) return <ErrorState description="Không tải được báo cáo." onRetry={() => void run()} />;
    return <EmptyState icon={FileX2} title={emptyTitle} description="Thử chọn kỳ hoặc dự án khác." />;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll={false} padded={false} header={<AppHeader title={title} />}>
        <FlatList
          data={loading || error ? [] : rows}
          keyExtractor={keyOf}
          renderItem={({ item }) => renderRow(item)}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          ListEmptyComponent={empty()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void run(true)} tintColor={colors.primary} colors={[colors.primary]} />
          }
          contentContainerStyle={styles.content}
        />
      </Screen>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: space.lg },
  content: { paddingBottom: space.xxl },
});
