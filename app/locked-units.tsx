import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  Filter,
  X,
  MapPin,
  Lock,
  Unlock,
  Building2,
  Timer,
  ChevronRight,
  AlertTriangle,
} from "lucide-react-native";

import Colors from "@/constants/colors";
import { ProjectService } from "./sevices/ProjectService";
import { BookingService } from "./sevices/BookingService";

const STATUS_CONFIGS = {
  active: {
    bg: "#EBF8F1",
    color: "#0D9B54",
    borderColor: "#B4E8CD",
    accentBg: "#0D9B54",
    icon: Lock,
    label: "Đang lock",
    emoji: "🔒",
  },
  warning: {
    bg: "#FFF8EB",
    color: "#CC7A00",
    borderColor: "#FFE0A3",
    accentBg: "#CC7A00",
    icon: AlertTriangle,
    label: "Sắp hết hạn",
    emoji: "⚠️",
  },
  expired: {
    bg: "#FFF0F0",
    color: "#D63031",
    borderColor: "#FFBCBC",
    accentBg: "#D63031",
    icon: Unlock,
    label: "Hết hạn",
    emoji: "🔓",
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIGS;

const getStatus = (remainingMinutes: number, lockDuration: number): StatusKey => {
  if (remainingMinutes <= 0) return "expired";
  const progress = remainingMinutes / lockDuration;
  if (progress <= 0.25) return "warning";
  return "active";
};

function AnimatedProgressBar({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, animValue]);

  const width = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={progressStyles.track}>
      <Animated.View
        style={[progressStyles.fill, { width, backgroundColor: color }]}
      />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    height: 5,
    backgroundColor: "#F0F1F3",
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});

function CountdownBadge({ minutes, color }: { minutes: number; color: string }) {
  const formatRemaining = (mins: number) => {
    if (mins <= 0) return "Hết hạn";
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}p`;
    }
    return `${mins} phút`;
  };

  return (
    <View style={[countdownStyles.container, { backgroundColor: color + "18" }]}>
      <Timer size={13} color={color} />
      <Text style={[countdownStyles.text, { color }]}>
        {formatRemaining(minutes)}
      </Text>
    </View>
  );
}

const countdownStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  text: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
});

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
  const [activeTab, setActiveTab] = useState<"all" | "active" | "expired">("all");

  const [filterCondition, setFilterCondition] = useState({
    TuNgay: "2000-01-01",
    DenNgay: "2100-01-01",
    DuAn: "",
    inputSearch: "",
    Offset: 1,
    Limit: 10,
  });

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await ProjectService.getProjects({});
        setDuAn(res?.data || []);
      } catch (error) {
        console.log("load project error", error);
      }
    };

    void loadProjects();
  }, []);

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

  const fetchLockList = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const res = await BookingService.getLockList(filterCondition);

      const list = res?.data || [];
      console.log(list, "lock list data");

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
  }, [filterCondition]);

  useEffect(() => {
    void fetchLockList(false);
  }, [fetchLockList]);

  const loadMore = () => {
    if (loadingMore || loading) return;
    if (dataLook.length >= totalRows) return;

    const newLimit = filterCondition.Limit + 10;

    setFilterCondition((prev) => ({
      ...prev,
      Limit: newLimit,
    }));

    void fetchLockList(true);
  };

  const formatLockTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${h}:${m} - ${day}/${month}/${year}`;
  };

  const filteredData = dataLook.filter((item: any) => {
    const remainingMinutes = item.thoiGianConLai || 0;
    if (activeTab === "active") return remainingMinutes > 0;
    if (activeTab === "expired") return remainingMinutes <= 0;
    return true;
  });

  const activeCount = dataLook.filter((i: any) => (i.thoiGianConLai || 0) > 0).length;
  const expiredCount = dataLook.filter((i: any) => (i.thoiGianConLai || 0) <= 0).length;

  const tabs = [
    { key: "all" as const, label: "Tất cả", count: dataLook.length, color: Colors.primary },
    { key: "active" as const, label: "Đang lock", count: activeCount, color: "#0D9B54" },
    { key: "expired" as const, label: "Hết hạn", count: expiredCount, color: "#D63031" },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Lock căn",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.topSection}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search color="#B0B7C3" size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm mã căn, dự án..."
              placeholderTextColor="#B0B7C3"
              value={searchInput}
              onChangeText={setSearchInput}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => setSearchInput("")}>
                <X color="#B0B7C3" size={18} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedProjects.length > 0 && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilter(!showFilter)}
            activeOpacity={0.7}
          >
            <Filter
              size={18}
              color={selectedProjects.length > 0 ? "#fff" : "#6B7280"}
            />
            {selectedProjects.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {selectedProjects.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {showFilter && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterTitle}>Lọc theo dự án</Text>
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
                          prev.filter((pid) => pid !== project.MaDA)
                        );
                      } else {
                        setSelectedProjects((prev) => [...prev, project.MaDA]);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Building2
                      size={14}
                      color={active ? "#fff" : "#6B7280"}
                    />
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

        <View style={styles.tabContainer}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabCount,
                    isActive && { backgroundColor: tab.color + "18" },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      isActive && { color: tab.color },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
          {filteredData.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Lock color="#D1D5DB" size={36} />
              </View>
              <Text style={styles.emptyTitle}>Không có dữ liệu</Text>
              <Text style={styles.emptySubtitle}>
                Chưa có lock căn nào phù hợp với bộ lọc
              </Text>
            </View>
          )}

          {filteredData.map((item: any, index: number) => {
            const remainingMinutes = item.thoiGianConLai || 0;
            const lockDuration = item.thoiGianLock || 30;
            const progress = Math.min(remainingMinutes / lockDuration, 1);
            const status = getStatus(remainingMinutes, lockDuration);
            const config = STATUS_CONFIGS[status];
            const StatusIcon = config.icon;

            return (
              <TouchableOpacity
                key={item.id || index}
                style={[
                  styles.unitCard,
                  { borderLeftColor: config.accentBg, borderLeftWidth: 4 },
                ]}
                activeOpacity={0.6}
                onPress={() =>
                  router.push({
                    pathname: "/locked/[id]",
                    params: { id: item.id, maSP: item?.maSP },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                      <StatusIcon size={16} color={config.color} />
                    </View>
                    <View>
                      <Text style={styles.productCode}>{item.kyHieu}</Text>
                      <View style={styles.projectRow}>
                        <MapPin size={12} color="#9CA3AF" />
                        <Text style={styles.projectName} numberOfLines={1}>
                          {item.tenDA}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: config.bg, borderColor: config.borderColor },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.timeRow}>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeLabel}>Thời gian lock</Text>
                      <Text style={styles.timeValue}>
                        {formatLockTime(item.ngayLock)}
                      </Text>
                    </View>
                    <CountdownBadge minutes={remainingMinutes} color={config.color} />
                  </View>

                  {remainingMinutes > 0 && (
                    <View style={styles.progressSection}>
                      <AnimatedProgressBar
                        progress={progress}
                        color={config.color}
                      />
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelText}>0%</Text>
                        <Text style={[styles.progressLabelText, { color: config.color, fontWeight: "600" as const }]}>
                          {Math.round(progress * 100)}%
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetail}>Chi tiết</Text>
                  <ChevronRight size={14} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}

          {loadingMore && (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F8",
  },

  topSection: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
    }),
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },

  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F6F8",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" as any } }),
  },

  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F6F8",
    justifyContent: "center",
    alignItems: "center",
  },

  filterButtonActive: {
    backgroundColor: Colors.primary,
  },

  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },

  filterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700" as const,
  },

  filterContainer: {
    paddingBottom: 12,
  },

  filterTitle: {
    paddingHorizontal: 16,
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#9CA3AF",
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },

  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },

  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F5F6F8",
  },

  filterChipActive: {
    backgroundColor: Colors.primary,
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#374151",
  },

  filterChipTextActive: {
    color: "#fff",
  },

  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 14,
    paddingTop: 4,
  },

  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F5F6F8",
  },

  tabActive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E9ED",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
    }),
  },

  tabText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#9CA3AF",
  },

  tabTextActive: {
    color: Colors.text,
    fontWeight: "600" as const,
  },

  tabCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#ECEDF0",
  },

  tabCountText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#9CA3AF",
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  unitCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden" as const,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      web: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
    }),
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 16,
    paddingRight: 16,
    paddingLeft: 14,
  },

  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  cardHeaderRight: {
    alignItems: "flex-end",
  },

  productCode: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },

  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },

  projectName: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500" as const,
    maxWidth: 140,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },

  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  timeItem: {
    flex: 1,
  },

  timeLabel: {
    fontSize: 11,
    color: "#B0B7C3",
    fontWeight: "500" as const,
    marginBottom: 3,
  },

  timeValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#4B5563",
  },

  progressSection: {
    marginTop: 14,
  },

  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },

  progressLabelText: {
    fontSize: 10,
    color: "#C4CAD4",
    fontWeight: "500" as const,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F5F6F8",
  },

  viewDetail: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#9CA3AF",
    fontSize: 14,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#6B7280",
  },

  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },

  loadMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },

  loadMoreText: {
    color: "#9CA3AF",
    fontSize: 13,
  },
});
