import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { History } from "lucide-react-native";

import { AppHeader, EmptyState, ErrorState, MoneyText, Screen, SkeletonList, Text } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { PriceSheetService, type PriceSheetVersion } from "@/sevicesSupabase/PriceSheetService";
import { colors, elevation, radius, space } from "@/theme";

/**
 * Lịch sử phiên bản phiếu tính giá (fn_price_sheet_versions – máy chủ ghi mỗi lần lưu / khôi phục).
 * Chỉ xem; khôi phục phiên bản làm trên web (cần quyền theo vai trò – priceSheetPermissions).
 */
export default function PriceSheetHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows, setRows] = useState<PriceSheetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        setRows(await PriceSheetService.versions(String(id)));
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll={false} padded={false} header={<AppHeader variant="soft" title="Lịch sử phiên bản" />}>
        <FlatList
          data={loading ? [] : rows}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            loading ? (
              <SkeletonList />
            ) : error ? (
              <ErrorState description="Không tải được lịch sử phiên bản." onRetry={() => void load()} />
            ) : (
              <EmptyState icon={History} title="Chưa có phiên bản" />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const s = item.summary || {};
            return (
              <View style={styles.card}>
                <View style={styles.head}>
                  <Text variant="subhead" style={styles.flex}>
                    Phiên bản {item.version}
                  </Text>
                  <MoneyText value={Number(s.base_price) || 0} variant="subhead" />
                </View>
                <Text variant="caption" color="textSecondary">
                  {[formatDateTime(item.created_at), item.changed_by].filter(Boolean).join(" · ")}
                </Text>
                {item.note ? <Text variant="caption">{item.note}</Text> : null}
                {s.policy_name || s.customer_name ? (
                  <Text variant="caption" color="textTertiary" numberOfLines={2}>
                    {[s.policy_name, s.customer_name].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxl },
  sep: { height: space.sm + 2 },
  card: { padding: space.lg, gap: 2, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
});
