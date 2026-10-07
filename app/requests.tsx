import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { MessageSquareText, Plus, SearchX } from "lucide-react-native";

import { FilterPanel, FilterSection, FilterToggleButton } from "@/components/FilterPanel";
import { RequestRowItem } from "@/components/request/RequestRowItem";
import {
  AppHeader,
  Chip,
  EmptyState,
  ErrorState,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { isOverdue, mapCatalog, type CustomerRequest } from "@/lib/customerRequest";
import { PERIOD_LABEL, periodRange, type PeriodType } from "@/lib/reportPeriod";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, elevation, radius, space } from "@/theme";
import { CustomerRequestService, type RequestCatalogs } from "@/sevicesSupabase/CustomerRequestService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;
const PAGE_SIZE = 30;

type Period = Exclude<PeriodType, "custom"> | "all";
const PERIOD_OPTIONS: Period[] = ["all", "today", "week", "month", "year"];
const periodLabel = (p: Period) => (p === "all" ? "Tất cả" : PERIOD_LABEL[p]);

const EMPTY_CATALOGS: RequestCatalogs = {
  dm_loai_yeu_cau: mapCatalog([], "dm_loai_yeu_cau"),
  dm_nguon_yeu_cau: mapCatalog([], "dm_nguon_yeu_cau"),
  dm_uu_tien_yeu_cau: mapCatalog([], "dm_uu_tien_yeu_cau"),
  dm_trang_thai_yeu_cau: mapCatalog([], "dm_trang_thai_yeu_cau"),
};

/**
 * Yêu cầu khách hàng – như web (beeland/src/pages/customers/tiep-nhan-yeu-cau/yeu-cau-khach-hang/index.tsx):
 * tìm (mã, khách, SĐT, tiêu đề) + lọc dự án / trạng thái / nguồn / ưu tiên / thời gian gửi xuống fn_customer_request_list,
 * mặc định "Tháng này" như web. Gồm cả yêu cầu khách tự gửi từ app / web khách hàng.
 * Kiểu bo tròn: header/ô tìm/chip `soft`, mỗi yêu cầu là card bo `radius.xxl`, nút "Tiếp nhận" nổi dạng viên.
 */
export default function RequestsScreen({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 400);
  const [status, setStatus] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [catalogs, setCatalogs] = useState<RequestCatalogs>(EMPTY_CATALOGS);

  const [rows, setRows] = useState<CustomerRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const firstFocus = useRef(true);
  const now = Date.now();

  useEffect(() => {
    ProjectService.getProjects({})
      .then((r: any) => setProjects(r?.data ?? []))
      .catch(() => setProjects([]));
    CustomerRequestService.catalogs()
      .then(setCatalogs)
      .catch(() => {});
  }, []);

  const projectCode = useMemo(() => {
    const p = projects.find((x: any) => String(x.id) === projectId);
    return p ? String(p.ma_da_code || p.id) : null;
  }, [projects, projectId]);

  const range = useMemo(() => (period === "all" ? null : periodRange(period)), [period]);

  const load = useCallback(
    async (kind: "load" | "refresh" | "more") => {
      const v = kind === "more" ? version.current : ++version.current;
      const nextPage = kind === "more" ? page + 1 : 1;
      if (kind === "load") setLoading(true);
      else if (kind === "refresh") setRefreshing(true);
      else setLoadingMore(true);
      try {
        const res = await CustomerRequestService.list({
          keyword: debounced,
          projectCode,
          status,
          source,
          priority,
          from: range?.from ?? null,
          to: range?.to ?? null,
          page: nextPage,
          size: PAGE_SIZE,
        });
        if (v !== version.current) return;
        setRows((prev) => (kind === "more" ? [...prev, ...res.rows.filter((r) => !prev.some((p) => p.id === r.id))] : res.rows));
        setTotal(res.total);
        setPage(nextPage);
        setError(null);
      } catch (e: any) {
        if (v === version.current && kind !== "more") setError(e?.message || "Không tải được danh sách yêu cầu.");
      } finally {
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [debounced, projectCode, status, source, priority, range, page],
  );

  // Đổi bộ lọc → tải lại trang 1 (không phụ thuộc `page`)
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void loadRef.current("load");
  }, [debounced, projectCode, status, source, priority, range]);

  // Quay lại từ chi tiết / form → tải lại
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void loadRef.current("refresh");
    }, []),
  );

  const hasMore = rows.length < total;
  const loadMore = () => {
    if (loading || loadingMore || refreshing || !hasMore || error) return;
    void load("more");
  };

  const statuses = catalogs.dm_trang_thai_yeu_cau;
  const priorities = catalogs.dm_uu_tien_yeu_cau;

  const activeFilterCount = (projectId ? 1 : 0) + (source ? 1 : 0) + (priority ? 1 : 0) + (period !== "month" ? 1 : 0);
  const filtering = activeFilterCount > 0 || !!status || !!query;
  const clear = () => {
    setQuery("");
    setProjectId(null);
    setSource(null);
    setPriority(null);
    setStatus(null);
    setPeriod("month");
    setShowFilters(false);
  };

  const open = useCallback(
    (r: CustomerRequest) => router.push({ pathname: "/request/[id]", params: { id: r.id } }),
    [router],
  );
  const add = () => router.push({ pathname: "/request/form", params: { projectId: projectId ?? "" } });

  const toolbar = (
    <View style={styles.sticky}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Tìm mã YC, khách hàng, SĐT, tiêu đề…"
        variant="soft"
      />
      {showFilters ? (
        <FilterPanel activeCount={activeFilterCount} onReset={clear}>
          <FilterSection
            title="Thời gian tiếp nhận"
            options={PERIOD_OPTIONS.map((p) => ({
              key: p,
              label: periodLabel(p),
              selected: period === p,
              onPress: () => setPeriod(p),
            }))}
          />
          <FilterSection
            title="Dự án"
            hint="Chọn 1"
            options={projects.map((p: any) => ({
              key: String(p.id),
              label: p.ten_da || p.TenDA || "—",
              selected: projectId === String(p.id),
              onPress: () => setProjectId(projectId === String(p.id) ? null : String(p.id)),
            }))}
          />
          <FilterSection
            title="Nguồn"
            hint="Chọn 1"
            options={catalogs.dm_nguon_yeu_cau.map((c) => ({
              key: c.ID,
              label: c.Name,
              selected: source === c.ID,
              onPress: () => setSource(source === c.ID ? null : c.ID),
            }))}
          />
          <FilterSection
            title="Mức ưu tiên"
            hint="Chọn 1"
            options={priorities.map((c) => ({
              key: c.ID,
              label: c.Name,
              selected: priority === c.ID,
              onPress: () => setPriority(priority === c.ID ? null : c.ID),
            }))}
          />
        </FilterPanel>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip variant="soft" label="Tất cả" selected={!status} onPress={() => setStatus(null)} />
        {statuses.map((c) => (
          <Chip
            variant="soft"
            key={c.ID}
            label={c.Name}
            selected={status === c.ID}
            onPress={() => setStatus(status === c.ID ? null : c.ID)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const empty = () => {
    if (loading) return <SkeletonList />;
    if (error) return <ErrorState description={error} onRetry={() => void load("load")} />;
    return filtering ? (
      <EmptyState
        icon={SearchX}
        title="Không có yêu cầu phù hợp"
        description="Thử đổi từ khoá, thời gian hoặc bỏ bớt bộ lọc."
        actionLabel="Xoá bộ lọc"
        onAction={clear}
      />
    ) : (
      <EmptyState
        icon={MessageSquareText}
        title="Chưa có yêu cầu trong tháng"
        description="Yêu cầu khách gửi từ app / web khách hàng sẽ hiện ở đây. Bấm “Tiếp nhận” để ghi nhận yêu cầu mới."
      />
    );
  };

  const bottomPad = embedded ? TAB_BAR_SPACE + 72 : space.xxl + 72;
  const subtitle = loading ? undefined : `${total} yêu cầu · ${periodLabel(period)}`;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={
          <AppHeader
            variant="soft"
            title="Yêu cầu khách hàng"
            subtitle={subtitle}
            hideBack={embedded}
            actions={
              <FilterToggleButton
                open={showFilters}
                activeCount={activeFilterCount}
                onPress={() => setShowFilters(!showFilters)}
              />
            }
          />
        }
      >
        <FlatList
          data={loading ? [] : rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <RequestRowItem
              item={item}
              statuses={statuses}
              priorities={priorities}
              overdue={isOverdue(item, now)}
              onPress={() => open(item)}
            />
          )}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={toolbar}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={empty()}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null
          }
          onEndReached={loadMore}
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
          contentContainerStyle={{ paddingBottom: bottomPad }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tiếp nhận yêu cầu mới"
          onPress={add}
          style={({ pressed }) => [
            styles.fab,
            { bottom: embedded ? TAB_BAR_SPACE : space.xl },
            pressed ? styles.fabPressed : null,
          ]}
        >
          <Plus size={20} color={colors.onPrimary} />
          <Text variant="subhead" color="onPrimary">
            Tiếp nhận
          </Text>
        </Pressable>
      </Screen>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  sticky: {
    backgroundColor: colors.bg,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  separator: { height: space.sm + 2 },
  more: { paddingVertical: space.lg },
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
