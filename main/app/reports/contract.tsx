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
  FileText,
  DollarSign,
  ChevronDown,
  X,
  Calendar,
  Check,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ProjectService } from "@/sevices/ProjectService";
import { BaoCaoService } from "@/sevices/BaoCaoService";

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

const PAGE_SIZE = 20;

type ActiveChip = "project" | "period" | null;
type DatePickerTarget = "from" | "to" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

const fmtDisplay = (d: Date | null) => {
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatShort = (num: number) => {
  if (num >= 1_000_000_000)
    return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} tr`;
  return new Intl.NumberFormat("vi-VN").format(num);
};

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

// ─── ContractItem ─────────────────────────────────────────────────────────────
const ContractItem = React.memo(({ item }: { item: any }) => (
  <View style={styles.listItem}>
    <View style={styles.listItemHeader}>
      <Text style={styles.contractCode}>{item.SoHDMB}</Text>
      <View style={[styles.statusBadge, { backgroundColor: "#EFF6FF" }]}>
        <Text style={[styles.statusText, { color: "#1D4ED8" }]}>
          Hợp đồng MB
        </Text>
      </View>
    </View>
    <Text style={styles.customerName}>{item.TenKH}</Text>
    <Text style={styles.projectText}>
      {item.TenDA ?? "Chưa xác định dự án"} • Ký hiệu: {item.KyHieu}
    </Text>
    <View style={styles.contractFooter}>
      <View style={styles.footerItem}>
        <Calendar size={13} color={Colors.textSecondary} />
        <Text style={styles.signDate}>{fmtDate(item.NgayKy)}</Text>
      </View>
      <View style={styles.footerItem}>
        <DollarSign size={13} color={Colors.primary} />
        {item.TongGiaTriHD != null ? (
          <Text style={styles.contractValue}>
            {formatShort(item.TongGiaTriHD)}
          </Text>
        ) : (
          <Text style={[styles.signDate, { fontStyle: "italic" }]}>
            Chưa có giá trị
          </Text>
        )}
      </View>
    </View>
  </View>
));

// ─── DropdownModal ────────────────────────────────────────────────────────────
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
export default function ContractReportScreen() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] =
    useState<Filters>(DEFAULT_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Đánh dấu lần chạy đầu tiên của effect debounce để KHÔNG lên lịch
  // một fetch trùng lặp ngay sau lần fetch ban đầu (gây gọi API 2 lần khi mount)
  const isFirstFilterRun = useRef(true);
  // Dùng để loại bỏ response "cũ" (race condition) — chỉ áp dụng kết quả
  // của request mới nhất, tránh trường hợp response chậm/rỗng đè lên data đúng
  const requestIdRef = useRef(0);

  const [activeChip, setActiveChip] = useState<ActiveChip>(null);
  const [dateTarget, setDateTarget] = useState<DatePickerTarget>(null);
  const [pendingDate, setPendingDate] = useState<Date>(new Date());

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [data, setData] = useState<any[]>([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
    // Lần chạy đầu tiên (mount): áp dụng filters ngay, không đặt timer.
    // Tránh việc 300ms sau lại set lại debouncedFilters (object mới) với
    // cùng giá trị, khiến effect fetch chạy thêm lần 2 cho cùng dữ liệu.
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      setDebouncedFilters(filters);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setData([]);
      setPageIndex(1);
      setHasMore(true);
      setDebouncedFilters(filters);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters]);

  // ── Fetch page ─────────────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (page: number, currentFilters: Filters) => {
      const myRequestId = ++requestIdRef.current;
      const isFirstPage = page === 1;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);
      try {
        const { TuNgay, DenNgay } = buildDateRange(currentFilters);
        const res = await BaoCaoService.getHopDong({
          MaDA: currentFilters.MaDA,
          TuNgay,
          DenNgay,
          PageSize: PAGE_SIZE,
          PageIndex: page,
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
        // Có request mới hơn đã được gọi sau request này -> bỏ qua kết quả cũ
        if (myRequestId !== requestIdRef.current) return;

        const newItems: any[] = res?.data ?? [];
        setData((prev) => (isFirstPage ? newItems : [...prev, ...newItems]));
        setHasMore(newItems.length >= PAGE_SIZE);
      } catch (e) {
        console.error("Lỗi tải hợp đồng:", e);
        if (isFirstPage && myRequestId === requestIdRef.current) setData([]);
      } finally {
        if (myRequestId === requestIdRef.current) {
          if (isFirstPage) setLoading(false);
          else setLoadingMore(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchPage(1, debouncedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters]);

  const handleEndReached = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    if (data.length === 0) return;
    const nextPage = pageIndex + 1;
    setPageIndex(nextPage);
    fetchPage(nextPage, debouncedFilters);
  }, [loadingMore, loading, hasMore, pageIndex, debouncedFilters, fetchPage]);

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
  const totalContractValue = useMemo(
    () => formatShort(data.reduce((s, i) => s + (i.TongGiaTriHD ?? 0), 0)),
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
    ({ item }: { item: any }) => <ContractItem item={item} />,
    []
  );
  const keyExtractor = useCallback((item: any) => String(item.MaHDMB), []);

  const ListFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
      </View>
    );
  }, [loadingMore]);

  // ListHeaderComponent chỉ chứa date range (chỉ hiện khi custom)
  // Toàn bộ chip + total card + section header đã lên sticky header bên ngoài
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
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>
            Đang tải dữ liệu...
          </Text>
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
          title: "Báo cáo hợp đồng",
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

      {/* Android Date Picker */}
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

      {/* ── STICKY HEADER — luôn bám trên cùng, không cuộn theo list ── */}
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

        {/* Total card */}
        <View style={styles.totalCard}>
          <View style={styles.totalAccent} />
          <View style={styles.totalIconWrap}>
            <FileText size={22} color="#3B82F6" />
          </View>
          <View style={styles.totalBody}>
            <Text style={styles.totalLabel}>Tổng giá trị hợp đồng</Text>
            <Text style={[styles.totalValue, { color: "#3B82F6" }]}>
              {totalContractValue}
            </Text>
            <Text style={styles.totalSub}>
              {data.length} hợp đồng{hasMore ? "+" : ""} • {periodLabel}
            </Text>
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Danh sách hợp đồng mua bán</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>
              {data.length}
              {hasMore ? "+" : ""}
            </Text>
          </View>
        </View>
      </View>

      {/* FlatList — chỉ cuộn phần danh sách */}
      <FlatList
        data={loading ? [] : data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode="never"
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.2}
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

  totalCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  totalAccent: { width: 5, alignSelf: "stretch", backgroundColor: "#3B82F6" },
  totalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 14,
  },
  totalBody: { flex: 1, paddingVertical: 16 },
  totalLabel: { fontSize: 12, color: Colors.textSecondary },
  totalValue: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  totalSub: { marginTop: 3, fontSize: 11, color: Colors.textSecondary },

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
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  listItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  contractCode: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "600" },
  customerName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  projectText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  contractFooter: { flexDirection: "row", gap: 16 },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  contractValue: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  signDate: { fontSize: 12, color: Colors.textSecondary },

  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },

  loadMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadMoreText: { fontSize: 13, color: Colors.textSecondary },
});
