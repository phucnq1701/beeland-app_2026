import React, { useState, useEffect } from "react";
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
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, Filter, X } from "lucide-react-native";

import Colors from "@/constants/colors";
import { ProjectService } from "./sevices/ProjectService";
import { BookingService } from "./sevices/BookingService";

export default function LockedUnitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [duAn, setDuAn] = useState<any[]>([]);
  const [dataLook, setDataLook] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const [showFilter, setShowFilter] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    inputSearch: "",
    Offset: 1,
    Limit: 10,
  });

  /**
   * LOAD PROJECTS
   */
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await ProjectService.getProjects({});
        setDuAn(res?.data || []);
      } catch (error) {
        console.log("load project error", error);
      }
    };

    loadProjects();
  }, []);

  /**
   * SEARCH DEBOUNCE
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterCondition((prev) => ({
        ...prev,
        inputSearch: searchInput,
        Offset: 1,
        Limit: 10,
      }));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  /**
   * PROJECT FILTER
   */
  useEffect(() => {
    setFilterCondition((prev) => ({
      ...prev,
      DuAn: selectedProjects.length
        ? "," + selectedProjects.join(",") + ","
        : "",
      Offset: 1,
      Limit: 10,
    }));
  }, [selectedProjects]);

  /**
   * CALL API WHEN FILTER CHANGES
   */
  useEffect(() => {
    fetchLockList(false);
  }, [filterCondition.DuAn, filterCondition.inputSearch]);

  /**
   * API CALL
   */
  const fetchLockList = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const res = await BookingService.getLockList(filterCondition);

      const list = res?.data || [];
      console.log(list, "hhhhhhhh");

      setTotalRows(list?.[0]?.totalRows || 0);

      if (isLoadMore) {
        setDataLook((prev) => [...prev, ...list]);
      } else {
        setDataLook(list);
      }
    } catch (error) {
      console.log("getLockList error", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /**
   * LOAD MORE
   */
  const loadMore = () => {
    if (loadingMore || loading) return;

    if (dataLook.length >= totalRows) return;

    const newLimit = filterCondition.Limit + 10;

    setFilterCondition((prev) => ({
      ...prev,
      Limit: newLimit,
    }));

    fetchLockList(true);
  };

  /**
   * FORMAT TIME
   */
  const formatLockTime = (dateStr: string) => {
    const d = new Date(dateStr);

    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    return `${h}:${m} - ${day}/${month}/${year}`;
  };

  const formatRemaining = (minutes: number) => {
    if (minutes <= 0) return "Đã hết hạn";

    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h ${m}m`;
    }

    return `${minutes} phút`;
  };

  const getStatusColor = (progress: number) => {
    if (progress > 0.5) return "#10B981";
    if (progress > 0.25) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Căn đã lock",
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color={Colors.textSecondary} size={20} />

          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm mã căn..."
            placeholderTextColor={Colors.textSecondary}
            value={searchInput}
            onChangeText={setSearchInput}
          />

          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput("")}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedProjects.length > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilter(!showFilter)}
        >
          <Filter
            size={20}
            color={selectedProjects.length > 0 ? Colors.white : Colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* FILTER */}
      {showFilter && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Dự án</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {duAn.map((project) => {
              const active = selectedProjects.includes(project.MaDA);

              return (
                <TouchableOpacity
                  key={project.MaDA}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => {
                    if (active) {
                      setSelectedProjects((prev) =>
                        prev.filter((id) => id !== project.MaDA)
                      );
                    } else {
                      setSelectedProjects((prev) => [...prev, project.MaDA]);
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
      )}

      {/* LIST */}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          onMomentumScrollEnd={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } =
              e.nativeEvent;

            const isEnd =
              layoutMeasurement.height + contentOffset.y >=
              contentSize.height - 20;

            if (isEnd) loadMore();
          }}
        >
          <Text style={styles.resultText}>
            {loading ? "Đang tải..." : `${dataLook.length}/${totalRows} căn`}
          </Text>

          {dataLook.map((item: any) => {
            const remainingMinutes = item.thoiGianConLai || 0;
            const lockDuration = item.thoiGianLock || 30;

            const progress = remainingMinutes / lockDuration;

            const isActive = remainingMinutes > 0;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.unitCard}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: "/locked/[id]",
                    params: { id: item.id, maSP: item?.maSP },
                  })
                }
              >
                <View style={styles.unitHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectName}>{item.tenDA}</Text>
                    <Text style={styles.productCode}>{item.kyHieu}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isActive
                          ? getStatusColor(progress)
                          : "#6B7280",
                      },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {isActive ? "Còn hạn" : "Hết hạn"}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Thời gian lock</Text>
                  <Text style={styles.detailValue}>
                    {formatLockTime(item.ngayLock)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Thời gian còn lại</Text>
                  <Text
                    style={[
                      styles.remainingTime,
                      {
                        color: isActive ? getStatusColor(progress) : "#6B7280",
                      },
                    ]}
                  >
                    {formatRemaining(remainingMinutes)}
                  </Text>
                </View>

                {isActive && (
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${progress * 100}%`,
                          backgroundColor: getStatusColor(progress),
                        },
                      ]}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {loadingMore && (
            <Text style={{ textAlign: "center", padding: 20 }}>
              Đang tải thêm...
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },

  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },

  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  filterButtonActive: {
    backgroundColor: Colors.primary,
  },

  filterContainer: {
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },

  filterTitle: {
    paddingHorizontal: 24,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 10,
  },

  filterScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },

  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },

  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },

  filterChipTextActive: {
    color: Colors.white,
  },

  content: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  resultText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontWeight: "500",
  },

  unitCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },

  projectName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },

  productCode: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 6,
  },

  unitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    height: 30,
  },

  statusBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  detailLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },

  detailValue: {
    fontSize: 15,
    fontWeight: "600",
  },

  remainingTime: {
    fontSize: 18,
    fontWeight: "800",
  },

  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    marginTop: 14,
  },

  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
});
