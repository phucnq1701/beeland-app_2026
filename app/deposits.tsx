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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  Landmark,
  Calendar,
  X,
  ChevronRight,
  Building2,
  Hash,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { Deposit } from "@/mocks/deposits";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { DatCocService } from "@/sevicesSupabase/DatCocService";

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
  "Đã thanh toán": "#10B981",
  "Chờ thanh toán": "#F59E0B",
  "Đã hủy": "#EF4444",
};

function getStatusColor(status: string, colorWeb?: string): string {
  if (colorWeb) return colorWeb;
  return statusColorMap[status] || Colors.accent.blue;
}

/** Làm tối màu chữ theo màu nền để dễ đọc (nền lấy chuẩn từ data) */
function darkenColor(color: string, factor = 0.62): string {
  try {
    let hex = String(color || "").trim();
    if (!hex.startsWith("#")) return color;
    hex = hex.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6) return color;
    const toHex = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0");
    const r = parseInt(hex.slice(0, 2), 16) * factor;
    const g = parseInt(hex.slice(2, 4), 16) * factor;
    const b = parseInt(hex.slice(4, 6), 16) * factor;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return color;
  }
}

function normalizeColor(color?: string) {
  if (!color) return "#FACC15";

  const c = color.toUpperCase();

  if (c === "#FFFF00") return "#FACC15";

  return color;
}

/** Bỏ dấu tiếng Việt + lower-case để so khớp tên trạng thái ổn định */
function normalizeVN(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Trong màn Đặt cọc chỉ hiển thị 2 trạng thái trên bộ lọc:
 *  - "Đặt cọc chờ duyệt"
 *  - "Đặt cọc đã duyệt"
 * Các trạng thái còn lại bị ẩn (luồng lọc giữ nguyên — vẫn truyền MaTT như cũ).
 */
function isVisibleDepositStatus(name: string): boolean {
  const n = normalizeVN(name);
  if (!n.includes("dat coc")) return false;
  return n.includes("cho duyet") || n.includes("da duyet");
}

const DepositCard = React.memo(
  ({ item, onPress }: { item: Deposit; onPress: () => void }) => {
    const sColor = getStatusColor(item.trangThai, item.colorTT);
    const sText = darkenColor(sColor);

    return (
      <TouchableOpacity
        style={styles.contractCard}
        activeOpacity={0.7}
        testID={`deposit-card-${item.maDC}`}
        onPress={onPress}
      >
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
                style={[
                  styles.statusChip,
                  { backgroundColor: `${sColor}18` },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: sColor }]} />
                <Text style={[styles.statusLabel, { color: sText }]}>
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
            <ChevronRight color={Colors.textTertiary} size={16} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);
DepositCard.displayName = "DepositCard";

export default function DepositsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();
  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [duAn, setDuAn] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [trangThai, setTrangThai] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<any>(0);

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

  const loadData = async (filter: any, isLoadMore = false) => {
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

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const hasActiveFilters =
    selectedProjects.length > 0 || selectedStatus !== 0;

  const clearFilters = () => {
    setSelectedProjects([]);
    setSelectedStatus(0);
    setSearchQuery("");
    setPage(1);
    setData([]);
    setShowFilters(false);
    const newFilter = {
      TuNgay: "2000-01-01",
      DenNgay: "2100-01-01",
      DuAn: "",
      MaTT: 0,
      inputSearch: "",
      Offset: 1,
      Limit: 20,
      MaKhu: 0,
    };
    setFilterCondition(newFilter);
    void loadData(newFilter);
  };

  const handleDepositPress = useCallback(
    (item: Deposit) => {
      console.log(item?.maDC,'item');

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

  // Chỉ hiển thị 2 trạng thái: Đặt cọc chờ duyệt / Đặt cọc đã duyệt
  const statusOptions = useMemo(
    () =>
      (trangThai ?? []).filter((status: any) =>
        isVisibleDepositStatus(status?.TenTT)
      ),
    [trangThai]
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Landmark color={Colors.textSecondary} size={36} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery.trim()
            ? "Không tìm thấy phiếu đặt cọc"
            : "Chưa có phiếu đặt cọc"}
        </Text>
        <Text style={styles.emptySubtext}>
          {searchQuery.trim()
            ? "Thử tìm kiếm với từ khóa khác"
            : "Danh sách đặt cọc trống"}
        </Text>
      </View>
    ),
    [searchQuery]
  );

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
              placeholder="Tìm theo tên, SĐT, số phiếu..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="search-deposits-input"
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
          <ScrollView
            style={[styles.filterPanel, styles.filterPanelScroll]}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.filterSection}>
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
            </View>

            <View style={[styles.filterSection, { marginBottom: 0 }]}>
              <Text style={styles.filterSectionTitle}>Trạng thái</Text>
              <View style={styles.filterOptionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    selectedStatus === 0 && styles.filterOptionActive,
                  ]}
                  onPress={() => setSelectedStatus(0)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedStatus === 0 && styles.filterOptionTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {statusOptions.map((status: any) => {
                  const active = selectedStatus === status.MaTT;
                  return (
                    <TouchableOpacity
                      key={status.MaTT}
                      style={[
                        styles.filterOption,
                        active && styles.filterOptionActive,
                      ]}
                      onPress={() => setSelectedStatus(status.MaTT)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          active && styles.filterOptionTextActive,
                        ]}
                      >
                        {status.TenTT}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
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
  filterPanelScroll: {
    maxHeight: 380,
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
    paddingHorizontal: 16,
    paddingVertical: 20,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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