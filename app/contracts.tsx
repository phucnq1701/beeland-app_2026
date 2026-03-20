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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  ChevronLeft,
  Search,
  FileText,
  Calendar,
  Package,
  DollarSign,
  X,
  AlertCircle,
  Filter,
  ChevronRight,
  User,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "./sevices/CustomerService";
import { FilterService } from "./sevices/FilterService";
import { ProjectService } from "./sevices/ProjectService";

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

export default function ContractsScreen() {
  const router = useRouter();
  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

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
        setContracts([]);
      }
    } catch (err) {
      console.log("[Contracts] loadContracts error", err);
      setContracts([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [searchQuery, loadContracts]);

  const renderContract = useCallback(
    ({ item, index }: { item: Contract; index: number }) => {
      const sColor = getStatusColor(item.trangThai, item.colorTT);

      return (
        <TouchableOpacity
          style={styles.contractCard}
          activeOpacity={0.7}
          testID={`contract-card-${index}`}
        >
          <View style={styles.cardTopBar}>
            <View style={[styles.cardAccent, { backgroundColor: sColor }]} />
            <View style={styles.cardTopContent}>
              <View style={styles.contractIdRow}>
                <View style={[styles.contractIcon, { backgroundColor: `${sColor}15` }]}>
                  <FileText color={sColor} size={16} />
                </View>
                <View style={styles.contractIdInfo}>
                  <Text style={styles.contractNumber} numberOfLines={1}>
                    {item.soHopDong || "—"}
                  </Text>
                  {item.tenDA ? (
                    <Text style={styles.projectLabel} numberOfLines={1}>
                      {item.tenDA}
                    </Text>
                  ) : null}
                </View>
              </View>
              {item.trangThai ? (
                <View style={[styles.statusBadge, { backgroundColor: `${sColor}15` }]}>
                  <View style={[styles.statusDotSmall, { backgroundColor: sColor }]} />
                  <Text style={[styles.statusText, { color: sColor }]}>
                    {item.trangThai}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.bodyRow}>
              <View style={styles.bodyCell}>
                <View style={styles.bodyCellIcon}>
                  <User color={Colors.textTertiary} size={13} />
                </View>
                <View style={styles.bodyCellContent}>
                  <Text style={styles.bodyCellLabel}>Khách hàng</Text>
                  <Text style={styles.bodyCellValue} numberOfLines={1}>
                    {item.tenKH || "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.bodyCell}>
                <View style={styles.bodyCellIcon}>
                  <Calendar color={Colors.textTertiary} size={13} />
                </View>
                <View style={styles.bodyCellContent}>
                  <Text style={styles.bodyCellLabel}>Ngày ký</Text>
                  <Text style={styles.bodyCellValue}>
                    {formatDate(item.ngayKy) || "—"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.bodyDivider} />

            <View style={styles.bodyRow}>
              <View style={styles.bodyCell}>
                <View style={styles.bodyCellIcon}>
                  <Package color={Colors.textTertiary} size={13} />
                </View>
                <View style={styles.bodyCellContent}>
                  <Text style={styles.bodyCellLabel}>Mã SP</Text>
                  <Text style={[styles.bodyCellValue, { color: Colors.accent.blue, fontWeight: "700" as const }]} numberOfLines={1}>
                    {item.maSP || "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.bodyCell}>
                <View style={styles.bodyCellIcon}>
                  <DollarSign color={Colors.textTertiary} size={13} />
                </View>
                <View style={styles.bodyCellContent}>
                  <Text style={styles.bodyCellLabel}>Tổng giá trị</Text>
                  <Text style={[styles.bodyCellValue, { color: Colors.primary, fontWeight: "700" as const }]}>
                    {formatCurrency(item.tongGiaTri)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <ChevronRight color={Colors.textTertiary} size={16} />
          </View>
        </TouchableOpacity>
      );
    },
    []
  );

  const keyExtractor = useCallback(
    (item: Contract, index: number) => item.maHD || index.toString(),
    []
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <AlertCircle color={Colors.textTertiary} size={40} />
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
                <X color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              hasActiveFilters && styles.filterBtnActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
          >
            <Filter
              color={hasActiveFilters ? Colors.white : Colors.textSecondary}
              size={18}
            />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Dự án</Text>
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
              <Text style={styles.filterLabel}>Trạng thái</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChips}
              >
                {statusList.map((status: any) => {
                  const active = selectedStatus === status.id;
                  return (
                    <TouchableOpacity
                      key={status.id}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => handleStatusFilter(status.id)}
                    >
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

        <View style={styles.resultRow}>
          <Text style={styles.resultCountText}>
            {contracts.length} hợp đồng
          </Text>
          {hasActiveFilters && (
            <View style={styles.activeFilterBadge}>
              <Text style={styles.activeFilterText}>Đang lọc</Text>
            </View>
          )}
        </View>
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
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 6px rgba(0,0,0,0.04)" },
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
    backgroundColor: "#F5F6F8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  searchBarFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#F5F6F8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filtersPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  filterChips: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
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
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.error,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  resultCountText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  activeFilterBadge: {
    backgroundColor: "rgba(232,111,37,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  contractCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
    }),
  },
  cardTopBar: {
    flexDirection: "row",
  },
  cardAccent: {
    width: 4,
  },
  cardTopContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.015)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  contractIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  contractIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  contractIdInfo: {
    flex: 1,
  },
  contractNumber: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  projectLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bodyRow: {
    flexDirection: "row",
    gap: 12,
  },
  bodyCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 6,
  },
  bodyCellIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  bodyCellContent: {
    flex: 1,
  },
  bodyCellLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
    marginBottom: 2,
  },
  bodyCellValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  bodyDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.04)",
    marginVertical: 4,
  },
  cardFooter: {
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 2,
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
    backgroundColor: "rgba(0,0,0,0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
