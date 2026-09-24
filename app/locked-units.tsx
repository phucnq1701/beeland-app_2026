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
  Timer,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react-native";

import Colors from "@/constants/colors";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { BookingService } from "@/sevicesSupabase/BookingService";

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

export default function LockedUnitsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [duAn, setDuAn] = useState<any[]>([]);
  const [dataLook, setDataLook] = useState<any[]>([]);

  const [showFilter, setShowFilter] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "expired">("all");

  const [limit, setLimit] = useState(50);

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
    // Quét lock hết hạn lúc vào màn (theo web sweepExpiredLocks)
    void BookingService.sweepExpiredLocks();
  }, []);

  const fetchLockList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await BookingService.listProductLocks({
        maDA: selectedProjects,
        keyword: searchInput,
        limit,
      });

      const list = res?.data || [];
      setDataLook(list);
    } catch (error) {
      console.log("listProductLocks error", error);
    } finally {
      setLoading(false);
    }
  }, [selectedProjects, searchInput, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLockList();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchLockList]);

  const loadMore = () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    setLimit((prev) => prev + 50);
    setLoadingMore(false);
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
          headerShown: true,
          title: "Lock căn",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        onMomentumScrollEnd={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const isEnd =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 20;
          if (isEnd) loadMore();
        }}
      >
        {/* Search & Filter */}
        <View style={styles.searchAndFilterRow}>
          <View style={styles.searchContainer}>
            <Search color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm mã căn, dự án..."
              placeholderTextColor={Colors.textSecondary}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
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
            activeOpacity={0.7}
          >
            <Filter color={Colors.primary} size={18} />
            <Text style={styles.filterText}>Bộ lọc</Text>
            {showFilter ? (
              <ChevronUp color={Colors.primary} size={18} />
            ) : (
              <ChevronDown color={Colors.primary} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {/* Filters Panel */}
        {showFilter && (
          <View style={styles.filterPanel}>
            <View style={styles.filterSectionHeader}>
              <Text style={styles.filterSectionTitle}>Lọc theo dự án</Text>
              {selectedProjects.length > 0 && (
                <TouchableOpacity
                  style={styles.resetFilterButton}
                  onPress={() => setSelectedProjects([])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetFilterText}>Đặt lại</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.filterOptionsGrid}>
              {duAn.map((project) => {
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
                          prev.filter((pid) => pid !== project.MaDA)
                        );
                      } else {
                        setSelectedProjects((prev) => [...prev, project.MaDA]);
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
        )}

        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScrollContent}
          style={styles.statsScroll}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[
                  styles.statCard,
                  { backgroundColor: tab.color },
                  isActive && styles.statCardSelected,
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.statValue}>{tab.count}</Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <>
            {filteredData.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Lock color={Colors.textSecondary} size={36} />
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
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/locked/[id]",
                      params: { id: item.id, maSP: item?.maSP },
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View
                        style={[styles.iconCircle, { backgroundColor: config.bg }]}
                      >
                        <StatusIcon size={16} color={config.color} />
                      </View>
                      <View>
                        <Text style={styles.productCode}>{item.kyHieu}</Text>
                        <View style={styles.projectRow}>
                          <MapPin size={12} color={Colors.textTertiary} />
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
                          {
                            backgroundColor: config.bg,
                            borderColor: config.borderColor,
                          },
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
                          <Text
                            style={[
                              styles.progressLabelText,
                              { color: config.color, fontWeight: "600" as const },
                            ]}
                          >
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
          </>
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
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" as any } }),
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
  statsScroll: {
    marginBottom: 16,
  },
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
  unitCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden" as const,
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
    color: Colors.textTertiary,
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
    color: Colors.textTertiary,
    fontWeight: "500" as const,
    marginBottom: 3,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
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
    color: Colors.textTertiary,
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
    borderTopColor: Colors.border,
  },
  viewDetail: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
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
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
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
    color: Colors.textSecondary,
    fontSize: 13,
  },
});