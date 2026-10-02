import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { CalendarDays, CalendarX2, List, Plus, SearchX } from "lucide-react-native";

import { FilterPanel, FilterSection, FilterToggleButton } from "@/components/FilterPanel";
import { SigningCalendar } from "@/components/signing/SigningCalendar";
import { SigningRowItem } from "@/components/signing/SigningRowItem";
import {
  AppHeader,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  SearchBar,
  SegmentedControl,
  SkeletonList,
  Text,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { groupByDay, STATUS_OPTIONS, todayVN, type SigningRow, type SigningState } from "@/lib/signing";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, elevation, radius, space } from "@/theme";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { SigningService } from "@/sevicesSupabase/SigningService";

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

type Kind = "individual" | "enterprise";

/**
 * Đặt lịch ký – như web (beeland/src/pages/sales/giao-dich/dat-lich-ky/index.tsx): tab Cá nhân / Doanh nghiệp,
 * tìm kiếm + lọc dự án + trạng thái gửi xuống fn_signing_appointment_list; chế độ Danh sách / Lịch.
 * Kiểu bo tròn: header/ô tìm/chip `soft`, mỗi lịch ký là card bo `radius.xxl`, nút "Thêm" nổi dạng viên.
 */
export default function SigningsScreen({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("individual");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [state, setState] = useState<SigningState | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [rows, setRows] = useState<SigningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const firstFocus = useRef(true);

  const today = todayVN(Date.now());
  const [month, setMonth] = useState(today);
  const [day, setDay] = useState<string>(today);

  useEffect(() => {
    ProjectService.getProjects({})
      .then((r: any) => setProjects(r?.data ?? []))
      .catch(() => setProjects([]));
  }, []);

  const load = useCallback(
    async (kindOfLoad: "load" | "refresh") => {
      const v = ++version.current;
      if (kindOfLoad === "load") setLoading(true);
      else setRefreshing(true);
      try {
        const data = await SigningService.list({
          isPersonal: kind === "individual",
          state,
          search: debounced,
          projectId,
        });
        if (v !== version.current) return;
        setRows(data);
        setError(null);
      } catch (e: any) {
        if (v === version.current) setError(e?.message || "Không tải được danh sách lịch ký.");
      } finally {
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [kind, state, debounced, projectId],
  );

  useEffect(() => {
    void load("load");
  }, [load]);

  // Quay lại từ chi tiết / form → tải lại
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void load("refresh");
    }, [load]),
  );

  const grouped = useMemo(() => groupByDay(rows), [rows]);
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(grouped.byDay).map(([k, v]) => [k, v.length])),
    [grouped],
  );
  const dayRows = grouped.byDay[day] ?? [];

  const activeFilterCount = projectId ? 1 : 0;
  const filtering = activeFilterCount > 0 || !!state || !!query;
  const clear = () => {
    setQuery("");
    setProjectId(null);
    setState(null);
    setShowFilters(false);
  };

  const open = useCallback(
    (r: SigningRow) => router.push({ pathname: "/signing/[id]", params: { id: String(r.UID ?? r.ID) } }),
    [router],
  );
  const add = () => router.push({ pathname: "/signing/form", params: { kind, projectId: projectId ?? "" } });

  const projectOptions = projects.map((p: any) => ({
    key: String(p.id),
    label: p.ten_da || p.TenDA || "—",
    selected: projectId === String(p.id),
    onPress: () => setProjectId(projectId === String(p.id) ? null : String(p.id)),
  }));

  const toolbar = (
    <View style={styles.sticky}>
      <SegmentedControl
        variant="soft"
        value={kind}
        options={[
          { value: "individual", label: "Cá nhân" },
          { value: "enterprise", label: "Doanh nghiệp" },
        ]}
        onChange={setKind}
      />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Tìm mã căn, tên KH, điện thoại, giấy tờ…"
        variant="soft"
      />
      {showFilters ? (
        <FilterPanel activeCount={activeFilterCount} onReset={clear}>
          <FilterSection title="Dự án" hint="Chọn 1" options={projectOptions} />
        </FilterPanel>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip variant="soft" label="Tất cả" selected={!state} onPress={() => setState(null)} />
        {STATUS_OPTIONS.map((o) => (
          <Chip
            variant="soft"
            key={o.value}
            label={o.label}
            selected={state === o.value}
            onPress={() => setState(o.value)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const empty = () => {
    if (loading) return <SkeletonList />;
    if (error) return <ErrorState description={error} onRetry={() => void load("load")} />;
    return filtering ? (
      <EmptyState
        icon={SearchX}
        title="Không có lịch ký phù hợp"
        description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc."
        actionLabel="Xoá bộ lọc"
        onAction={clear}
      />
    ) : (
      <EmptyState
        icon={CalendarX2}
        title="Chưa có lịch ký"
        description="Bấm “Thêm lịch ký” để đặt lịch ký cho phiếu đặt cọc."
      />
    );
  };

  const calendarHeader = (
    <View style={styles.calendarBlock}>
      {toolbar}
      <SigningCalendar
        month={month}
        onMonthChange={setMonth}
        selected={day}
        onSelect={setDay}
        today={today}
        counts={counts}
      />
      <Text variant="subhead" style={styles.dayTitle}>
        {formatDate(`${day}T00:00:00`)} · {dayRows.length} lịch ký
      </Text>
      {grouped.noDate.length && day === today ? (
        <Text variant="caption" color="textSecondary" style={styles.dayTitle}>
          {grouped.noDate.length} lịch ký chưa có ngày ký – xem ở chế độ Danh sách.
        </Text>
      ) : null}
    </View>
  );

  const bottomPad = embedded ? TAB_BAR_SPACE + 72 : space.xxl + 72;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={
          <AppHeader
            variant="soft"
            title="Đặt lịch ký"
            subtitle={loading ? undefined : `${rows.length} lịch ký`}
            hideBack={embedded}
            actions={
              <View style={styles.headerActions}>
                <IconButton
                  icon={view === "list" ? CalendarDays : List}
                  variant="soft"
                  accessibilityLabel={view === "list" ? "Xem dạng lịch" : "Xem dạng danh sách"}
                  onPress={() => setView(view === "list" ? "calendar" : "list")}
                />
                <FilterToggleButton
                  open={showFilters}
                  activeCount={activeFilterCount}
                  onPress={() => setShowFilters(!showFilters)}
                />
              </View>
            }
          />
        }
      >
        {view === "list" ? (
          <FlatList
            data={loading ? [] : rows}
            keyExtractor={(r) => String(r.UID ?? r.ID)}
            renderItem={({ item }) => <SigningRowItem row={item} onPress={() => open(item)} />}
            ItemSeparatorComponent={Separator}
            ListHeaderComponent={toolbar}
            stickyHeaderIndices={[0]}
            ListEmptyComponent={empty()}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load("refresh")}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: bottomPad }}
          />
        ) : (
          <FlatList
            data={loading || error ? [] : dayRows}
            keyExtractor={(r) => String(r.UID ?? r.ID)}
            renderItem={({ item }) => <SigningRowItem row={item} showDate={false} onPress={() => open(item)} />}
            ItemSeparatorComponent={Separator}
            ListHeaderComponent={calendarHeader}
            ListEmptyComponent={
              loading ? (
                <SkeletonList />
              ) : error ? (
                <ErrorState description={error} onRetry={() => void load("load")} />
              ) : (
                <Text variant="caption" color="textSecondary" align="center" style={styles.noDay}>
                  Không có lịch ký trong ngày này.
                </Text>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load("refresh")}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={{ paddingBottom: bottomPad }}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm lịch ký"
          onPress={add}
          style={({ pressed }) => [
            styles.fab,
            { bottom: embedded ? TAB_BAR_SPACE : space.xl },
            pressed ? styles.fabPressed : null,
          ]}
        >
          <Plus size={20} color={colors.onPrimary} />
          <Text variant="subhead" color="onPrimary">
            Thêm lịch ký
          </Text>
        </Pressable>
      </Screen>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sticky: {
    backgroundColor: colors.bg,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  separator: { height: space.sm + 2 },
  calendarBlock: { gap: space.md, paddingBottom: space.md },
  dayTitle: { paddingHorizontal: space.xl },
  noDay: { paddingVertical: space.xl },
  fab: {
    position: "absolute",
    right: space.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    ...elevation.overlay,
  },
  fabPressed: { backgroundColor: colors.primaryPressed },
});
