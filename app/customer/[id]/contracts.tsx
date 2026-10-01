import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FileX2, SearchX } from "lucide-react-native";

import {
  AppHeader,
  EmptyState,
  ErrorState,
  ListItem,
  MoneyText,
  Screen,
  SearchBar,
  SkeletonList,
  StatusBadge,
} from "@/components/ui";
import { CustomerTransaction } from "@/lib/customerRules";
import { foldVietnamese, formatDate } from "@/lib/format";
import { colors, space } from "@/theme";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

/** Giao dịch của khách (phiếu giữ chỗ → cọc → hợp đồng, bảng vòng đời cloud_pgc_phieu_giucho). */
export default function CustomerTransactionsScreen() {
  const { id } = useLocalSearchParams();
  const [list, setList] = useState<CustomerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!id) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res: any = await CustomerService.getHopDong({ MaKH: String(id) });
        setList(Array.isArray(res?.data) ? res.data : []);
        setError(false);
      } catch (err) {
        console.log("[Customer transactions] Error:", err);
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = foldVietnamese(query.trim());
    if (!q) return list;
    return list.filter((t) => foldVietnamese(`${t.soPhieu} ${t.kyHieu} ${t.tenDA}`).includes(q));
  }, [list, query]);

  const renderItem = useCallback(
    ({ item }: { item: CustomerTransaction }) => (
      <ListItem
        title={item.soPhieu || "—"}
        subtitle={[item.tenDA, item.kyHieu].filter(Boolean).join(" · ") || undefined}
        meta={[item.stageLabel, item.createdAt ? formatDate(item.createdAt) : null].filter(Boolean).join(" · ")}
        trailing={
          <View style={styles.trailing}>
            {item.giaTri != null ? <MoneyText value={item.giaTri} short /> : null}
            {item.status ? <StatusBadge label={item.status} color={item.statusColor} /> : null}
          </View>
        }
      />
    ),
    []
  );

  const empty = () => {
    if (loading) return <SkeletonList />;
    if (error) return <ErrorState description="Không tải được giao dịch của khách." onRetry={() => void load()} />;
    if (query) {
      return (
        <EmptyState icon={SearchX} title="Không có giao dịch phù hợp" actionLabel="Xoá tìm kiếm" onAction={() => setQuery("")} />
      );
    }
    return <EmptyState icon={FileX2} title="Khách chưa có giao dịch" description="Booking, đặt cọc, hợp đồng của khách sẽ hiện ở đây." />;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll={false} padded={false} header={<AppHeader title="Giao dịch của khách" />}>
        <FlatList
          data={loading ? [] : filtered}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Tìm số phiếu, căn, dự án…" />
            </View>
          }
          ListEmptyComponent={empty()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          keyboardShouldPersistTaps="handled"
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
  header: { paddingHorizontal: space.lg, paddingVertical: space.md },
  trailing: { alignItems: "flex-end", gap: space.xs },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: space.lg },
  content: { paddingBottom: space.xxl },
});
