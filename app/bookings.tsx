import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
} from "lucide-react-native";
import {
  FilterPanel,
  FilterSection,
  FilterToggleButton,
  multiSelectOptions,
} from "@/components/FilterPanel";
import Colors from "@/constants/colors";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

/** Số booking mỗi lần gọi fn_booking_list; cuộn tới cuối thì tải thêm */
const PAGE_SIZE = 20;

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

/** Chuẩn hoá màu hex (#RGB hoặc #RRGGBB) -> "RRGGBB" */
const normalizeHex = (color?: string): string | null => {
  if (!color || typeof color !== "string") return null;
  const c = color.trim();
  if (!c.startsWith("#")) return null;
  let hex = c.slice(1);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  if (hex.length !== 6) return null;
  return hex;
};

/** Tự chọn màu chữ (đen/trắng) tương phản với màu nền để dễ đọc */
const getContrastTextColor = (bg?: string): string => {
  const hex = normalizeHex(bg);
  if (!hex) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1F2937" : "#FFFFFF";
};

export default function BookingsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();

  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

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

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - 300
    ) {
      void loadMore();
    }
  };

  /* ---------------- LOAD DATA ---------------- */

  const loadData = async () => {
    setLoading(true);
    try {
      // Trạng thái booking — cloud pgc_trang_thai
      const resTT = await BookingService.getBookingStatus();

      let arr: any[] = [];
      arr.push({ id: 0, title: "Tất cả", ColorWeb: "#8B5CF6" });

      (resTT?.data ?? []).forEach((item: any) => {
        arr.push({
          id: item.id,
          title: item.item_name,
          ColorWeb: item.color_code || "#8B5CF6",
        });
      });

      setStatusList(arr);

      const resDA = await ProjectService.getProjects({});
      setDuAn(resDA?.data ?? []);

      // Danh sách booking — fn_booking_list, trang đầu
      await fetchBookings(filterCondition, 1, false);
    } catch (err) {
      console.log("loadData error", err);
    }

    setLoading(false);
  };

  const loadData2 = async (_filter: any) => {
    setLoading(true);
    try {
      await fetchBookings(_filter, 1, false);
    } catch (err) {
      console.log("loadData2 error", err);
    }
    setLoading(false);
  };

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    loadData();
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
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      const newFilter = {
        ...filterCondition,
        inputSearch: searchQuery,
        Offset: 1,
      };

      setFilterCondition(newFilter);
      loadData2(newFilter);
    }, 500);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

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

  /* ---------------- STATUS CLICK LOCAL ---------------- */

  const handleTT = (trangThai: string) => {
    setSelectTT(trangThai);
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

  // Map tên trạng thái -> màu trả về từ data (pgc_trang_thai.color_code)
  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    statusList.forEach((s: any) => {
      if (s?.title) map[s.title] = s.ColorWeb || Colors.primary;
    });
    return map;
  }, [statusList]);

  const getStatusColor = (tenTT?: string): string =>
    (tenTT && statusColorMap[tenTT]) || Colors.primary;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Booking",
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
          },
          headerShadowVisible: false,
          // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
          headerLeft: embedded
            ? undefined
            : () => (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.headerBackButton}
                >
                  <ChevronLeft color={Colors.text} size={24} />
                </TouchableOpacity>
              ),
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        // Tìm kiếm + bộ lọc + tab trạng thái bám dính phía trên khi cuộn
        stickyHeaderIndices={[0]}
      >
        <View style={styles.stickyHeader}>
          {/* Search & Filter */}
          <View style={styles.searchAndFilterRow}>
            <View style={styles.searchContainer}>
              <Search color={Colors.textSecondary} size={20} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm booking, khách hàng..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery !== "" && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X color={Colors.textSecondary} size={20} />
                </TouchableOpacity>
              )}
            </View>

            <FilterToggleButton
              open={showFilters}
              activeCount={activeFilterCount}
              onPress={() => setShowFilters(!showFilters)}
            />
          </View>

          {/* Filters Panel */}
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

          {/* Stats Row - Clickable Status Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScrollContent}
            style={styles.statsScroll}
          >
            {statusList.map((status) => {
              const active = selectTT === status.title;
              const count =
                status.id === 0
                  ? dataAll?.length
                  : dataAll?.filter((item) => item?.tenTT === status.title)
                      ?.length;

              return (
                <TouchableOpacity
                  key={status.id}
                  activeOpacity={0.8}
                  style={[
                    styles.statCard,
                    { backgroundColor: status.ColorWeb },
                    active && styles.statCardSelected,
                  ]}
                  onPress={() => handleTT(status?.title)}
                >
                  <Text style={styles.statValue}>{count}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {status.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Booking List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {data.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Calendar color={Colors.textSecondary} size={48} />
                </View>
                <Text style={styles.emptyText}>Không tìm thấy booking nào</Text>
                <Text style={styles.emptySubtext}>
                  Thử thay đổi bộ lọc hoặc tìm kiếm khác
                </Text>
              </View>
            ) : (
              <>
                {data.map((booking, index) => (
                  <TouchableOpacity
                    key={`${booking?.maPGC ?? booking?.id ?? booking?.soPhieu ?? "row"}-${index}`}
                    style={styles.bookingCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: "/booking/[id]",
                        // id phiếu booking là duy nhất; 1 phiếu giữ chỗ (maPGC) có thể
                        // có nhiều booking (vd. booking cũ đã huỷ + booking mới)
                        params: { id: booking.id ?? booking.maPGC },
                      })
                    }
                  >
                    <View style={styles.cardLeft}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(booking.tenTT) },
                          ]}
                        />
                        <Text style={styles.bookingId} numberOfLines={1}>
                          #{booking.maSanPham || booking.soPhieu || "—"}
                        </Text>
                        {booking?.tenTT ? (
                          <View
                            style={[
                              styles.priorityBadge,
                              {
                                backgroundColor: getStatusColor(booking.tenTT),
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.priorityText,
                                {
                                  color: getContrastTextColor(
                                    getStatusColor(booking.tenTT),
                                  ),
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {booking.tenTT}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.customerName} numberOfLines={1}>
                        {booking.khachHang}
                      </Text>
                      <Text style={styles.productCode} numberOfLines={1}>
                        {booking.soPhieu}
                      </Text>

                      <View style={styles.dateRow}>
                        <Text style={styles.dateText}>
                          {booking.ngayGiuCho
                            ? new Date(booking.ngayGiuCho).toLocaleDateString(
                                "vi-VN",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )
                            : "--"}
                        </Text>
                        <Text style={styles.dateSeparator}>•</Text>
                        <Text style={styles.projectName} numberOfLines={1}>
                          {booking.tenDA}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardRight}>
                      <Text style={styles.amount} numberOfLines={1}>
                        {new Intl.NumberFormat("vi-VN").format(
                          Math.round(Number(booking.tongGiaGomVAT) || 0),
                        )}{" "}
                        đ
                      </Text>
                      <ChevronRight color={Colors.textTertiary} size={20} />
                    </View>
                  </TouchableOpacity>
                ))}
                {loadingMore && (
                  <ActivityIndicator
                    style={{ paddingVertical: 16 }}
                    color={Colors.primary}
                  />
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stickyHeader: {
    backgroundColor: Colors.background,
    // Phủ kín padding ngang của scrollContent để thẻ booking không lộ ra 2 bên
    marginHorizontal: -15,
    paddingHorizontal: 15,
    paddingBottom: 12,
  },
  headerBackButton: {
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 40,
  },
  searchAndFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  statsScroll: {},
  statsScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  statCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center" as const,
    minWidth: 72,
  },
  statCardSelected: {
    borderWidth: 2.5,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  listContainer: {
    gap: 10,
  },
  bookingCard: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: "hidden",
    flexShrink: 1,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700" as const,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bookingId: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
    flexShrink: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  productCode: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  dateSeparator: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  projectName: {
    fontSize: 12,
    color: Colors.textTertiary,
    flex: 1,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.primary,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.backgroundTertiary,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
