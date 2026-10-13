import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Calculator, FileX2, Plus, SearchX } from "lucide-react-native";

import {
  AppHeader,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ListItem,
  MoneyText,
  Screen,
  SearchBar,
  SegmentedControl,
  SelectField,
  SkeletonList,
  StatusBadge,
  Text,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { PRICE_SHEET_STATUSES, priceSheetStatus } from "@/lib/priceSheetStatus";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PriceSheetService, type PriceSheetRow } from "@/sevicesSupabase/PriceSheetService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { colors, elevation, radius, space } from "@/theme";

const PAGE_SIZE = 20;
const TAB_BAR_SPACE = 100;
const ALL = "all";

type Stats = { draft: number; sent: number; approved: number; rejected: number };

/**
 * Danh sách phiếu tính giá – fn_price_sheet_list như web (phieu-tinh-gia/index.tsx): lọc / phân trang / thống kê ở
 * máy chủ, phạm vi dự án theo nhân viên. Chỉ tài khoản nội bộ (tính năng 17 không có trong danh sách đại lý).
 */
export default function PriceSheetsScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [productType, setProductType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [canAdd, setCanAdd] = useState(false);

  const [rows, setRows] = useState<PriceSheetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ draft: 0, sent: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const page = useRef(1);
  const loadingMoreRef = useRef(false);
  const version = useRef(0);
  const firstFocus = useRef(true);

  useEffect(() => {
    ProjectService.getProjects({ limit: 200 })
      .then((r: any) =>
        setProjects(
          (r?.data ?? [])
            .filter((p: any) => p?.id)
            .map((p: any) => ({ value: String(p.id), label: p.TenDA || p.ten_da || "Dự án" }))
        )
      )
      .catch(() => setProjects([]));
    PriceSheetService.hasPerm("ADD").then(setCanAdd);
  }, []);

  const filter = useMemo(
    () => ({
      keyword: debounced.trim(),
      projectId: projectId === ALL ? null : projectId,
      productType: productType === ALL ? null : productType,
      status: status === ALL ? null : status,
    }),
    [debounced, projectId, productType, status]
  );

  const load = useCallback(
    async (kind: "load" | "refresh" | "more") => {
      const v = kind === "more" ? version.current : ++version.current;
      const nextPage = kind === "more" ? page.current + 1 : 1;
      if (kind === "load") setLoading(true);
      if (kind === "refresh") setRefreshing(true);
      if (kind === "more") {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        const res = await PriceSheetService.list({ ...filter, page: nextPage, pageSize: PAGE_SIZE });
        if (v !== version.current) return;
        page.current = nextPage;
        setRows((prev) => (kind === "more" ? [...prev, ...res.rows] : res.rows));
        setTotal(res.total);
        setStats(res.stats);
        setError(false);
      } catch {
        if (v === version.current && kind !== "more") setError(true);
      } finally {
        if (kind === "more") loadingMoreRef.current = false;
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [filter]
  );

  useEffect(() => {
    void load("load");
  }, [load]);

  // Quay lại từ chi tiết / lập phiếu → tải lại trang đầu
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void load("refresh");
    }, [load])
  );

  const filtering = !!query || projectId !== ALL || productType !== ALL || status !== ALL;
  const clear = () => {
    setQuery("");
    setProjectId(ALL);
    setProductType(ALL);
    setStatus(ALL);
  };
  const statTotal = stats.draft + stats.sent + stats.approved + stats.rejected;

  const header = (
    <View style={styles.sticky}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Mã phiếu, mã căn, sản phẩm…" variant="soft" />
      <SelectField
        label="Dự án"
        value={projectId}
        options={[{ value: ALL, label: "Tất cả dự án" }, ...projects]}
        onChange={setProjectId}
        variant="raised"
        sheetTitle="Chọn dự án"
      />
      <SegmentedControl
        variant="soft"
        value={productType}
        onChange={setProductType}
        options={[
          { value: ALL, label: "Tất cả" },
          { value: "Cao tầng", label: "Cao tầng" },
          { value: "Thấp tầng", label: "Thấp tầng" },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
        <Chip variant="soft" label="Tất cả" count={statTotal} selected={status === ALL} onPress={() => setStatus(ALL)} />
        {PRICE_SHEET_STATUSES.map((s) => (
          <Chip
            variant="soft"
            key={s.value}
            label={s.label}
            count={stats[s.value]}
            selected={status === s.value}
            onPress={() => setStatus(s.value)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const empty = () => {
    if (loading) return <SkeletonList />;
    if (error) return <ErrorState description="Không tải được danh sách phiếu tính giá." onRetry={() => void load("load")} />;
    return filtering ? (
      <EmptyState
        icon={SearchX}
        title="Không có kết quả phù hợp"
        description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc."
        actionLabel="Xoá bộ lọc"
        onAction={clear}
      />
    ) : (
      <EmptyState
        icon={FileX2}
        title="Chưa có phiếu tính giá"
        description={canAdd ? "Bấm + để lập phiếu tính giá cho một căn." : "Phiếu tính giá được lập trên web hoặc app."}
      />
    );
  };

  const renderRow = ({ item }: { item: PriceSheetRow }) => {
    const st = priceSheetStatus(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.clip}>
          <ListItem
            leading={
              <View style={styles.icon}>
                <Calculator size={20} color={colors.primary} />
              </View>
            }
            title={item.product_code || "—"}
            subtitle={[item.project_name, item.customer_name].filter(Boolean).join(" · ") || undefined}
            meta={[item.sheet_code, formatDate(item.created_at), item.created_by].filter(Boolean).join(" · ")}
            trailing={
              <>
                <View style={styles.badge}>
                  <StatusBadge label={st.label} color={st.color} />
                </View>
                <MoneyText value={item.gia_tri_hd_sau_ck ?? item.base_price} short variant="subhead" />
              </>
            }
            onPress={() => router.push({ pathname: "/price-sheet/[id]", params: { id: item.id } })}
          />
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={
          <AppHeader
            variant="soft"
            title="Phiếu tính giá"
            subtitle={loading ? undefined : `${total} phiếu`}
            hideBack={embedded}
            actions={
              canAdd ? (
                <IconButton
                  icon={Plus}
                  variant="soft"
                  accessibilityLabel="Lập phiếu tính giá"
                  onPress={() => router.push("/price-sheet/new")}
                />
              ) : null
            }
          />
        }
      >
        <FlatList
          data={loading ? [] : rows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={empty()}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} />
            ) : rows.length && rows.length >= total ? (
              <Text variant="caption" color="textTertiary" style={styles.end}>
                Đã hiện hết {total} phiếu
              </Text>
            ) : null
          }
          onEndReached={() => {
            if (!loading && !loadingMore && !refreshing && rows.length < total) void load("more");
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : space.xxl }}
        />
      </Screen>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  sticky: { backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg, gap: space.md },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  separator: { height: space.sm + 2 },
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  badge: { alignSelf: "flex-end" },
  footer: { paddingVertical: space.lg },
  end: { textAlign: "center", paddingVertical: space.lg },
});
