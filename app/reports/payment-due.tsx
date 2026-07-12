import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { router, Stack } from "expo-router";
import Colors from "@/constants/colors";
import {
  ChevronDown,
  X,
  Calendar,
  Check,
  Banknote,
  CalendarClock,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ProjectService } from "@/sevices/ProjectService";
import { BaoCaoService } from "@/sevices/BaoCaoService";

// ─── Types ────────────────────────────────────────────────────────────────────
type PeriodType = "today" | "week" | "month" | "year" | "custom";

const periodOptions: { id: PeriodType; label: string }[] = [
  { id: "today", label: "Hôm nay" },
  { id: "week", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "year", label: "Năm này" },
  { id: "custom", label: "Tự chọn" },
];

interface ProjectOption {
  MaDA: number | null;
  TenDA: string;
}

interface SapHHItem {
  ConThieu: number;
  DotTT: number;
  DotTTText: string | null;
  ID: number;
  MaKH: number;
  NgayTT: string;
  SoHD: string;
  SoNgayConLai: number;
  SoTien: number;
  TenKH: string;
  TongDaThu: number;
  TrangThaiThu: string;
}

interface Filters {
  MaDA: number | null;
  period: PeriodType;
  fromDate: Date | null;
  toDate: Date | null;
}

const DEFAULT_FILTERS: Filters = {
  MaDA: null,
  period: "week",
  fromDate: null,
  toDate: null,
};

type ActiveChip = "project" | "period" | null;
type DatePickerTarget = "from" | "to" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

const fmtDisplay = (d: Date | null) => {
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const fmtISOToDisplay = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatShort = (num: number) => {
  if (num >= 1_000_000_000)
    return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} tỷ`;
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")} tr`;
  return new Intl.NumberFormat("vi-VN").format(num);
};

const formatCurrency = (num: number) =>
  new Intl.NumberFormat("vi-VN").format(num) + " ₫";

function buildDateRange(filters: Filters): { TuNgay: string; DenNgay: string } {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  switch (filters.period) {
    case "today":
      return { TuNgay: fmt(today), DenNgay: fmt(today) };
    case "week": {
      const day = today.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(today);
      mon.setDate(today.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { TuNgay: fmt(mon), DenNgay: fmt(sun) };
    }
    case "month":
      return {
        TuNgay: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
        DenNgay: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      };
    case "year":
      return {
        TuNgay: fmt(new Date(today.getFullYear(), 0, 1)),
        DenNgay: fmt(new Date(today.getFullYear(), 11, 31)),
      };
    case "custom":
      return {
        TuNgay: fmt(filters.fromDate ?? today),
        DenNgay: fmt(filters.toDate ?? today),
      };
  }
}

const DaysBadge = React.memo(({ days }: { days: number }) => {
  if (days < 0)
    return (
      <View style={[styles.daysBadge, { backgroundColor: "#FEF2F2" }]}>
        <Text style={[styles.daysBadgeText, { color: "#EF4444" }]}>
          quá {Math.abs(days)} ngày
        </Text>
      </View>
    );
  if (days === 0)
    return (
      <View style={[styles.daysBadge, { backgroundColor: "#FEF2F2" }]}>
        <Text style={[styles.daysBadgeText, { color: "#EF4444" }]}>
          hôm nay
        </Text>
      </View>
    );
  if (days <= 7)
    return (
      <View style={[styles.daysBadge, { backgroundColor: "#FFF7ED" }]}>
        <Text style={[styles.daysBadgeText, { color: "#EA580C" }]}>
          còn {days} ngày
        </Text>
      </View>
    );
  return (
    <View style={[styles.daysBadge, { backgroundColor: "#FFFBEB" }]}>
      <Text style={[styles.daysBadgeText, { color: "#D97706" }]}>
        còn {days} ngày
      </Text>
    </View>
  );
});

const DebtItem = React.memo(({ item }: { item: SapHHItem }) => {
  const batchLabel = item.DotTTText ?? `Đợt ${item.DotTT}`;
  const dueDateDisplay = fmtISOToDisplay(item.NgayTT);
  const isPaid = item.TongDaThu >= item.SoTien;
  const amountDisplay = formatCurrency(item.ConThieu);

  return (
    <View style={styles.listItem}>
      <View style={styles.itemIconWrap}>
        <CalendarClock size={20} color="#D97706" />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemRow}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.SoHD}
          </Text>
          <DaysBadge days={item.SoNgayConLai} />
        </View>
        <Text style={styles.itemSub} numberOfLines={1}>
          {item.TenKH} · {batchLabel}
        </Text>
        <View style={styles.itemDateRow}>
          <Calendar size={11} color={Colors.textSecondary} />
          <Text style={styles.itemDateText}>
            Hạn thanh toán: {dueDateDisplay}
          </Text>
        </View>
        <View style={styles.itemFooter}>
          <View>
            <Text style={styles.itemAmount}>{amountDisplay}</Text>
            <View
              style={[
                styles.statusBadge,
                isPaid
                  ? { backgroundColor: "#F0FDF4" }
                  : { backgroundColor: "#FEF2F2" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isPaid ? { color: "#16A34A" } : { color: "#EF4444" },
                ]}
              >
                {item.TrangThaiThu}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
});

interface DropdownModalProps {
  activeChip: ActiveChip;
  onClose: () => void;
  projects: ProjectOption[];
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}

const DropdownModal = React.memo(
  ({
    activeChip,
    onClose,
    projects,
    filters,
    setFilter,
  }: DropdownModalProps) => {
    if (activeChip === null) return null;
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={dropdownStyles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={dropdownStyles.sheet}>
          <View style={dropdownStyles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {activeChip === "project" &&
              projects.map((opt, idx, arr) => (
                <TouchableOpacity
                  key={String(opt.MaDA)}
                  style={[
                    dropdownStyles.item,
                    idx === arr.length - 1 && { borderBottomWidth: 0 },
                    filters.MaDA === opt.MaDA && dropdownStyles.itemActive,
                  ]}
                  onPress={() => {
                    setFilter("MaDA", opt.MaDA);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      dropdownStyles.itemText,
                      filters.MaDA === opt.MaDA &&
                        dropdownStyles.itemTextActive,
                    ]}
                  >
                    {opt.TenDA}
                  </Text>
                  {filters.MaDA === opt.MaDA && (
                    <Check size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            {activeChip === "period" &&
              periodOptions.map((opt, idx, arr) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    dropdownStyles.item,
                    idx === arr.length - 1 && { borderBottomWidth: 0 },
                    filters.period === opt.id && dropdownStyles.itemActive,
                  ]}
                  onPress={() => {
                    setFilter("period", opt.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      dropdownStyles.itemText,
                      filters.period === opt.id &&
                        dropdownStyles.itemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {filters.period === opt.id && (
                    <Check size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DebtReportScreen() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] =
    useState<Filters>(DEFAULT_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeChip, setActiveChip] = useState<ActiveChip>(null);
  const [dateTarget, setDateTarget] = useState<DatePickerTarget>(null);
  const [pendingDate, setPendingDate] = useState<Date>(new Date());

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [data, setData] = useState<SapHHItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Fetch projects ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProjects(true);
      try {
        const res = await ProjectService.getProjects({});
        if (!cancelled)
          setProjects([{ MaDA: null, TenDA: "Tất cả dự án" }, ...res.data]);
      } catch (e) {
        console.error("Lỗi tải dự án:", e);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Debounce filters ───────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { TuNgay, DenNgay } = buildDateRange(debouncedFilters);
        const res = await BaoCaoService.getSapHH({
          MaDA: debouncedFilters.MaDA,
          TuNgay,
          DenNgay,
        });
        if (res?.status === 4001) {
          Alert.alert(
            "Không có quyền",
            "Bạn không có quyền xem báo cáo này.",
            [{ text: "OK", onPress: () => router.back() }],
            { cancelable: false }
          );
          return;
        }
        if (!cancelled) setData(res?.data ?? []);
      } catch (e) {
        console.error("Lỗi tải hợp đồng:", e);
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters]);

  // ── Setters ────────────────────────────────────────────────────────────────
  const setFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    []
  );
  const toggleChip = useCallback(
    (key: ActiveChip) => setActiveChip((prev) => (prev === key ? null : key)),
    []
  );
  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setActiveChip(null);
    setDateTarget(null);
  }, []);
  const closeDropdown = useCallback(() => setActiveChip(null), []);

  // ── Date picker ────────────────────────────────────────────────────────────
  const openDatePicker = useCallback(
    (target: DatePickerTarget) => {
      const initial =
        target === "from"
          ? filters.fromDate ?? new Date()
          : filters.toDate ?? filters.fromDate ?? new Date();
      setPendingDate(initial);
      setDateTarget(target);
    },
    [filters.fromDate, filters.toDate]
  );

  const applyDate = useCallback(
    (date: Date) => {
      if (dateTarget === "from") {
        setFilter("fromDate", date);
        if (filters.toDate && date > filters.toDate) setFilter("toDate", null);
      } else if (dateTarget === "to") {
        setFilter("toDate", date);
      }
    },
    [dateTarget, filters.toDate, setFilter]
  );

  const onDateChange = useCallback(
    (_: any, selected?: Date) => {
      if (!selected) return;
      if (Platform.OS === "android") {
        applyDate(selected);
        setDateTarget(null);
      } else setPendingDate(selected);
    },
    [applyDate]
  );

  const handleConfirmDate = useCallback(() => {
    applyDate(pendingDate);
    setDateTarget(null);
  }, [applyDate, pendingDate]);

  const handleCancelDate = useCallback(() => setDateTarget(null), []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalConThieu = useMemo(
    () => data.reduce((s, i) => s + (i.ConThieu ?? 0), 0),
    [data]
  );
  const totalSoTien = useMemo(
    () => data.reduce((s, i) => s + (i.SoTien ?? 0), 0),
    [data]
  );

  const projectLabel =
    projects.find((p) => p.MaDA === filters.MaDA)?.TenDA ?? "Tất cả dự án";
  const periodLabel =
    periodOptions.find((p) => p.id === filters.period)?.label ?? "Hôm nay";
  const isProjectActive = filters.MaDA !== null;
  const isPeriodActive = filters.period !== "today";

  // ── FlatList helpers ───────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: SapHHItem }) => <DebtItem item={item} />,
    []
  );
  const keyExtractor = useCallback((item: SapHHItem) => String(item.ID), []);

  const ListHeader = useMemo(() => {
    if (filters.period !== "custom") return null;
    return (
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={[
            styles.dateInput,
            dateTarget === "from" && styles.dateInputFocused,
          ]}
          onPress={() => openDatePicker("from")}
        >
          <Calendar
            size={14}
            color={
              dateTarget === "from" ? Colors.primary : Colors.textSecondary
            }
          />
          <Text
            style={[
              styles.dateInputText,
              filters.fromDate && styles.dateInputTextFilled,
            ]}
          >
            {fmtDisplay(filters.fromDate) || "Từ ngày"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.dateSep}>—</Text>
        <TouchableOpacity
          style={[
            styles.dateInput,
            dateTarget === "to" && styles.dateInputFocused,
          ]}
          onPress={() => openDatePicker("to")}
        >
          <Calendar
            size={14}
            color={dateTarget === "to" ? Colors.primary : Colors.textSecondary}
          />
          <Text
            style={[
              styles.dateInputText,
              filters.toDate && styles.dateInputTextFilled,
            ]}
          >
            {fmtDisplay(filters.toDate) || "Đến ngày"}
          </Text>
        </TouchableOpacity>
        {(filters.fromDate || filters.toDate) && (
          <TouchableOpacity
            onPress={() =>
              setFilters((prev) => ({ ...prev, fromDate: null, toDate: null }))
            }
            style={styles.dateClear}
          >
            <X size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.period, filters.fromDate, filters.toDate, dateTarget]);

  const ListEmpty = useMemo(
    () =>
      loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Không có dữ liệu phù hợp</Text>
        </View>
      ),
    [loading]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Báo cáo sắp đến hạn",
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <DropdownModal
        activeChip={activeChip}
        onClose={closeDropdown}
        projects={projects}
        filters={filters}
        setFilter={setFilter}
      />

      {/* iOS Date Picker */}
      {Platform.OS === "ios" && dateTarget !== null && (
        <Modal
          transparent
          animationType="slide"
          visible
          onRequestClose={handleCancelDate}
        >
          <TouchableWithoutFeedback onPress={handleCancelDate}>
            <View style={styles.pickerBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity
                onPress={handleCancelDate}
                style={styles.pickerHeaderBtn}
              >
                <Text style={styles.pickerCancelText}>Huỷ</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {dateTarget === "from" ? "Từ ngày" : "Đến ngày"}
              </Text>
              <TouchableOpacity
                onPress={handleConfirmDate}
                style={styles.pickerHeaderBtn}
              >
                <Text style={styles.pickerConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerPreviewRow}>
              <Calendar size={14} color={Colors.primary} />
              <Text style={styles.pickerPreviewText}>
                {fmtDisplay(pendingDate)}
              </Text>
            </View>
            <View
              style={{
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: Colors.white,
              }}
            >
              <DateTimePicker
                mode="date"
                display="spinner"
                value={pendingDate}
                minimumDate={
                  dateTarget === "to"
                    ? filters.fromDate ?? undefined
                    : undefined
                }
                maximumDate={
                  dateTarget === "from"
                    ? filters.toDate ?? undefined
                    : undefined
                }
                onChange={onDateChange}
                locale="vi-VN"
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === "android" && dateTarget !== null && (
        <DateTimePicker
          mode="date"
          display="default"
          value={
            dateTarget === "from"
              ? filters.fromDate ?? new Date()
              : filters.toDate ?? filters.fromDate ?? new Date()
          }
          minimumDate={
            dateTarget === "to" ? filters.fromDate ?? undefined : undefined
          }
          maximumDate={
            dateTarget === "from" ? filters.toDate ?? undefined : undefined
          }
          onChange={onDateChange}
        />
      )}

      {/* ══ STICKY HEADER — chip + 2 cards + section header ══ */}
      <View style={styles.stickyHeader}>
        {/* Chip row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollWrapper}
          contentContainerStyle={styles.chipScroll}
        >
          <TouchableOpacity
            style={[styles.chip, isProjectActive && styles.chipActive]}
            onPress={() => toggleChip("project")}
            activeOpacity={0.8}
          >
            {loadingProjects ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <>
                <Text
                  style={[
                    styles.chipText,
                    isProjectActive && styles.chipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {projectLabel}
                </Text>
                {isProjectActive ? (
                  <Check size={13} color="#fff" />
                ) : (
                  <ChevronDown size={13} color={Colors.text} />
                )}
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, isPeriodActive && styles.chipActive]}
            onPress={() => toggleChip("period")}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.chipText, isPeriodActive && styles.chipTextActive]}
            >
              {periodLabel}
            </Text>
            {isPeriodActive ? (
              <Check size={13} color="#fff" />
            ) : (
              <ChevronDown size={13} color={Colors.text} />
            )}
          </TouchableOpacity>

          {(isProjectActive || isPeriodActive) && (
            <TouchableOpacity
              style={styles.chipReset}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <X size={13} color={Colors.textSecondary} />
              <Text style={styles.chipResetText}>Xoá lọc</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* 2 summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.totalCard, { flex: 1 }]}>
            <View
              style={[styles.totalAccent, { backgroundColor: "#EF4444" }]}
            />
            <View
              style={[
                styles.totalIconWrap,
                { backgroundColor: "#FEF2F2", marginHorizontal: 12 },
              ]}
            >
              <Banknote size={20} color="#EF4444" />
            </View>
            <View style={styles.totalBody}>
              <Text style={styles.totalLabel}>Tổng cần thu</Text>
              <Text style={[styles.totalValue, { color: "#EF4444" }]}>
                {formatShort(totalSoTien)}
              </Text>
              <Text style={styles.totalSub}>
                {data.length} đợt • {periodLabel}
              </Text>
            </View>
          </View>

          <View style={[styles.totalCard, { flex: 1, marginLeft: 10 }]}>
            <View
              style={[styles.totalAccent, { backgroundColor: "#D97706" }]}
            />
            <View
              style={[
                styles.totalIconWrap,
                { backgroundColor: "#FFFBEB", marginHorizontal: 12 },
              ]}
            >
              <CalendarClock size={20} color="#D97706" />
            </View>
            <View style={styles.totalBody}>
              <Text style={styles.totalLabel}>Còn thiếu</Text>
              <Text style={[styles.totalValue, { color: "#D97706" }]}>
                {formatShort(totalConThieu)}
              </Text>
              <Text style={styles.totalSub}>chưa thanh toán</Text>
            </View>
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Danh sách đợt</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{data.length}</Text>
          </View>
        </View>
      </View>

      {/* FlatList — chỉ cuộn phần danh sách, không có phân trang */}
      <FlatList
        data={loading ? [] : data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode="never"
      />
    </View>
  );
}

// ─── Dropdown styles ──────────────────────────────────────────────────────────
const dropdownStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 14,
    maxHeight: 320,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  itemActive: { backgroundColor: "#F5F8FF" },
  itemText: { fontSize: 14, color: Colors.text },
  itemTextActive: { color: Colors.primary, fontWeight: "500" },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },

  stickyHeader: {
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  chipScrollWrapper: { marginBottom: 12 },
  chipScroll: { gap: 10, paddingRight: 8, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: "500", color: Colors.text },
  chipTextActive: { color: "#fff" },
  chipReset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipResetText: { fontSize: 13, color: Colors.textSecondary },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateInputFocused: { borderColor: Colors.primary, backgroundColor: "#F5F8FF" },
  dateInputText: { fontSize: 13, color: Colors.textSecondary },
  dateInputTextFilled: { color: Colors.text, fontWeight: "500" },
  dateSep: { fontSize: 14, color: Colors.textSecondary },
  dateClear: { padding: 6 },

  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
    }),
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  pickerHeaderBtn: { paddingVertical: 4, paddingHorizontal: 4, minWidth: 60 },
  pickerTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  pickerCancelText: { fontSize: 15, color: Colors.textSecondary },
  pickerConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "right",
  },
  pickerPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  pickerPreviewText: { fontSize: 14, fontWeight: "600", color: Colors.primary },
  iosPicker: { width: "100%" },

  summaryRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  totalCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  totalAccent: { width: 4, alignSelf: "stretch" },
  totalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  totalBody: { flex: 1, paddingVertical: 14, paddingRight: 8 },
  totalLabel: { fontSize: 11, color: Colors.textSecondary },
  totalValue: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  totalSub: { marginTop: 2, fontSize: 10, color: Colors.textSecondary },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },
  sectionBadge: {
    backgroundColor: Colors.primary + "1A",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.primary },

  listItem: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  itemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  itemBody: { flex: 1, gap: 4 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  itemSub: { fontSize: 12, color: Colors.textSecondary },
  itemDateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemDateText: { fontSize: 11, color: Colors.textSecondary },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 4,
  },
  itemAmount: { fontSize: 14, fontWeight: "800", color: Colors.text },
  statusBadge: {
    marginTop: 3,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 10, fontWeight: "600" },

  daysBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  daysBadgeText: { fontSize: 11, fontWeight: "700" },

  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },
});
