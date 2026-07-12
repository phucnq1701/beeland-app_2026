import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import Colors from "@/constants/colors";
import {
  DollarSign,
  FileText,
  CalendarClock,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  Check,
  X,
  Calendar,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BaoCaoService } from "@/sevices/BaoCaoService";
import { ProjectService } from "@/sevices/ProjectService";

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
const fmtISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDisplay = (d: Date | null) =>
  d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";

const safeDate = (d: Date | null | undefined): Date => {
  if (d instanceof Date && !isNaN(d.getTime())) return d;
  return new Date();
};

function buildDateRange(f: Filters): { TuNgay: string; DenNgay: string } {
  const today = new Date();
  switch (f.period) {
    case "today":
      return { TuNgay: fmtISO(today), DenNgay: fmtISO(today) };
    case "week": {
      const d = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() + (d === 0 ? -6 : 1 - d));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { TuNgay: fmtISO(mon), DenNgay: fmtISO(sun) };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { TuNgay: fmtISO(first), DenNgay: fmtISO(last) };
    }
    case "year":
      return {
        TuNgay: fmtISO(new Date(today.getFullYear(), 0, 1)),
        DenNgay: fmtISO(new Date(today.getFullYear(), 11, 31)),
      };
    case "custom":
      return {
        TuNgay: f.fromDate ? fmtISO(f.fromDate) : fmtISO(today),
        DenNgay: f.toDate ? fmtISO(f.toDate) : fmtISO(today),
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const router = useRouter();
  // const { width } = useWindowDimensions();
  // const isSmallScreen = width < 380;

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeChip, setActiveChip] = useState<ActiveChip>(null);

  // ── Date picker state ──────────────────────────────────────────────────────
  // dateTargetRef giữ giá trị "from" | "to" không bị stale trong closures
  const dateTargetRef = useRef<DatePickerTarget>(null);
  const [dateTarget, setDateTargetState] = useState<DatePickerTarget>(null);
  const [pendingDate, setPendingDate] = useState<Date>(new Date());

  const setDateTarget = (t: DatePickerTarget) => {
    dateTargetRef.current = t;
    setDateTargetState(t);
  };

  // ── Dự án ──────────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

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

  // ── Tổng quan ──────────────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const { TuNgay, DenNgay } = buildDateRange(filters);
    BaoCaoService.getTongQuan({ MaDA: filters.MaDA, TuNgay, DenNgay })
      .then((res) => setData(res?.data ?? null)   
    )
      .catch((e) => console.error("Lỗi tải tổng quan:", e));
  }, [filters]);

  // ── Setters ────────────────────────────────────────────────────────────────
  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const toggleChip = (key: ActiveChip) =>
    setActiveChip((prev) => (prev === key ? null : key));

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setActiveChip(null);
    setDateTarget(null);
  }, []);

  // ── Date picker ────────────────────────────────────────────────────────────
  const openDatePicker = (target: "from" | "to") => {
    const initial =
      target === "from"
        ? safeDate(filters.fromDate)
        : safeDate(filters.toDate ?? filters.fromDate);
    setPendingDate(initial);
    setDateTarget(target);
  };

  // KEY FIX: nhận target qua tham số thay vì đọc từ closure
  const applyDate = (date: Date, target: DatePickerTarget) => {
    if (target === "from") {
      setFilters((prev) => ({
        ...prev,
        fromDate: date,
        toDate: prev.toDate && date > prev.toDate ? null : prev.toDate,
      }));
    } else if (target === "to") {
      setFilter("toDate", date);
    }
  };

  const onDateChange = (_: any, selected?: Date) => {
    if (!selected) return;
    if (Platform.OS === "android") {
      const currentTarget = dateTargetRef.current;
      setDateTarget(null);
      applyDate(selected, currentTarget);
    } else {
      // iOS: chỉ cập nhật preview, chưa apply
      setPendingDate(selected);
    }
  };

  const handleConfirmDate = () => {
    const currentTarget = dateTargetRef.current;
    applyDate(pendingDate, currentTarget);
    setDateTarget(null);
  };

  const handleCancelDate = () => setDateTarget(null);

  // ── Labels / active flags ─────────────────────────────────────────────────
  const projectLabel =
    projects.find((p) => p.MaDA === filters.MaDA)?.TenDA ?? "Tất cả dự án";
  const periodLabel =
    periodOptions.find((p) => p.id === filters.period)?.label ?? "Tuần này";
  const isProjectActive = filters.MaDA !== null;
  const isPeriodActive = filters.period !== "week";

  const formatTy = (value?: number | null) => {
    if (!value) return "0 tỷ";

    return `${(value / 1_000_000_000).toLocaleString("vi-VN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} tỷ`;
  };

  const reportMap = Object.fromEntries(data.map((item) => [item.Key, item]));

  const reportCards = [
    {
      id: "revenue",
      title: "Thu tiền",
      subtitle: "Doanh thu " + periodLabel.toLowerCase(),
      value: formatTy(reportMap.THU_TIEN?.GiaTriTien),
      icon: <DollarSign color="#10B981" size={22} />,
      bgColor: "#ECFDF5",
      route: "/reports/payment",
    },
    {
      id: "contract",
      title: "Hợp đồng",
      subtitle: "HĐMB " + periodLabel.toLowerCase(),
      value: formatTy(reportMap.HOP_DONG?.GiaTriTien),
      icon: <FileText color="#3B82F6" size={22} />,
      bgColor: "#EFF6FF",
      route: "/reports/contract",
    },
    {
      id: "due",
      title: "Sắp đến hạn",
      subtitle: "Đợt thanh toán " + periodLabel.toLowerCase(),
      value: `${reportMap.SAP_DEN_HAN?.SoDot ?? 0} đợt`,
      icon: <CalendarClock color="#F59E0B" size={22} />,
      bgColor: "#FFFBEB",
      route: "/reports/payment-due",
    },
    {
      id: "overdue",
      title: "Đợt quá hạn",
      subtitle: "Cần xử lý ngay",
      value: `${reportMap.QUA_HAN?.SoDot ?? 0} đợt`,
      icon: <AlertTriangle color="#EF4444" size={22} />,
      bgColor: "#FEF2F2",
      route: "/reports/overdue",
    },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Báo cáo",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft color={Colors.text} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Chips + Dropdown ───────────────────────────────────────── */}
        <View style={{ zIndex: 999 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScrollWrapper}
            contentContainerStyle={styles.chipScroll}
          >
            {/* Chip dự án */}
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

            {/* Chip thời gian */}
            <TouchableOpacity
              style={[styles.chip, isPeriodActive && styles.chipActive]}
              onPress={() => toggleChip("period")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  isPeriodActive && styles.chipTextActive,
                ]}
              >
                {periodLabel}
              </Text>
              {isPeriodActive ? (
                <Check size={13} color="#fff" />
              ) : (
                <ChevronDown size={13} color={Colors.text} />
              )}
            </TouchableOpacity>

            {/* Nút reset */}
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

          {/* Dropdown */}
          {activeChip !== null && (
            <>
              <TouchableWithoutFeedback onPress={() => setActiveChip(null)}>
                <View style={styles.dropdownBackdrop} />
              </TouchableWithoutFeedback>

              <View style={styles.floatingDropdown}>
                <ScrollView
                  style={{ maxHeight: 280 }}
                  showsVerticalScrollIndicator={false}
                >
                  {activeChip === "project" &&
                    projects.map((opt, idx, arr) => (
                      <TouchableOpacity
                        key={String(opt.MaDA)}
                        style={[
                          styles.dropdownItem,
                          idx === arr.length - 1 && { borderBottomWidth: 0 },
                          filters.MaDA === opt.MaDA &&
                            styles.dropdownItemActive,
                        ]}
                        onPress={() => {
                          setFilter("MaDA", opt.MaDA);
                          setActiveChip(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            filters.MaDA === opt.MaDA &&
                              styles.dropdownItemTextActive,
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
                          styles.dropdownItem,
                          idx === arr.length - 1 && { borderBottomWidth: 0 },
                          filters.period === opt.id &&
                            styles.dropdownItemActive,
                        ]}
                        onPress={() => {
                          setFilter("period", opt.id);
                          setActiveChip(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            filters.period === opt.id &&
                              styles.dropdownItemTextActive,
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
            </>
          )}
        </View>

        {/* ── Date range — chỉ hiện khi 'custom' ───────────────────── */}
        {filters.period === "custom" && (
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
                  filters.fromDate && styles.dateInputFilled,
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
                color={
                  dateTarget === "to" ? Colors.primary : Colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.dateInputText,
                  filters.toDate && styles.dateInputFilled,
                ]}
              >
                {fmtDisplay(filters.toDate) || "Đến ngày"}
              </Text>
            </TouchableOpacity>

            {(filters.fromDate || filters.toDate) && (
              <TouchableOpacity
                style={styles.dateClear}
                onPress={() =>
                  setFilters((p) => ({ ...p, fromDate: null, toDate: null }))
                }
              >
                <X size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── iOS Date Picker Modal ──────────────────────────────────── */}
        {Platform.OS === "ios" && (
          <Modal
            transparent
            animationType="slide"
            visible={dateTarget !== null}
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

              <View style={styles.pickerCenter}>
                <DateTimePicker
                  mode="date"
                  display="spinner"
                  value={pendingDate}
                  minimumDate={
                    dateTarget === "to" ? safeDate(filters.fromDate) : undefined
                  }
                  maximumDate={
                    dateTarget === "from" && filters.toDate
                      ? safeDate(filters.toDate)
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

        {/* ── Android Date Picker ────────────────────────────────────── */}
        {Platform.OS === "android" && dateTarget !== null && (
          <DateTimePicker
            mode="date"
            display="default"
            value={
              dateTarget === "from"
                ? safeDate(filters.fromDate)
                : safeDate(filters.toDate ?? filters.fromDate)
            }
            minimumDate={
              dateTarget === "to" && filters.fromDate
                ? safeDate(filters.fromDate)
                : undefined
            }
            maximumDate={
              dateTarget === "from" && filters.toDate
                ? safeDate(filters.toDate)
                : undefined
            }
            onChange={onDateChange}
          />
        )}

        {/* ── Grid cards ─────────────────────────────────────────────── */}
        <View style={styles.grid}>
          {reportCards.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              style={styles.card}
              onPress={() => router.push(item.route as any)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: item.bgColor },
                ]}
              >
                {item.icon}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <Text style={styles.cardValue}>{item.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  // Chips
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

  // Dropdown
  dropdownBackdrop: {
    position: "absolute",
    top: -200,
    left: -16,
    right: -16,
    bottom: -2000,
    zIndex: 10,
  },
  floatingDropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 11,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  dropdownItemActive: { backgroundColor: "#F5F8FF" },
  dropdownItemText: { fontSize: 14, color: Colors.text },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: "500" },

  // Date range
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
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
  dateInputFilled: { color: Colors.text, fontWeight: "500" },
  dateSep: { fontSize: 14, color: Colors.textSecondary },
  dateClear: { padding: 6 },

  // iOS Date Picker Modal
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
  pickerCenter: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
  },
  iosPicker: { width: "100%" },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  gridSmall: { flexDirection: "column" },

  // Cards
  card: {
    width: "48%",
    minHeight: 145,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
    }),
  },
  cardSmall: { width: "100%" },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
  cardValue: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
});
