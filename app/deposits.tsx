import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  ChevronLeft,
  Search,
  Landmark,
  Calendar,
  X,
  ChevronRight,
  Building2,
  Hash,
  SlidersHorizontal,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { DEMO_DEPOSITS, Deposit } from "@/mocks/deposits";
import { ProjectService } from "@/sevices/ProjectService";
import { DatCocService } from "@/sevices/DatCocService";

function formatCurrency(value: number): string {
  if (!value && value !== 0) return "0";
  if (value >= 1000000000) {
    const bil = value / 1000000000;
    return bil % 1 === 0 ? `${bil} tỷ` : `${bil.toFixed(1)} tỷ`;
  }
  if (value >= 1000000) {
    const mil = value / 1000000;
    return mil % 1 === 0 ? `${mil} triệu` : `${mil.toFixed(1)} triệu`;
  }
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
}

const statusColorMap: Record<string, string> = {
  "Đã thanh toán": "#10B981",
  "Chờ thanh toán": "#F59E0B",
  "Đã hủy": "#EF4444",
};

function getStatusColor(status: string, colorWeb?: string): string {
  if (colorWeb) return colorWeb;
  return statusColorMap[status] || Colors.accent.blue;
}

const DepositCard = React.memo(
  ({ item, onPress }: { item: Deposit; onPress: () => void }) => {
    const sColor = getStatusColor(item.trangThai, item.colorTT);

    return (
      <TouchableOpacity
        style={styles.contractCard}
        activeOpacity={0.65}
        testID={`deposit-card-${item.maDC}`}
        onPress={onPress}
      >
        <View style={[styles.statusIndicator, { backgroundColor: sColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.rowTop}>
            <View style={styles.rowTopLeft}>
              <Text style={styles.contractNumber} numberOfLines={1}>
                {item.soPhieu || "—"}
              </Text>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.tenKH || "—"}
              </Text>
            </View>
            {item.trangThai ? (
              <View
                style={[styles.statusChip, { backgroundColor: `${sColor}18` }]}
              >
                <View style={[styles.statusDot, { backgroundColor: sColor }]} />
                <Text style={[styles.statusLabel, { color: sColor }]}>
                  {item.trangThai}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 2 }}>
            <View style={styles.metaRow}>
              <Hash color={Colors.primary} size={11} />
              <Text
                style={[
                  styles.metaText,
                  { color: Colors.primary, fontWeight: "600" as const },
                ]}
              >
                {item.maSP || "—"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Calendar color={Colors.textTertiary} size={11} />
              <Text style={styles.metaText}>
                {formatDate(item.ngayDatCoc) || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.rowBottom}>
            <View style={styles.metaRow}>
              <Building2 color={Colors.textTertiary} size={11} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.tenDA || "—"}
              </Text>
            </View>

            <View style={{ flex: 1 }} />
            <Text style={styles.priceValue}>
              {formatCurrency(item.soTienCoc)}
            </Text>
            <ChevronRight color={Colors.textLight} size={16} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

export default function DepositsScreen() {
  const router = useRouter();
  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [deposits] = useState<Deposit[]>(DEMO_DEPOSITS);
  // const [loading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const filterHeight = useRef(new Animated.Value(0)).current;
  const [duAn, setDuAn] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [trangThai, setTrangThai] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<any>(0);

  const statusList = useMemo(
    () => [
      { id: "all", title: "Tất cả", color: Colors.primary },
      { id: "Đã thanh toán", title: "Đã thanh toán", color: "#10B981" },
      { id: "Chờ thanh toán", title: "Chờ thanh toán", color: "#F59E0B" },
      { id: "Đã hủy", title: "Đã hủy", color: "#EF4444" },
    ],
    []
  );

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    MaTT: 0,
    inputSearch: "",
    Offset: 1,
    Limit: 20,
    MaKhu: 0,
  });

  const loadDataInit = async () => {
    let res = await ProjectService.getProjects({});
    setDuAn(res?.data ?? []);

    let resTT = await DatCocService.getTT({ Type: 2 });
    setTrangThai(resTT?.data);
  };

  const normalizeColor = (color?: string) => {
    if (!color) return "#FACC15";

    const c = color.toUpperCase();

    if (c === "#FFFF00") return "#FACC15";

    return color;
  };
  const loadData = async (filter, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let res = await DatCocService.get(filter);

      setTotalRows(res?.totalRows || 0);

      const mapped = res?.data?.map((item) => ({
        ...item,
        maDC: item.MaPDC?.toString() || "",
        soPhieu: item.SoPhieu || "",
        ngayDatCoc: item.NgayDatCoc
          ? new Date(item.NgayDatCoc).toISOString().slice(0, 10)
          : "",
        tenKH: item.KhachHang || "",
        maSP: item.MaSanPham || "",
        soTienCoc: item.TienCoc || 0,
        trangThai: item.TenTT || "",
        tenDA: item.TenDA || "",
        colorTT: normalizeColor(item.MauNen),
      }));

      setData((prev) => (isLoadMore ? [...prev, ...mapped] : mapped));
    } catch (err) {
      console.log("loadData error", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (loadingMore) return;

    // đủ data rồi thì dừng
    if (data.length >= totalRows) return;

    const nextPage = page + 1;
    setPage(nextPage);

    const newFilter = {
      ...filterCondition,
      Offset: nextPage,
    };

    setFilterCondition(newFilter);
    loadData(newFilter, true);
  };

  useEffect(() => {
    loadDataInit();
    // loadData(filterCondition);
  }, []);

  const toggleFilters = useCallback(() => {
    const toValue = showFilters ? 0 : 1;
    setShowFilters(!showFilters);
    Animated.timing(filterHeight, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [showFilters, filterHeight]);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      setPage(1);
      setData([]);

      const newFilter = {
        ...filterCondition,
        inputSearch: searchQuery,
        Offset: 1,
      };

      setFilterCondition(newFilter);
      loadData(newFilter);
    }, 500);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);
  // const filteredDeposits = useMemo(() => {
  //   let result = deposits;
  //   if (searchQuery.trim()) {
  //     const q = searchQuery.toLowerCase().trim();
  //     result = result.filter(
  //       (d) =>
  //         d.tenKH.toLowerCase().includes(q) ||
  //         d.soPhieu.toLowerCase().includes(q) ||
  //         d.maSP.toLowerCase().includes(q) ||
  //         d.tenDA.toLowerCase().includes(q)
  //     );
  //   }
  //   if (selectedStatus !== "all") {
  //     result = result.filter((d) => d.trangThai === selectedStatus);
  //   }
  //   return result;
  // }, [deposits, searchQuery, selectedStatus]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const hasActiveFilters = selectedStatus !== "all";

  const clearFilters = useCallback(() => {
    setSelectedStatus(0);
    setShowFilters(false);
    Animated.timing(filterHeight, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [filterHeight]);

  const handleDepositPress = useCallback(
    (item: Deposit) => {
      router.push({
        pathname: "/deposit/[id]",
        params: {
          id: item.maDC,
          data: JSON.stringify(item),
        },
      });
    },
    [router]
  );

  const renderDeposit = useCallback(
    ({ item }: { item: Deposit }) => (
      <DepositCard item={item} onPress={() => handleDepositPress(item)} />
    ),
    [handleDepositPress]
  );

  const keyExtractor = useCallback(
    (item: Deposit, index: number) => item.maDC || index.toString(),
    []
  );

  // const ListEmptyComponent = useMemo(
  //   () => (
  //     <View style={styles.emptyWrap}>
  //       <View style={styles.emptyIconCircle}>
  //         <Landmark color={Colors.textTertiary} size={36} />
  //       </View>
  //       <Text style={styles.emptyTitle}>
  //         {searchQuery.trim()
  //           ? "Không tìm thấy phiếu đặt cọc"
  //           : "Chưa có phiếu đặt cọc"}
  //       </Text>
  //       <Text style={styles.emptyDesc}>
  //         {searchQuery.trim()
  //           ? "Thử tìm kiếm với từ khóa khác"
  //           : "Danh sách đặt cọc trống"}
  //       </Text>
  //     </View>
  //   ),
  //   [searchQuery]
  // );

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }

    setFilterCondition((prev) => {
      const newFilter = {
        ...prev,
        DuAn: selectedProjects.length
          ? "," + selectedProjects.join(",") + ","
          : "",
        Offset: 1,
      };
      void loadData(newFilter);
      return newFilter;
    });
  }, [selectedProjects]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }


    setFilterCondition((prev) => {
      const newFilter = {
        ...prev,
        MaTT: selectedStatus,
        Offset: 1,
      };
      void loadData(newFilter);
      return newFilter;
    });
  }, [selectedStatus]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Đặt cọc",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 4 }}
            >
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View
            style={[styles.searchBar, searchFocused && styles.searchBarFocused]}
          >
            <Search
              color={searchFocused ? Colors.primary : Colors.textTertiary}
              size={18}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, SĐT, số phiếu..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              testID="search-deposits-input"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.clearSearchBtn}>
                  <X color={Colors.white} size={12} />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              hasActiveFilters && styles.filterBtnActive,
            ]}
            onPress={toggleFilters}
            activeOpacity={0.7}
          >
            <SlidersHorizontal
              color={hasActiveFilters ? Colors.white : Colors.textSecondary}
              size={18}
            />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>DỰ ÁN</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChips}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedProjects.length === 0 && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedProjects([])}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedProjects.length === 0 &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {duAn.map((project: any) => {
                  const active = selectedProjects.includes(project.MaDA);
                  return (
                    <TouchableOpacity
                      key={project.MaDA}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                      onPress={() => {
                        if (active) {
                          setSelectedProjects((prev) =>
                            prev.filter((id) => id !== project.MaDA)
                          );
                        } else {
                          setSelectedProjects((prev) => [
                            ...prev,
                            project.MaDA,
                          ]);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {project.TenDA}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>TRẠNG THÁI</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChips}
              >
                <TouchableOpacity
                  key={0}
                  style={[
                    styles.filterChip,
                    selectedStatus === 0 && {
                      backgroundColor: Colors.primary,
                      borderColor: Colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedStatus(0)}
                >
                  {selectedStatus === 0 && (
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: Colors.white },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedStatus === 0 && styles.filterChipTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {trangThai.map((status) => {
                  const active = selectedStatus === status.MaTT;
                  const chipColor = normalizeColor(status.ColorWeb);

                  return (
                    <TouchableOpacity
                      key={status.MaTT}
                      style={[
                        styles.filterChip,
                        active && {
                          backgroundColor: chipColor,
                          borderColor: chipColor,
                        },
                      ]}
                      onPress={() => setSelectedStatus(status.MaTT)}
                    >
                      {active && (
                        <View
                          style={[
                            styles.chipDot,
                            { backgroundColor: Colors.white },
                          ]}
                        />
                      )}
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {status.TenTT}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={clearFilters}
              >
                <X color={Colors.error} size={14} />
                <Text style={styles.clearFilterText}>Xóa bộ lọc</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderDeposit}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // ListEmptyComponent={ListEmptyComponent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 10 }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F3F7",
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 8px rgba(0,0,0,0.06)" },
    }),
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F3F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  searchBarFocused: {
    borderColor: Colors.primary,
    backgroundColor: "#FFF8F4",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F2F3F7",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  filtersPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  filterGroup: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textTertiary,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  filterChips: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F1F3",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: "600" as const,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.error,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  contractCard: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 6px rgba(0,0,0,0.05)" },
    }),
  },
  statusIndicator: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rowTopLeft: {
    flex: 1,
    marginRight: 8,
  },
  contractNumber: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  customerName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.accent.green,
    letterSpacing: -0.3,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(232,111,37,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
