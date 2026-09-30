import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  Chip,
  EmptyState,
  ErrorState,
  ListItem,
  MoneyText,
  Screen,
  SearchBar,
  SkeletonList,
  StatusBadge,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, space } from "@/theme";
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

  const [statusList, setStatusList] = useState<any[]>([]);
  const [duAn, setDuAn] = useState<any[]>([]);

  const [dataAll, setDataAll] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  // Phân trang: trang đã tải, còn dữ liệu không, bộ lọc hiện tại, chống race
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const filterRef = useRef<any>(null);
  const requestVersion = useRef(0);

  const [selectTT, setSelectTT] = useState<any>("");

  // Lọc nhanh theo tab trạng thái trên dữ liệu đã tải
  const data = useMemo(
    () =>
      !selectTT || selectTT === "Tất cả"
        ? dataAll
        : dataAll.filter((item) => item?.tenTT === selectTT),
    [dataAll, selectTT],
  );

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
    const res = await BookingService.listBookings({
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
      // Trạng thái booking — cloud pgc_trang_thai
      const resTT = await BookingService.getBookingStatus();

      let arr: any[] = [];
      arr.push({ id: 0, title: "Tất cả", ColorWeb: null });

      (resTT?.data ?? []).forEach((item: any) => {
        arr.push({
          id: item.id,
          title: item.item_name,
          ColorWeb: item.color_code || null,
        });
      });

      setStatusList(arr);

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

  /* ---------------- STATUS FILTER ---------------- */

  const applyChangeFilter = (p: string, v: any) => {
    const newFilter = {
      ...filterCondition,
      [p]: v,
      MaTT: v,
      Offset: 1,
    };

    setFilterCondition(newFilter);

    loadData2(newFilter);
  };

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
    setSelectTT("");
    setShowFilters(false);

    // Nếu danh sách dự án đang trống thì effect [selectedProjects] không chạy,
    // nên gọi tải lại trực tiếp để đảm bảo về trạng thái "Tất cả".
    if (selectedProjects.length === 0) {
      loadData2(resetFilter);
    }
    setSelectedProjects([]);
  };

  // Có bộ lọc đang hoạt động: chọn dự án hoặc chọn trạng thái khác "Tất cả" (id 0)
  const activeFilterCount =
    (selectedProjects.length > 0 ? 1 : 0) +
    (Number(filterCondition.MaTT) !== 0 ? 1 : 0);
  const isFiltering = activeFilterCount > 0 || !!searchQuery || (!!selectTT && selectTT !== "Tất cả");

  // Map tên trạng thái -> màu trả về từ data (pgc_trang_thai.color_code), dự phòng khi dòng thiếu colorCode
  const statusColorMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    statusList.forEach((s: any) => {
      if (s?.title) map[s.title] = s.ColorWeb ?? null;
    });
    return map;
  }, [statusList]);

  const renderItem = useCallback(
    ({ item: booking }: { item: any }) => (
      <ListItem
        leading={<Avatar name={booking.khachHang || "?"} />}
        title={booking.khachHang || "—"}
        subtitle={[booking.maSanPham || booking.soPhieu, booking.tenDA].filter(Boolean).join(" · ")}
        meta={[booking.soPhieu, formatDate(booking.ngayGiuCho)].filter(Boolean).join(" · ")}
        trailing={
          <>
            <MoneyText value={booking.tongGiaGomVAT} short />
            {booking?.tenTT ? (
              <StatusBadge
                label={booking.tenTT}
                color={booking.colorCode ?? statusColorMap[booking.tenTT]}
              />
            ) : null}
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
    ),
    [router, statusColorMap]
  );

  const listHeader = (
    <View style={styles.stickyHeader}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Mã booking, khách hàng, căn"
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
          <FilterSection
            title="Trạng thái"
            options={statusList.map((status: any) => ({
              key: status?.id,
              label: status?.title,
              selected: filterCondition?.MaTT === status?.id,
              color: status?.id === 0 ? null : status?.ColorWeb,
              onPress: () => applyChangeFilter("TrangThai", status?.id),
            }))}
          />
        </FilterPanel>
      )}

      {/* Lọc nhanh theo trạng thái trên dữ liệu đã tải */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {statusList.map((status) => {
          const active = status.id === 0 ? !selectTT || selectTT === "Tất cả" : selectTT === status.title;
          const count =
            status.id === 0
              ? dataAll?.length
              : dataAll?.filter((item) => item?.tenTT === status.title)?.length;
          return (
            <Chip
              key={status.id}
              label={status.title}
              count={count}
              selected={active}
              onPress={() => setSelectTT(status?.title)}
            />
          );
        })}
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
            title="Booking"
            // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
            hideBack={embedded}
            actions={
              <View style={styles.headerAction}>
                <FilterToggleButton
                  open={showFilters}
                  activeCount={activeFilterCount}
                  onPress={() => setShowFilters(!showFilters)}
                />
              </View>
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
  headerAction: { paddingRight: space.sm },
  stickyHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  chips: { gap: space.sm, paddingRight: space.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
  footerSpinner: { paddingVertical: space.lg },
});
