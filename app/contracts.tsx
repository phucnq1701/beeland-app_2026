import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  FileText,
  Calendar,
  X,
  ChevronRight,
  Building2,
  Hash,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { HopDongService } from "@/sevicesSupabase/HopDongService";

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
    return bil % 1 === 0 ? `${bil} tỷ` : `${bil.toFixed(1)} tỷ`;
  }
  if (value >= 1000000) {
    const mil = value / 1000000;
    return mil % 1 === 0 ? `${mil} triệu` : `${mil.toFixed(1)} triệu`;
  }
  return new Intl.NumberFormat("vi-VN").format(Math.round(value)) + " đ";
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
  Hủy: "#EF4444",
  "Đang thực hiện": "#3B82F6",
  "Hoàn thành": "#10B981",
  "Thanh lý": "#8B5CF6",
};

function getStatusColor(status: string, colorWeb?: string): string {
  if (colorWeb) return colorWeb;
  return statusColorMap[status] || Colors.accent.blue;
}

const ContractCard = React.memo(
  ({ item, onPress }: { item: Contract; onPress: () => void }) => {
    const sColor = getStatusColor(item.trangThai, item.colorTT);

    return (
      <TouchableOpacity
        style={styles.contractCard}
        activeOpacity={0.7}
        testID={`contract-card-${item.maHD}`}
        onPress={onPress}
      >
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
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: `${sColor}18` },
                ]}
              >
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
              <Text style={styles.metaText} numberOfLines={1}>
                {item.tenDA || "—"}
              </Text>
            </View>
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
                {formatDate(item.ngayKy) || "—"}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={styles.priceValue}>
              {formatCurrency(item.tongGiaTri)}
            </Text>
            <ChevronRight color={Colors.textTertiary} size={16} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);
ContractCard.displayName = "ContractCard";

export default function ContractsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();
  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const [duAn, setDuAn] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    MaTT: 0,
    inputSearch: "",
    Offset: 1,
    Limit: 50,
  });

  const loadInitData = useCallback(async () => {
    try {
      const resDA = await ProjectService.getProjects({});
      setDuAn(resDA?.data ?? []);
    } catch (err) {
      console.log("[Contracts] loadInitData error", err);
    }
  }, []);

  const loadContracts = useCallback(async (filter: any, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await HopDongService.get(filter);

      setTotalRows(res?.totalRows || 0);

      if (res?.data?.length) {
        const mapped: Contract[] = res.data.map((item: any) => ({
          maHD: item.maHDMB?.toString() || "",
          soHopDong: item.soHDMB || "",
          ngayKy: item.ngayKy || "",
          tenKH: item.hoTenKH || "",
          maSP: item.maSP?.toString() || "",
          tongGiaTri: item.tongGiaGomVAT || 0,
          trangThai: item.tenTT || "",
          tenDA: item.tenDA || "",
          colorTT: item.mauNen || "",
        }));

        setContracts((prev) => (isLoadMore ? [...prev, ...mapped] : mapped));
      }
    } catch (err) {
      console.log("[Contracts] loadContracts error", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMore = () => {
    if (loadingMore) return;

    // nếu đã load đủ thì dừng
    if (contracts.length >= totalRows) return;

    const nextPage = page + 1;
    setPage(nextPage);

    const newFilter = {
      ...filterCondition,
      Offset: nextPage,
    };

    setFilterCondition(newFilter);
    loadContracts(newFilter, true);
  };
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
      setPage(1);
      setContracts([]);

      const newFilter = {
        ...filterCondition,
        inputSearch: searchQuery,
        Offset: 1,
      };

      setFilterCondition(newFilter);
      loadContracts(newFilter);
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
        DuAn: selectedProjects.length
          ? "," + selectedProjects.join(",") + ","
          : "",
        Offset: 1,
      };
      void loadContracts(newFilter);
      return newFilter;
    });
  }, [selectedProjects, loadContracts]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const hasActiveFilters = selectedProjects.length > 0;

  const clearFilters = useCallback(() => {
    setSelectedProjects([]);
    setSearchQuery("");
    setPage(1);
    setContracts([]);
    setShowFilters(false);
    const newFilter = {
      TuNgay: "2000-01-01",
      DenNgay: "2100-01-01",
      DuAn: "",
      MaTT: 0,
      inputSearch: "",
      Offset: 1,
      Limit: 50,
    };
    setFilterCondition(newFilter);
    void loadContracts(newFilter);
  }, [loadContracts]);

  const handleContractPress = useCallback(
    (item: Contract) => {
      router.push({
        pathname: "/contract/[id]",
        params: {
          id: item.maHD,
          data: JSON.stringify(item),
        },
      });
    },
    [router]
  );

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
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <FileText color={Colors.textSecondary} size={36} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery.trim() ? "Không tìm thấy hợp đồng" : "Chưa có hợp đồng"}
        </Text>
        <Text style={styles.emptySubtext}>
          {searchQuery.trim()
            ? "Thử tìm kiếm với từ khóa khác"
            : "Danh sách hợp đồng trống"}
        </Text>
      </View>
    ),
    [searchQuery]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Hợp đồng",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
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

      <View style={styles.searchSection}>
        <View style={styles.searchAndFilterRow}>
          <View style={styles.searchContainer}>
            <Search color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, SĐT, số hợp đồng..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="search-contracts-input"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.filterButton,
              hasActiveFilters && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
          >
            <Filter color={Colors.primary} size={18} />
            <Text style={styles.filterText}>Bộ lọc</Text>
            {showFilters ? (
              <ChevronUp color={Colors.primary} size={18} />
            ) : (
              <ChevronDown color={Colors.primary} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={[styles.filterSection, { marginBottom: 0 }]}>
              <View style={styles.filterSectionHeader}>
                <Text style={styles.filterSectionTitle}>Dự án</Text>
                {hasActiveFilters && (
                  <TouchableOpacity
                    style={styles.resetFilterButton}
                    onPress={clearFilters}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.resetFilterText}>Đặt lại</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                <View style={styles.filterOptionsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      selectedProjects.length === 0 &&
                        styles.filterOptionActive,
                    ]}
                    onPress={() => setSelectedProjects([])}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedProjects.length === 0 &&
                          styles.filterOptionTextActive,
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
                          styles.filterOption,
                          active && styles.filterOptionActive,
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
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            active && styles.filterOptionTextActive,
                          ]}
                        >
                          {project.TenDA}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
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
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ marginVertical: 10 }}
                color={Colors.primary}
              />
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
    backgroundColor: Colors.background,
  },
  headerBackButton: {
    marginLeft: 8,
  },
  searchSection: {
    backgroundColor: Colors.background,
    paddingHorizontal: 15,
    paddingTop: 15,
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
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterButtonActive: {
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  filterPanel: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 12,
  },
  resetFilterButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.white,
  },
  filterOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.text,
  },
  filterOptionTextActive: {
    color: Colors.white,
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
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  contractCard: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  cardBody: {
    flex: 1,
    padding: 16,
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
    color: Colors.primary,
    letterSpacing: -0.3,
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
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});