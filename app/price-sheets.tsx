import { PRICE_SHEET_CREATE_LOCKED } from "@/lib/featureConfig";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Calculator, FileX2, Plus, SearchX } from "lucide-react-native";

import { FilterPanel, FilterSection, FilterToggleButton } from "@/components/FilterPanel";
import {
  AppHeader,
  Chip,
  EmptyState,
  ErrorState,
  ListItem,
  MoneyText,
  Screen,
  SearchBar,
  SkeletonList,
  StatusBadge,
  Text,
  useToast,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { PRICE_SHEET_STATUSES, priceSheetStatus } from "@/lib/priceSheetStatus";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PriceSheetService, type PriceSheetRow } from "@/services/PriceSheetService";
import { ProjectService } from "@/services/ProjectService";
import { colors, elevation, radius, space } from "@/theme";

const PAGE_SIZE = 20;
const TAB_BAR_SPACE = 100;
const ALL = "all";
/** Chiều cao nút nổi "Lập phiếu" + khoảng hở — để thẻ cuối không bị che. */
const FAB_SPACE = 72;
const PRODUCT_TYPES = [
  { value: ALL, label: "Tất cả" },
  { value: "Cao tầng", label: "Cao tầng" },
  { value: "Thấp tầng", label: "Thấp tầng" },
];

type Stats = { draft: number; sent: number; approved: number; rejected: number };

/**
 * Danh sách phiếu tính giá – fn_price_sheet_list như web (phieu-tinh-gia/index.tsx): lọc / phân trang / thống kê ở
 * máy chủ, phạm vi dự án theo nhân viên. Chỉ tài khoản nội bộ (tính năng 17 không có trong danh sách đại lý).
 */
export default function PriceSheetsScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [productType, setProductType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [canAdd, setCanAdd] = useState(false);
  // Dự án + Loại sản phẩm nằm trong Bộ lọc (trước là ô chọn + thanh chuyển luôn hiện ⇒ đầu màn 4 tầng, gần nửa màn —
  // 2026-11-17, như màn Khách hàng; docs/app-api-rieng.md)
  const [showFilters, setShowFilters] = useState(false);

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
    PriceSheetService.perms().then((p) => setCanAdd(p.ADD));
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
  const activeFilterCount = (projectId !== ALL ? 1 : 0) + (productType !== ALL ? 1 : 0);
  const openCreate = () =>
    PRICE_SHEET_CREATE_LOCKED
      ? toast.show({ type: "info", message: "Lập phiếu tính giá trên web — app tạm chỉ xem phiếu" })
      : router.push("/price-sheet/new");

  const header = (
    <View style={styles.sticky}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Mã phiếu, mã căn, sản phẩm…" variant="soft" />
      {showFilters ? (
        <FilterPanel
          activeCount={activeFilterCount}
          onReset={() => {
            setProjectId(ALL);
            setProductType(ALL);
          }}
        >
          <FilterSection
            title="Dự án"
            options={[{ value: ALL, label: "Tất cả dự án" }, ...projects].map((p) => ({
              key: p.value,
              label: p.label,
              selected: projectId === p.value,
              onPress: () => setProjectId(p.value),
            }))}
          />
          <FilterSection
            title="Loại sản phẩm"
            options={PRODUCT_TYPES.map((t) => ({
              key: t.value,
              label: t.label,
              selected: productType === t.value,
              onPress: () => setProductType(t.value),
            }))}
          />
        </FilterPanel>
      ) : null}
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
        description={canAdd ? "Bấm “Lập phiếu” để lập phiếu tính giá cho một căn." : "Phiếu tính giá được lập trên web hoặc app."}
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
            // Ngày lên trước mã phiếu (mã dài kiểu "PTG-Capital Square 2-0003" làm ngày bị cắt)
            meta={[formatDate(item.created_at), item.sheet_code, item.created_by].filter(Boolean).join(" · ")}
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
              <FilterToggleButton open={showFilters} activeCount={activeFilterCount} onPress={() => setShowFilters((v) => !v)} />
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
          contentContainerStyle={{ paddingBottom: (embedded ? TAB_BAR_SPACE : space.xxl) + (canAdd ? FAB_SPACE : 0) }}
        />
        {/* Lập phiếu: nút nổi như "Thêm khách hàng" / "Thêm lịch ký" (đầu màn chỉ còn Bộ lọc) */}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lập phiếu tính giá"
            onPress={openCreate}
            style={({ pressed }) => [styles.fab, { bottom: embedded ? TAB_BAR_SPACE : space.xl }, pressed ? styles.fabPressed : null]}
          >
            <Plus size={20} color={colors.onPrimary} />
            <Text variant="subhead" color="onPrimary">
              Lập phiếu
            </Text>
          </Pressable>
        ) : null}
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
  fab: {
    position: "absolute",
    right: space.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    ...elevation.overlay,
  },
  fabPressed: { backgroundColor: colors.primaryPressed },
});
