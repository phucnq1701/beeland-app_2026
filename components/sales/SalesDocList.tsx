import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { FileX2, SearchX } from "lucide-react-native";

import { FilterPanel, FilterSection, FilterToggleButton, multiSelectOptions } from "@/components/FilterPanel";
import { AppHeader, Chip, EmptyState, ErrorState, Screen, SearchBar, SkeletonList } from "@/components/ui";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, space } from "@/theme";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

const PAGE_SIZE = 20;
/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

export type StatusOption = { MaTT: number | string; TenTT: string; ColorWeb?: string | null };

/**
 * Danh sách chứng từ bán hàng (đặt cọc / hợp đồng) dùng chung: tìm kiếm (máy chủ), lọc dự án,
 * chip trạng thái (truyền MaTT xuống hàm máy chủ như web), phân trang khi cuộn, kéo làm mới.
 * Mỗi màn chỉ khai báo nguồn dữ liệu và cách vẽ một dòng.
 */
export function SalesDocList({
  title,
  embedded,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  fetchPage,
  fetchStatuses,
  statusFilter,
  renderRow,
  keyOf,
}: {
  title: string;
  embedded?: boolean;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  fetchPage: (filter: {
    inputSearch: string;
    DuAn: string;
    MaTT: number | string;
    Offset: number;
    Limit: number;
  }) => Promise<{ data: any[]; totalRows: number; error?: boolean }>;
  fetchStatuses: () => Promise<{ data: StatusOption[] }>;
  /** Trạng thái được hiện trên bộ lọc (mặc định: tất cả) */
  statusFilter?: (s: StatusOption) => boolean;
  renderRow: (item: any) => React.ReactElement;
  keyOf: (item: any, index: number) => string;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [status, setStatus] = useState<number | string>(0);
  const [showFilters, setShowFilters] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const page = useRef(1);
  const version = useRef(0);
  const firstFocus = useRef(true);

  useEffect(() => {
    ProjectService.getProjects({})
      .then((r: any) => setProjects(r?.data ?? []))
      .catch(() => setProjects([]));
    fetchStatuses()
      .then((r) => setStatuses((r?.data ?? []).filter(statusFilter ?? (() => true))))
      .catch(() => setStatuses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filter = useMemo(
    () => ({ inputSearch: debounced.trim(), DuAn: selectedProjects.join(","), MaTT: status, Limit: PAGE_SIZE }),
    [debounced, selectedProjects, status]
  );

  const load = useCallback(
    async (kind: "load" | "refresh" | "more") => {
      const v = kind === "more" ? version.current : ++version.current;
      const nextPage = kind === "more" ? page.current + 1 : 1;
      if (kind === "load") setLoading(true);
      if (kind === "refresh") setRefreshing(true);
      if (kind === "more") setLoadingMore(true);
      try {
        const res = await fetchPage({ ...filter, Offset: nextPage });
        if (v !== version.current) return;
        page.current = nextPage;
        setRows((prev) => (kind === "more" ? [...prev, ...(res?.data ?? [])] : res?.data ?? []));
        setTotal(res?.totalRows ?? 0);
        setError(!!res?.error && kind !== "more");
      } catch {
        if (v === version.current && kind !== "more") setError(true);
      } finally {
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchPage, filter]
  );

  useEffect(() => {
    void load("load");
  }, [load]);

  // Quay lại màn (sau khi xem chi tiết) → tải lại trang đầu
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void load("refresh");
    }, [load])
  );

  const hasMore = rows.length < total;
  const activeFilterCount = (selectedProjects.length ? 1 : 0) + (status ? 1 : 0);
  const filtering = activeFilterCount > 0 || !!query;
  const clear = () => {
    setQuery("");
    setSelectedProjects([]);
    setStatus(0);
    setShowFilters(false);
  };

  const header = (
    <View style={styles.sticky}>
      <SearchBar value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
      {showFilters ? (
        <FilterPanel activeCount={activeFilterCount} onReset={clear}>
          <FilterSection
            title="Dự án"
            hint="Chọn nhiều"
            options={multiSelectOptions(
              projects,
              (p: any) => p.MaDA,
              (p: any) => p.TenDA,
              selectedProjects,
              setSelectedProjects
            )}
          />
        </FilterPanel>
      ) : null}
      {statuses.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tất cả" selected={!status} onPress={() => setStatus(0)} />
          {statuses.map((s) => (
            <Chip key={String(s.MaTT)} label={s.TenTT} selected={status === s.MaTT} onPress={() => setStatus(s.MaTT)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  const empty = () => {
    if (loading) return <SkeletonList />;
    if (error) return <ErrorState description="Không tải được danh sách." onRetry={() => void load("load")} />;
    return filtering ? (
      <EmptyState
        icon={SearchX}
        title="Không có kết quả phù hợp"
        description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc."
        actionLabel="Xoá bộ lọc"
        onAction={clear}
      />
    ) : (
      <EmptyState icon={FileX2} title={emptyTitle} description={emptyDescription} />
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
            title={title}
            subtitle={loading ? undefined : `${total} phiếu`}
            hideBack={embedded}
            actions={
              <View style={styles.headerAction}>
                <FilterToggleButton open={showFilters} activeCount={activeFilterCount} onPress={() => setShowFilters(!showFilters)} />
              </View>
            }
          />
        }
      >
        <FlatList
          data={loading ? [] : rows}
          keyExtractor={keyOf}
          renderItem={({ item }) => renderRow(item)}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={empty()}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
          onEndReached={() => {
            if (!loading && !loadingMore && !refreshing && hasMore) void load("more");
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={colors.primary} colors={[colors.primary]} />
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
  headerAction: { paddingRight: space.sm },
  sticky: { backgroundColor: colors.bg, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
  footer: { paddingVertical: space.lg },
});
