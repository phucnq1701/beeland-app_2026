import React, { useState, useEffect, useRef, useCallback } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { CalendarX2, SearchX } from "lucide-react-native";
import {
  FilterPanel,
  FilterSection,
  FilterToggleButton,
  multiSelectOptions,
} from "@/components/FilterPanel";
import {
  AppHeader,
  Avatar,
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  ListItem,
  MoneyText,
  Screen,
  SearchBar,
  SkeletonList,
} from "@/components/ui";
import { BOOKING_TABS, BookingTabKey, bookingStateBadge, statesForTab } from "@/lib/bookingState";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, elevation, radius, space } from "@/theme";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

/** Số booking mỗi lần gọi fn_booking_list; cuộn tới cuối thì tải thêm */
const PAGE_SIZE = 20;

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

/** Loại bỏ bản ghi trùng theo id ổn định (maPGC -> id -> soPhieu), giữ bản đầu tiên */
const dedupeBookings = (list: any[]): any[] => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of Array.isArray(list) ? list : []) {
    const k = String(item?.maPGC ?? item?.id ?? item?.soPhieu ?? "");
    if (!k) {
      out.push(item);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
};

export default function BookingsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();

  const firstLoad = useRef(true);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  const [duAn, setDuAn] = useState<any[]>([]);

  const [dataAll, setDataAll] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  // Phân trang: trang đã tải, còn dữ liệu không, bộ lọc hiện tại, chống race
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const filterRef = useRef<any>(null);
  const requestVersion = useRef(0);

  // Tab trạng thái booking (Tất cả · Chờ duyệt · Đã duyệt · Huỷ booking) – lọc ở máy chủ (p_states), số đếm = tổng máy chủ
  const [tab, setTab] = useState<BookingTabKey>("ALL");
  const tabRef = useRef<BookingTabKey>("ALL");
  tabRef.current = tab;
  const [counts, setCounts] = useState<Partial<Record<BookingTabKey, number>>>({});
  const data = dataAll;

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    MaTT: 0,
    MaKhu: 0,
    inputSearch: "",
    Offset: 1,
    Limit: PAGE_SIZE,
  });

  /**
   * Gọi 1 trang fn_booking_list. append=false: tải lại từ đầu (đổi bộ lọc);
   * append=true: nối thêm trang tiếp theo khi cuộn tới cuối.
   */
  const fetchBookings = async (_filter: any, page: number, append: boolean) => {
    const version = append ? requestVersion.current : ++requestVersion.current;
    const listFilter = {
      maDA: _filter?.DuAn
        ? String(_filter.DuAn)
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
      maTT: _filter?.MaTT,
      keyword: _filter?.inputSearch ?? "",
      tuNgay: _filter?.TuNgay,
      denNgay: _filter?.DenNgay,
    };
    // Trang đầu: đếm song song tổng từng tab theo cùng bộ lọc (dự án, tìm kiếm, ngày)
    if (!append) void loadCounts(listFilter, version);
    const res = await BookingService.listBookings({
      ...listFilter,
      states: statesForTab(tabRef.current),
      pageSize: PAGE_SIZE,
      pageIndex: page,
    });
    // Bộ lọc đã đổi trong lúc chờ → bỏ kết quả cũ
    if (version !== requestVersion.current) return;

    const rows = res?.data ?? [];
    const total = Number(res?.total) || 0;
    pageRef.current = page;
    filterRef.current = _filter;
    hasMoreRef.current = rows.length >= PAGE_SIZE && page * PAGE_SIZE < total;
    setDataAll((prev) => dedupeBookings(append ? [...prev, ...rows] : rows));
  };

  const loadCounts = async (listFilter: any, version: number) => {
    const totals = await Promise.all(
      BOOKING_TABS.map((t) =>
        BookingService.listBookings({ ...listFilter, states: statesForTab(t.key), pageSize: 1, pageIndex: 1 })
          .then((r: any) => Number(r?.total) || 0)
          .catch(() => undefined)
      )
    );
    if (version !== requestVersion.current) return;
    const next: Partial<Record<BookingTabKey, number>> = {};
    BOOKING_TABS.forEach((t, i) => {
      if (totals[i] != null) next[t.key] = totals[i];
    });
    setCounts(next);
  };

  const loadMore = async () => {
    if (loading || loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchBookings(filterRef.current, pageRef.current + 1, true);
    } catch (err) {
      console.log("loadMore error", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  /* ---------------- LOAD DATA ---------------- */

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const resDA = await ProjectService.getProjects({});
      setDuAn(resDA?.data ?? []);

      // Danh sách booking — fn_booking_list, trang đầu
      await fetchBookings(filterCondition, 1, false);
    } catch (err) {
      console.log("loadData error", err);
      setLoadError(true);
    }

    setLoading(false);
  };

  const loadData2 = async (_filter: any) => {
    setLoading(true);
    setLoadError(false);
    try {
      await fetchBookings(_filter, 1, false);
    } catch (err) {
      console.log("loadData2 error", err);
      setLoadError(true);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setLoadError(false);
    try {
      await fetchBookings(filterRef.current ?? filterCondition, 1, false);
    } catch (err) {
      console.log("refresh error", err);
      setLoadError(true);
    }
    setRefreshing(false);
  };

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quay lại danh sách (sau thanh toán / duyệt / huỷ ở màn chi tiết) → nạp lại trang đầu
  // theo bộ lọc hiện tại, không hiện spinner. Lần focus đầu bỏ qua vì đã tải khi mount.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) {
        fetchBookings(filterRef.current ?? filterCondition, 1, false).catch((err) =>
          console.log("focus refresh error", err)
        );
      }
      hasFocusedOnce.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  /* ---------------- SEARCH DEBOUNCE ---------------- */

  useEffect(() => {
    const newFilter = {
      ...filterCondition,
      inputSearch: debouncedQuery,
      Offset: 1,
    };

    setFilterCondition(newFilter);
    loadData2(newFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  /* ---------------- PROJECT FILTER ---------------- */

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }

    const newFilter = {
      ...filterCondition,
      DuAn: selectedProjects.length
        ? "," + selectedProjects.join(",") + ","
        : "",
      Offset: 1,
    };

    setFilterCondition(newFilter);

    loadData2(newFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjects]);

  /* ---------------- STATUS TAB ---------------- */

  // Đổi tab → tải lại trang đầu theo trạng thái mới (lần render đầu bỏ qua vì loadData đã tải)
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    loadData2(filterRef.current ?? filterCondition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* ---------------- CLEAR FILTER ---------------- */

  const clearFilters = () => {
    const resetFilter = {
      ...filterCondition,
      DuAn: "",
      MaTT: 0,
      inputSearch: "",
      Offset: 1,
    };

    setFilterCondition(resetFilter);
    setSearchQuery("");
    setTab("ALL");
    setShowFilters(false);

    // Nếu danh sách dự án đang trống thì effect [selectedProjects] không chạy,
    // nên gọi tải lại trực tiếp để đảm bảo về trạng thái "Tất cả".
    if (selectedProjects.length === 0) {
      loadData2(resetFilter);
    }
    setSelectedProjects([]);
  };

  // Có bộ lọc đang hoạt động: chọn dự án (trạng thái nằm ở tab)
  const activeFilterCount = selectedProjects.length > 0 ? 1 : 0;
  const isFiltering = activeFilterCount > 0 || !!searchQuery || tab !== "ALL";

  const renderItem = useCallback(
    ({ item: booking }: { item: any }) => (
      // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
      <View style={styles.card}>
        <View style={styles.clip}>
          <ListItem
            leading={<Avatar name={booking.khachHang || "?"} size={44} round />}
            title={booking.khachHang || "—"}
            subtitle={[booking.maSanPham || booking.soPhieu, booking.tenDA].filter(Boolean).join(" · ")}
            meta={[booking.soPhieu, formatDate(booking.ngayGiuCho)].filter(Boolean).join(" · ")}
            trailing={
              <>
                {/* Bọc lại để badge căn phải (Badge tự alignSelf flex-start) */}
                <View style={styles.badge}>
                  <Badge {...bookingStateBadge(booking.state)} />
                </View>
                <MoneyText value={booking.tongGiaGomVAT} short variant="subhead" />
              </>
            }
            onPress={() =>
              router.push({
                pathname: "/booking/[id]",
                // id phiếu booking là duy nhất; 1 phiếu giữ chỗ (maPGC) có thể
                // có nhiều booking (vd. booking cũ đã huỷ + booking mới)
                params: { id: booking.id ?? booking.maPGC },
              })
            }
          />
        </View>
      </View>
    ),
    [router]
  );

  const listHeader = (
    <View style={styles.stickyHeader}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Mã booking, khách hàng, căn"
        variant="soft"
      />

      {showFilters && (
        <FilterPanel activeCount={activeFilterCount} onReset={clearFilters}>
          <FilterSection
            title="Dự án"
            hint="Chọn nhiều"
            options={multiSelectOptions(
              duAn,
              (p: any) => p.MaDA,
              (p: any) => p.TenDA,
              selectedProjects,
              setSelectedProjects,
            )}
          />
        </FilterPanel>
      )}

      {/* Tab trạng thái booking – lọc ở máy chủ, số = tổng theo bộ lọc hiện tại */}
      {/* Tràn ra mép màn để bóng chip không bị cắt ở hai đầu */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {BOOKING_TABS.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            count={counts[t.key]}
            selected={tab === t.key}
            onPress={() => setTab(t.key)}
            variant="soft"
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderBody = () => {
    if (loading && dataAll.length === 0) return <SkeletonList />;
    if (loadError && dataAll.length === 0) return <ErrorState onRetry={loadData} />;
    if (data.length === 0) {
      return isFiltering ? (
        <EmptyState
          icon={SearchX}
          title="Không có booking phù hợp"
          description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc."
          actionLabel="Xoá bộ lọc"
          onAction={clearFilters}
        />
      ) : (
        <EmptyState
          icon={CalendarX2}
          title="Chưa có booking nào"
          description="Tạo booking từ màn Sản phẩm hoặc Lock căn."
          actionLabel="Đến Sản phẩm"
          onAction={() => router.push("/products")}
        />
      );
    }
    return null;
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
            title="Booking"
            // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
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
          data={loading && dataAll.length === 0 ? [] : data}
          keyExtractor={(item, index) => `${item?.id ?? item?.maPGC ?? item?.soPhieu ?? "row"}-${index}`}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={listHeader}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={renderBody()}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
  stickyHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  separator: { height: space.sm + 2 },
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  badge: { alignSelf: "flex-end" },
  footerSpinner: { paddingVertical: space.lg },
});
