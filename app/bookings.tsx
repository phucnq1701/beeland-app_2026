import React, { useState, useMemo, useEffect, useRef } from "react";
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
import {
  Search,
  Filter,
  X,
  ChevronRight,
  Calendar,
  Sparkles,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Colors from "@/constants/colors";
import { bookings, BookingStatus, BookingPriority } from "@/mocks/bookings";
import { featuredProperties } from "@/mocks/properties";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { FilterService } from "@/sevicesSupabase/FilterService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

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

export default function BookingsScreen() {
  const router = useRouter();

  const searchTimeout = useRef<any>(null);
  const firstLoad = useRef(true);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<BookingStatus | "all">(
    "all"
  );

  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const [statusList, setStatusList] = useState<any[]>([]);
  const [duAn, setDuAn] = useState<any[]>([]);

  const [data, setData] = useState<any[]>([]);
  const [dataAll, setDataAll] = useState<any[]>([]);

  const [selectTT, setSelectTT] = useState<any>("");

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    MaTT: 0,
    MaKhu: 0,
    inputSearch: "",
    Offset: 1,
    Limit: 50,
  });

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

      // Danh sách booking — cloud
      const res = await BookingService.listBookings({
        maDA: [],
        keyword: "",
        pageSize: 50,
        pageIndex: 1,
      });
      const clean = dedupeBookings(res?.data ?? []);
      setData(clean);
      setDataAll(clean);
    } catch (err) {
      console.log("loadData error", err);
    }

    setLoading(false);
  };

  const loadData2 = async (_filter: any) => {
    setLoading(true);
    try {
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
        pageSize: _filter?.Limit ?? 50,
        pageIndex: _filter?.Offset ?? 1,
      });

      const clean = dedupeBookings(res?.data ?? []);
      setData(clean);
      setDataAll(clean);
    } catch (err) {
      console.log("loadData2 error", err);
    }
    setLoading(false);
  };

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    loadData();
  }, []);

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

    if (trangThai === "Tất cả") {
      setData(dataAll);
    } else {
      const filtered = dataAll?.filter((item) => item?.tenTT === trangThai);
      setData(filtered);
    }
  };

  /* ---------------- CLEAR FILTER ---------------- */

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedProjects([]);
    setSelectedStatus("all");
    setShowFilters(false);
  };

  const hasActiveFilters =
    selectedProjects.length > 0 || selectedStatus !== "all";

  const statusLabels: Record<BookingStatus | "all", string> = {
    all: "Tất cả",
    waiting: "Chờ thanh toán",
    paid: "Đã thanh toán",
    expired: "Hết hạn",
  };

  const statusColors: Record<any, string> = {
    "Chờ duyệt": "#F59E0B",
    "Đã duyệt": "#10B981",
    "Hủy booking": "#EF4444",
  };

  const statusBgColors: Record<BookingStatus, string> = {
    waiting: "rgba(245, 158, 11, 0.2)",
    paid: "rgba(16, 185, 129, 0.2)",
    expired: "rgba(239, 68, 68, 0.2)",
  };

  const priorityColors: Record<any, string> = {
    "Chờ duyệt": "#FCA5A5",
    "Đã duyệt": "#FDBA74",
    "Huỷ booking": "#93C5FD",
  };

  const priorityBgColors: Record<any, string> = {
    "Chờ duyệt": "rgba(252, 165, 165, 0.2)",
    "Đã duyệt": "rgba(253, 186, 116, 0.2)",
    "Huỷ booking": "rgba(147, 197, 253, 0.2)",
  };
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "",
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerTransparent: true,
        }}
      />

      {/* Background */}
      <LinearGradient
        colors={Colors.gradients.background}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetingRow}>
            <Sparkles size={14} color={Colors.accent.purple} />
            <Text style={styles.greeting}>Quản lý</Text>
          </View>
          <Text style={styles.headerTitle}>Booking</Text>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchSection}>
          <BlurView intensity={30} tint="dark" style={styles.searchContainer}>
            <Search color={Colors.textTertiary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm booking, khách hàng..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== "" && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X color={Colors.textTertiary} size={20} />
              </TouchableOpacity>
            )}
          </BlurView>

          <TouchableOpacity
            style={[
              styles.filterButton,
              hasActiveFilters && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <BlurView
              intensity={hasActiveFilters ? 0 : 30}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            {hasActiveFilters && (
              <LinearGradient
                colors={Colors.gradients.primary}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Filter
              color={hasActiveFilters ? Colors.white : Colors.text}
              size={20}
            />
          </TouchableOpacity>
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <BlurView intensity={40} tint="dark" style={styles.filtersPanel}>
            <LinearGradient
              colors={["rgba(255,255,255,0.05)", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Dự án</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterOptions}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedProjects.length === 0 && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedProjects([]);
                  }}
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

                {duAn.map((project) => {
                  const active = selectedProjects.includes(project.MaDA);

                  return (
                    <TouchableOpacity
                      key={project.MaDA}
                      style={[
                        styles.filterChip,
                        active ? styles.filterChipActive : null,
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
                          active ? styles.filterChipTextActive : null,
                        ]}
                      >
                        {project.TenDA}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Trạng thái</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterOptions}
              >
                <View style={styles.filterOptions}>
                  {statusList.map((status) => (
                    <TouchableOpacity
                      key={status?.id}
                      style={[
                        styles.filterChip,
                        filterCondition?.MaTT === status?.id &&
                          styles.filterChipActive,
                      ]}
                      onPress={() => {
                        applyChangeFilter("TrangThai", status?.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          filterCondition?.MaTT === status?.id &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {status?.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Xóa bộ lọc</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        )}

        {/* Stats Row - Clickable Status Tabs */}
        {/* <View style={styles.statsContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.statCardWrapper,
              selectedStatus === "all" && styles.statCardSelected,
            ]}
            onPress={() => setSelectedStatus("all")}
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={
                  selectedStatus === "all"
                    ? ["rgba(139, 92, 246, 0.45)", "rgba(139, 92, 246, 0.2)"]
                    : ["rgba(139, 92, 246, 0.3)", "rgba(139, 92, 246, 0.1)"]
                }
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Tất cả</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.statCardWrapper,
              selectedStatus === "waiting" && styles.statCardSelected,
            ]}
            onPress={() =>
              setSelectedStatus(
                selectedStatus === "waiting" ? "all" : "waiting"
              )
            }
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={
                  selectedStatus === "waiting"
                    ? ["rgba(245, 158, 11, 0.45)", "rgba(245, 158, 11, 0.2)"]
                    : ["rgba(245, 158, 11, 0.3)", "rgba(245, 158, 11, 0.1)"]
                }
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.statValue, { color: Colors.iconYellow }]}>
                {stats.waiting}
              </Text>
              <Text style={styles.statLabel}>Chờ TT</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.statCardWrapper,
              selectedStatus === "paid" && styles.statCardSelected,
            ]}
            onPress={() =>
              setSelectedStatus(selectedStatus === "paid" ? "all" : "paid")
            }
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={
                  selectedStatus === "paid"
                    ? ["rgba(16, 185, 129, 0.45)", "rgba(16, 185, 129, 0.2)"]
                    : ["rgba(16, 185, 129, 0.3)", "rgba(16, 185, 129, 0.1)"]
                }
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.statValue, { color: Colors.iconGreen }]}>
                {stats.paid}
              </Text>
              <Text style={styles.statLabel}>Đã TT</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.statCardWrapper,
              selectedStatus === "expired" && styles.statCardSelected,
            ]}
            onPress={() =>
              setSelectedStatus(
                selectedStatus === "expired" ? "all" : "expired"
              )
            }
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={
                  selectedStatus === "expired"
                    ? ["rgba(239, 68, 68, 0.45)", "rgba(239, 68, 68, 0.2)"]
                    : ["rgba(239, 68, 68, 0.3)", "rgba(239, 68, 68, 0.1)"]
                }
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.statValue, { color: Colors.error }]}>
                {stats.expired}
              </Text>
              <Text style={styles.statLabel}>Hết hạn</Text>
            </BlurView>
          </TouchableOpacity>
        </View> */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScrollContent}
          style={styles.statsScroll}
        >
          {statusList.map((status) => {
            const active = selectTT === status.title;

            return (
              <TouchableOpacity
                key={status.id}
                activeOpacity={0.7}
                style={[
                  styles.statCardWrapper,
                  active && styles.statCardSelected,
                ]}
                onPress={() => handleTT(status?.title)}
              >
                <BlurView intensity={30} tint="dark" style={styles.statCard}>
                  <LinearGradient
                    colors={
                      active
                        ? [`${status.ColorWeb}80`, `${status.ColorWeb}40`]
                        : [`${status.ColorWeb}60`, `${status.ColorWeb}20`]
                    }
                    style={StyleSheet.absoluteFill}
                  />

                  <Text style={[styles.statValue, { color: status.ColorWeb }]}>
                    {status.id === 0
                      ? dataAll?.length
                      : dataAll?.filter(
                          (item) => item?.tenTT === status.title
                        )?.length}
                  </Text>

                  <Text style={styles.statLabel} numberOfLines={1}>
                    {status.title}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Active filter indicator */}
        {selectedStatus !== "all" && (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterText}>
              Đang lọc: {statusLabels[selectedStatus]} ({data.length})
            </Text>
            <TouchableOpacity onPress={() => setSelectedStatus("all")}>
              <X color={Colors.textSecondary} size={16} />
            </TouchableOpacity>
          </View>
        )}

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
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={styles.emptyIconContainer}
                >
                  <Calendar color={Colors.textSecondary} size={48} />
                </BlurView>
                <Text style={styles.emptyText}>Không tìm thấy booking nào</Text>
                <Text style={styles.emptySubtext}>
                  Thử thay đổi bộ lọc hoặc tìm kiếm khác
                </Text>
              </View>
            ) : (
              <>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>STT</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Số phiếu</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Khách hàng</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Sản phẩm</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Dự án</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Ngày giữ chỗ</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Trạng thái</Text>
                  </View>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>Tổng tiền</Text>
                  </View>
                </View>

                {data.map((booking, index) => (
                  <TouchableOpacity
                    key={`${booking?.maPGC ?? booking?.id ?? booking?.soPhieu ?? "row"}-${index}`}
                    style={styles.bookingCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: "/booking/[id]",
                        params: { id: booking.maPGC },
                      })
                    }
                  >
                    <BlurView
                      intensity={25}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.08)",
                        "rgba(255,255,255,0.02)",
                      ]}
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.tableRow}>
                      <View style={styles.cell}>
                        <Text style={styles.cellText}>{index + 1}</Text>
                      </View>
                      <View style={styles.cell}>
                        <Text style={styles.cellText}>{booking.soPhieu}</Text>
                      </View>
                      <View style={styles.cell}>
                        <Text style={styles.cellText}>{booking.khachHang}</Text>
                      </View>
                      <View style={styles.cell}>
                        <Text style={styles.cellText}>{booking.maSanPham}</Text>
                      </View>
                      <View style={styles.cell}>
                        <Text style={styles.cellText}>{booking.tenDA}</Text>
                      </View>
                      <View style={styles.cell}>
                        <Text style={styles.cellText}>
                          {new Date(booking.ngayGiuCho).toLocaleDateString(
                            "vi-VN",
                            { day: "2-digit", month: "2-digit", year: "numeric" }
                          )}
                        </Text>
                      </View>
                      <View style={styles.cell}>
                        <BlurView
                          intensity={30}
                          tint="dark"
                          style={[
                            styles.statusBadge,
                            { backgroundColor: priorityBgColors[booking.tenTT] },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              { color: priorityColors[booking.tenTT] },
                            ]}
                          >
                            {booking?.tenTT}
                          </Text>
                        </BlurView>
                      </View>
                      <View style={styles.cell}>
                        <Text style={styles.amount}>
                          {new Intl.NumberFormat("vi-VN").format(
                            Math.round(Number(booking.tongGiaGomVAT) || 0)
                          )}{" "}
                          đ
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
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
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb1: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    top: -50,
    right: -50,
    filter: Platform.OS === "web" ? "blur(60px)" : undefined,
  },
  orb2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(232, 111, 37, 0.1)",
    bottom: 100,
    left: -50,
    filter: Platform.OS === "web" ? "blur(50px)" : undefined,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  searchSection: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterButtonActive: {
    borderColor: Colors.primary,
  },
  filtersPanel: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.glass.light,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  clearButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: Colors.glass.light,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  statsScroll: {
    marginBottom: 20,
  },
  statsScrollContent: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 4,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCardWrapper: {
    width: 110,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  statCardSelected: {
    borderColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statCard: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 16,
    overflow: "hidden",
  },
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 20,
    alignSelf: "center",
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "600",
  },
  listContainer: {
    gap: 10,
  },
  bookingCard: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent.cyan,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: Colors.glass.light,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  headerCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: Colors.glass.border,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: Colors.glass.border,
    paddingHorizontal: 4,
  },
  cellText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.text,
    textAlign: "center",
  },
  amount: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});