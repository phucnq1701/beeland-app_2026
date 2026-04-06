import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  FileText,
  Calendar,
  X,
  ChevronRight,
  Building2,
  Hash,
  SlidersHorizontal,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevices/CustomerService";
import { FilterService } from "@/sevices/FilterService";
import { ProjectService } from "@/sevices/ProjectService";

interface Contract {
  maHD: string;
  soHopDong: string;
  ngayKy: string;
  tenKH: string;
  maSP: string;
  tongGiaTri: number;
  trangThai: string;
  tenDA: string;
  colorTT: string;
}

function formatCurrency(value: number): string {
  if (!value && value !== 0) return "0";
  if (value >= 1000000000) {
    const bil = value / 1000000000;
    return bil % 1 === 0
      ? `${bil} tỷ`
      : `${bil.toFixed(1)} tỷ`;
  }
  if (value >= 1000000) {
    const mil = value / 1000000;
    return mil % 1 === 0
      ? `${mil} triệu`
      : `${mil.toFixed(1)} triệu`;
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
  "Đã duyệt": "#10B981",
  "Chờ duyệt": "#F59E0B",
  "Hủy": "#EF4444",
  "Đang thực hiện": "#3B82F6",
  "Hoàn thành": "#10B981",
  "Thanh lý": "#8B5CF6",
};

function getStatusColor(status: string, colorWeb?: string): string {
  if (colorWeb) return colorWeb;
  return statusColorMap[status] || Colors.accent.blue;
}

const DEMO_CONTRACTS: Contract[] = [
  {
    maHD: "DEMO-001",
    soHopDong: "HD-2025-001234",
    ngayKy: "2025-03-10",
    tenKH: "Nguyễn Văn An",
    maSP: "A-12-08",
    tongGiaTri: 3250000000,
    trangThai: "Đã duyệt",
    tenDA: "Bee Land Tower",
    colorTT: "#10B981",
  },
  {
    maHD: "DEMO-002",
    soHopDong: "HD-2025-001567",
    ngayKy: "2025-03-15",
    tenKH: "Trần Thị Bích Ngọc",
    maSP: "B-05-02",
    tongGiaTri: 4780000000,
    trangThai: "Chờ duyệt",
    tenDA: "Bee Land Riverside",
    colorTT: "#F59E0B",
  },
];

const ContractCard = React.memo(({ item, onPress }: { item: Contract; onPress: () => void }) => {
  const sColor = getStatusColor(item.trangThai, item.colorTT);

  return (
    <TouchableOpacity
      style={styles.contractCard}
      activeOpacity={0.65}
      testID={`contract-card-${item.maHD}`}
      onPress={onPress}
    >
      <View style={[styles.statusIndicator, { backgroundColor: sColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.rowTop}>
          <View style={styles.rowTopLeft}>
            <Text style={styles.contractNumber} numberOfLines={1}>
              {item.soHopDong || "—"}
            </Text>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.tenKH || "—"}
            </Text>
          </View>
          {item.trangThai ? (
            <View style={[styles.statusChip, { backgroundColor: `${sColor}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: sColor }]} />
              <Text style={[styles.statusLabel, { color: sColor }]}>
                {item.trangThai}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.metaRow}>
            <Building2 color={Colors.textTertiary} size={11} />
            <Text style={styles.metaText} numberOfLines={1}>{item.tenDA || "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Hash color={Colors.primary} size={11} />
            <Text style={[styles.metaText, { color: Colors.primary, fontWeight: "600" as const }]}>{item.maSP || "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Calendar color={Colors.textTertiary} size={11} />
            <Text style={styles.metaText}>{formatDate(item.ngayKy) || "—"}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.priceValue}>{formatCurrency(item.tongGiaTri)}</Text>
          <ChevronRight color={Colors.textLight} size={16} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function ContractsScreen() {
  const router = useRouter();
  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const filterHeight = useRef(new Animated.Value(0)).current;

  const [statusList, setStatusList] = useState<any[]>([]);
  const [duAn, setDuAn] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<number>(0);

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    MaTT: 0,
    inputSearch: "",
    Offset: 1,
    Limit: 100,
  });

  const toggleFilters = useCallback(() => {
    const toValue = showFilters ? 0 : 1;
    setShowFilters(!showFilters);
    Animated.timing(filterHeight, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [showFilters, filterHeight]);

  const loadInitData = useCallback(async () => {
    try {
      const [resTT, resDA] = await Promise.all([
        FilterService.getStatusTransaction({ Type: 2 }),
        ProjectService.getProjects({}),
      ]);

      const arr: any[] = [{ id: 0, title: "Tất cả", ColorWeb: Colors.primary }];
      resTT?.data?.forEach((item: any) => {
        arr.push({
          id: item.MaTT,
          title: item.TenTT,
          ColorWeb: item.ColorWeb || Colors.accent.blue,
        });
      });
      setStatusList(arr);
      setDuAn(resDA?.data ?? []);
    } catch (err) {
      console.log("[Contracts] loadInitData error", err);
    }
  }, []);

  const loadContracts = useCallback(async (filter: any) => {
    setLoading(true);
    try {
      const res = await CustomerService.getAllContracts(filter);
      console.log("[Contracts] Response:", JSON.stringify(res?.data?.length));
      if (res?.data?.length) {
        const mapped: Contract[] = res.data.map((item: any) => ({
          maHD: item.maHD?.toString() || item.id?.toString() || "",
          soHopDong: item.soHopDong || item.soHD || "",
          ngayKy: item.ngayKy || item.ngayHD || "",
          tenKH: item.tenKH || item.tenKhachHang || "",
          maSP: item.maSP || item.maCanHo || item.maCan || "",
          tongGiaTri: item.tongGiaTri || item.giaTriHD || item.giaTri || 0,
          trangThai: item.trangThai || item.tenTT || "",
          tenDA: item.tenDA || item.tenDuAn || "",
          colorTT: item.colorTT || item.ColorWeb || "",
        }));
        setContracts(mapped);
      } else {
        console.log("[Contracts] No data from API, using demo contracts");
        setContracts(DEMO_CONTRACTS);
      }
    } catch (err) {
      console.log("[Contracts] loadContracts error, using demo contracts", err);
      setContracts(DEMO_CONTRACTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitData();
    void loadContracts(filterCondition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setFilterCondition((prev) => {
        const newFilter = { ...prev, inputSearch: searchQuery, Offset: 1 };
        void loadContracts(newFilter);
        return newFilter;
      });
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, loadContracts]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setFilterCondition((prev) => {
      const newFilter = {
        ...prev,
        DuAn: selectedProjects.length ? "," + selectedProjects.join(",") + "," : "",
        Offset: 1,
      };
      void loadContracts(newFilter);
      return newFilter;
    });
  }, [selectedProjects, loadContracts]);

  const handleStatusFilter = useCallback(
    (statusId: number) => {
      setSelectedStatus(statusId);
      setFilterCondition((prev) => {
        const newFilter = { ...prev, MaTT: statusId, Offset: 1 };
        void loadContracts(newFilter);
        return newFilter;
      });
    },
    [loadContracts]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const hasActiveFilters = selectedProjects.length > 0 || selectedStatus !== 0;

  const clearFilters = useCallback(() => {
    setSelectedProjects([]);
    setSelectedStatus(0);
    setShowFilters(false);
    Animated.timing(filterHeight, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    const newFilter = {
      TuNgay: "2000-01-01",
      DenNgay: "2100-01-01",
      DuAn: "",
      MaTT: 0,
      inputSearch: searchQuery,
      Offset: 1,
      Limit: 100,
    };
    setFilterCondition(newFilter);
    void loadContracts(newFilter);
  }, [searchQuery, loadContracts, filterHeight]);

  const handleContractPress = useCallback((item: Contract) => {
    router.push({
      pathname: "/contract/[id]",
      params: {
        id: item.maHD,
        data: JSON.stringify(item),
      },
    });
  }, [router]);

  const renderContract = useCallback(
    ({ item }: { item: Contract }) => (
      <ContractCard item={item} onPress={() => handleContractPress(item)} />
    ),
    [handleContractPress]
  );

  const keyExtractor = useCallback(
    (item: Contract, index: number) => item.maHD || index.toString(),
    []
  );



  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <FileText color={Colors.textTertiary} size={36} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery.trim() ? "Không tìm thấy hợp đồng" : "Chưa có hợp đồng"}
        </Text>
        <Text style={styles.emptyDesc}>
          {searchQuery.trim()
            ? "Thử tìm kiếm với từ khóa khác"
            : "Danh sách hợp đồng trống"}
        </Text>
      </View>
    ),
    [searchQuery]
  );

  const activeFilterCount = (selectedProjects.length > 0 ? 1 : 0) + (selectedStatus !== 0 ? 1 : 0);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Hợp đồng",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              searchFocused && styles.searchBarFocused,
            ]}
          >
            <Search
              color={searchFocused ? Colors.primary : Colors.textTertiary}
              size={18}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, SĐT, số hợp đồng..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              testID="search-contracts-input"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
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
                      selectedProjects.length === 0 && styles.filterChipTextActive,
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
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => {
                        if (active) {
                          setSelectedProjects((prev) => prev.filter((id) => id !== project.MaDA));
                        } else {
                          setSelectedProjects((prev) => [...prev, project.MaDA]);
                        }
                      }}
                    >
                      <Text
                        style={[styles.filterChipText, active && styles.filterChipTextActive]}
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
                {statusList.map((status: any) => {
                  const active = selectedStatus === status.id;
                  const chipColor = status.ColorWeb || Colors.primary;
                  return (
                    <TouchableOpacity
                      key={status.id}
                      style={[
                        styles.filterChip,
                        active && { backgroundColor: chipColor, borderColor: chipColor },
                      ]}
                      onPress={() => handleStatusFilter(status.id)}
                    >
                      {active && <View style={[styles.chipDot, { backgroundColor: Colors.white }]} />}
                      <Text
                        style={[styles.filterChipText, active && styles.filterChipTextActive]}
                      >
                        {status.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={clearFilters}>
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
          data={contracts}
          renderItem={renderContract}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmptyComponent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: Colors.white,
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
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
});
