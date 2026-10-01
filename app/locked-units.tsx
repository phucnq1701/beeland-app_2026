import React, { useState, useEffect, useCallback, memo } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, Clock, Lock, LockOpen, LucideIcon, MapPin } from "lucide-react-native";

import {
  FilterPanel,
  FilterSection,
  FilterToggleButton,
  multiSelectOptions,
} from "@/components/FilterPanel";
import {
  AppHeader,
  Badge,
  BadgeTone,
  Card,
  Chip,
  EmptyState,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { BookingService } from "@/sevicesSupabase/BookingService";

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

const STATUS_CONFIGS: Record<
  "active" | "warning" | "expired",
  { tone: BadgeTone; icon: LucideIcon; label: string; bar: string; subtle: string }
> = {
  active: { tone: "success", icon: Lock, label: "Đang lock", bar: colors.success, subtle: colors.successSubtle },
  warning: { tone: "warning", icon: AlertTriangle, label: "Sắp hết hạn", bar: colors.warning, subtle: colors.warningSubtle },
  expired: { tone: "danger", icon: LockOpen, label: "Hết hạn", bar: colors.danger, subtle: colors.dangerSubtle },
};

type StatusKey = keyof typeof STATUS_CONFIGS;

const getStatus = (remainingMinutes: number, lockDuration: number): StatusKey => {
  if (remainingMinutes <= 0) return "expired";
  const progress = remainingMinutes / lockDuration;
  if (progress <= 0.25) return "warning";
  return "active";
};

const formatRemaining = (mins: number) => {
  if (mins <= 0) return "Hết hạn";
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `Còn ${h} giờ ${m} phút`;
  }
  return `Còn ${mins} phút`;
};

const LockRow = memo(function LockRow({ item, onPress }: { item: any; onPress: (item: any) => void }) {
  const remainingMinutes = item.thoiGianConLai || 0;
  const lockDuration = item.thoiGianLock || 30;
  const progress = Math.min(remainingMinutes / lockDuration, 1);
  const status = getStatus(remainingMinutes, lockDuration);
  const config = STATUS_CONFIGS[status];
  const Icon = config.icon;

  return (
    <Card
      onPress={() => onPress(item)}
      style={styles.card}
      padding={space.lg + 2}
      accessibilityLabel={`Căn ${item.kyHieu ?? ""}, ${config.label}, ${formatRemaining(remainingMinutes)}`}
    >
      <View style={styles.rowHead}>
        <View style={[styles.icon, { backgroundColor: config.subtle }]}>
          <Icon size={20} color={config.bar} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text variant="subhead" numberOfLines={1}>
            {item.kyHieu || "—"}
          </Text>
          <View style={styles.place}>
            <MapPin size={12} color={colors.textTertiary} />
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
              {item.tenDA || "—"}
            </Text>
          </View>
        </View>
        <Badge label={config.label} tone={config.tone} />
      </View>

      {/* Còn hạn: thời gian còn lại + thanh tiến độ. Hết hạn: badge đã nói, không lặp lại */}
      {remainingMinutes > 0 ? (
        <View style={styles.remain}>
          <Text variant="caption" weight="semibold" color={config.bar}>
            {formatRemaining(remainingMinutes)}
          </Text>
          <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: config.bar }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Clock size={14} color={colors.textTertiary} />
        <Text variant="caption" color="textSecondary" style={styles.flex} numberOfLines={1}>
          Lock lúc {formatDateTime(item.ngayLock)}
        </Text>
        <View style={styles.chevron}>
          <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.5} />
        </View>
      </View>
    </Card>
  );
});

export default function LockedUnitsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    if (loading) return;
    // Tải thêm = tăng giới hạn (API không phân trang theo offset), chỉ khi có thể còn dữ liệu
    if (dataLook.length >= limit) setLimit((prev) => prev + 50);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLockList();
    setRefreshing(false);
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
    { key: "all" as const, label: "Tất cả", count: dataLook.length },
    { key: "active" as const, label: "Đang lock", count: activeCount },
    { key: "expired" as const, label: "Hết hạn", count: expiredCount },
  ];

  const openLock = useCallback(
    (item: any) =>
      router.push({
        pathname: "/locked/[id]",
        params: { id: item.id, maSP: item?.maSP },
      }),
    [router]
  );

  const header = (
    <View style={styles.listHeader}>
      <SearchBar value={searchInput} onChangeText={setSearchInput} placeholder="Tìm mã căn, dự án" variant="soft" />
      {showFilter && (
        <FilterPanel activeCount={selectedProjects.length > 0 ? 1 : 0} onReset={() => setSelectedProjects([])}>
          <FilterSection
            title="Dự án"
            hint="Chọn nhiều"
            options={multiSelectOptions(
              duAn,
              (p: any) => p.MaDA,
              (p: any) => p.TenDA,
              selectedProjects,
              setSelectedProjects
            )}
          />
        </FilterPanel>
      )}
      {/* Tràn ra mép màn để bóng chip không bị cắt ở hai đầu */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {tabs.map((tab) => (
          <Chip
            key={tab.key}
            label={tab.label}
            count={tab.count}
            selected={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
            variant="soft"
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={
          <AppHeader
            variant="soft"
            title="Lock căn"
            // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
            hideBack={embedded}
            actions={
              <FilterToggleButton
                open={showFilter}
                activeCount={selectedProjects.length > 0 ? 1 : 0}
                onPress={() => setShowFilter(!showFilter)}
              />
            }
          />
        }
      >
        <FlatList
          data={loading && dataLook.length === 0 ? [] : filteredData}
          keyExtractor={(item: any, index: number) => String(item.id || index)}
          renderItem={({ item }) => <LockRow item={item} onPress={openLock} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading ? (
              <SkeletonList count={4} />
            ) : (
              <EmptyState icon={Lock} title="Không có dữ liệu" description="Chưa có lock căn nào phù hợp với bộ lọc." />
            )
          }
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: embedded ? TAB_BAR_SPACE : space.xxl }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: space.xl },
  listHeader: { gap: space.md, paddingTop: space.sm, paddingBottom: space.md },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  gap: { height: space.md },
  card: { borderWidth: 0, borderRadius: radius.xxl, ...elevation.soft },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  place: { flexDirection: "row", alignItems: "center", gap: space.xs },
  remain: { gap: space.sm, marginTop: space.md + 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    marginTop: space.md + 2,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
});
