import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FileX2, SearchX } from "lucide-react-native";

import {
  AppHeader,
  EmptyState,
  ErrorState,
  ListItem,
  Screen,
  SearchBar,
  SkeletonList,
  StatusBadge,
  useToast,
} from "@/components/ui";
import { DocTrailing } from "@/components/sales/SalesDocList";
import { CustomerTransaction, transactionTarget } from "@/lib/customerRules";
import { foldVietnamese, formatDate } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { DatCocService } from "@/sevicesSupabase/DatCocService";
import { HopDongService } from "@/sevicesSupabase/HopDongService";

/**
 * Màn chi tiết cọc / hợp đồng cần dòng danh sách (fn_deposit_list / fn_contract_list) → tìm dòng có
 * PhieuGiuChoId = id phiếu giữ chỗ của giao dịch, thử theo số phiếu rồi theo ký hiệu căn.
 */
async function findDocRow(
  get: (filter: any) => Promise<any>,
  t: CustomerTransaction
): Promise<any | null> {
  for (const term of [t.soPhieu, t.kyHieu]) {
    if (!term) continue;
    const res = await get({ inputSearch: term, Limit: 50 });
    const hit = (res?.data ?? []).find((r: any) => String(r?.PhieuGiuChoId ?? "") === t.id);
    if (hit) return hit;
  }
  return null;
}

/**
 * Giao dịch của khách (phiếu giữ chỗ → cọc → hợp đồng, bảng vòng đời cloud_pgc_phieu_giucho).
 * Kiểu bo tròn như danh sách đặt cọc/hợp đồng: header/ô tìm `soft`, mỗi giao dịch là card bo `radius.xxl`.
 */
export default function CustomerTransactionsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const opening = useRef(false);
  const [list, setList] = useState<CustomerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!id) return;
      if (refresh) setRefreshing(true);
      else {
        setLoading(true);
        setError(false);
      }
      try {
        const res: any = await CustomerService.getHopDong({ MaKH: String(id) });
        setList(Array.isArray(res?.data) ? res.data : []);
        setError(!!res?.error);
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

  // Chạm giao dịch → chi tiết theo giai đoạn. Không tìm được phiếu cọc / HĐ thì mở chi tiết booking
  // của phiếu giữ chỗ (getBookingEditDetail tra cả theo ma_pgc_id).
  const openTransaction = useCallback(
    async (t: CustomerTransaction) => {
      if (opening.current || !t.id) return;
      const target = transactionTarget(t.giaiDoan);
      if (target === "booking") {
        router.push({ pathname: "/booking/[id]", params: { id: t.id } });
        return;
      }
      opening.current = true;
      setOpeningId(t.id);
      try {
        const row = await findDocRow(target === "deposit" ? DatCocService.get : HopDongService.get, t);
        if (row && target === "deposit") {
          router.push({ pathname: "/deposit/[id]", params: { id: String(row.MaPDC ?? row.ID), data: JSON.stringify(row) } });
        } else if (row) {
          router.push({ pathname: "/contract/[id]", params: { id: String(row.MaHD ?? row.ID), data: JSON.stringify(row) } });
        } else {
          router.push({ pathname: "/booking/[id]", params: { id: t.id } });
        }
      } catch {
        toast.show({ type: "error", message: "Không mở được chi tiết giao dịch" });
      } finally {
        opening.current = false;
        setOpeningId(null);
      }
    },
    [router, toast]
  );

  const renderItem = useCallback(
    ({ item }: { item: CustomerTransaction }) => (
      // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
      <View style={styles.card}>
        <View style={styles.clip}>
          <ListItem
            title={item.soPhieu || "—"}
            subtitle={[item.tenDA, item.kyHieu].filter(Boolean).join(" · ") || undefined}
            meta={[item.stageLabel, item.createdAt ? formatDate(item.createdAt) : null].filter(Boolean).join(" · ")}
            onPress={() => void openTransaction(item)}
            trailing={
              <View style={styles.trailing}>
                {openingId === item.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : item.giaTri != null ? (
                  <DocTrailing amount={item.giaTri} status={item.status} color={item.statusColor} />
                ) : item.status ? (
                  <StatusBadge label={item.status} color={item.statusColor} />
                ) : null}
              </View>
            }
          />
        </View>
      </View>
    ),
    [openTransaction, openingId]
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
      <Screen scroll={false} padded={false} header={<AppHeader variant="soft" title="Giao dịch của khách" />}>
        <FlatList
          data={loading ? [] : filtered}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Tìm số phiếu, căn, dự án…" variant="soft" />
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
  header: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg },
  trailing: { alignItems: "flex-end", gap: space.xs },
  separator: { height: space.sm + 2 },
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  content: { paddingBottom: space.xxl },
});
