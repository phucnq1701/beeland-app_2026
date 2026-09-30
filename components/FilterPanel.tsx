import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react-native";
import Colors from "@/constants/colors";

/**
 * Bộ lọc dùng chung cho các màn danh sách (Sản phẩm, Booking, Đặt cọc,
 * Hợp đồng, Căn đã lock) — đảm bảo giao diện đồng bộ trong toàn app.
 */

const PRIMARY_TINT = "rgba(232, 111, 37, 0.1)";

type FilterToggleButtonProps = {
  open: boolean;
  activeCount?: number;
  onPress: () => void;
};

export function FilterToggleButton({
  open,
  activeCount = 0,
  onPress,
}: FilterToggleButtonProps) {
  const highlighted = open || activeCount > 0;
  return (
    <TouchableOpacity
      style={[styles.toggle, highlighted && styles.toggleActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Bộ lọc"
      accessibilityState={{ expanded: open }}
    >
      <SlidersHorizontal color={Colors.primary} size={18} />
      <Text style={styles.toggleText}>Bộ lọc</Text>
      {activeCount > 0 ? (
        <View style={styles.toggleBadge}>
          <Text style={styles.toggleBadgeText}>{activeCount}</Text>
        </View>
      ) : open ? (
        <ChevronUp color={Colors.primary} size={16} />
      ) : (
        <ChevronDown color={Colors.primary} size={16} />
      )}
    </TouchableOpacity>
  );
}

type FilterPanelProps = {
  activeCount?: number;
  onReset?: () => void;
  children: React.ReactNode;
};

export function FilterPanel({
  activeCount = 0,
  onReset,
  children,
}: FilterPanelProps) {
  const canReset = activeCount > 0 && !!onReset;
  const sections = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Bộ lọc</Text>
        {activeCount > 0 && (
          <Text style={styles.panelSubtitle}>{activeCount} đang áp dụng</Text>
        )}
        {onReset && (
          <TouchableOpacity
            style={[styles.resetButton, !canReset && styles.resetButtonDisabled]}
            onPress={onReset}
            disabled={!canReset}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RotateCcw
              size={14}
              color={canReset ? Colors.primary : Colors.textLight}
            />
            <Text
              style={[styles.resetText, !canReset && styles.resetTextDisabled]}
            >
              Đặt lại
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {sections.map((section, i) => (
        <View key={i} style={i > 0 ? styles.sectionDivider : undefined}>
          {section}
        </View>
      ))}
    </View>
  );
}

export type FilterOption = {
  key: string | number;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Màu chấm trạng thái (tuỳ chọn). */
  color?: string | null;
};

type FilterSectionProps = {
  title: string;
  /** Gợi ý nhỏ cạnh tiêu đề, vd "Chọn nhiều". */
  hint?: string;
  options: FilterOption[];
  /** Số lựa chọn hiển thị khi thu gọn; mặc định 8. */
  collapsedCount?: number;
};

export function FilterSection({
  title,
  hint,
  options,
  collapsedCount = 8,
}: FilterSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = options.length > collapsedCount + 1;
  // Khi thu gọn vẫn giữ các lựa chọn đang chọn để người dùng luôn thấy.
  const visible =
    collapsible && !expanded
      ? options.filter((o, i) => i < collapsedCount || o.selected)
      : options;
  const hiddenCount = options.length - visible.length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      <View style={styles.chips}>
        {visible.map((opt) => (
          <TouchableOpacity
            key={String(opt.key)}
            style={[styles.chip, opt.selected && styles.chipActive]}
            onPress={opt.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: opt.selected }}
          >
            {opt.selected ? (
              <Check size={14} color={Colors.primary} strokeWidth={3} />
            ) : opt.color ? (
              <View style={[styles.chipDot, { backgroundColor: opt.color }]} />
            ) : null}
            <Text
              style={[styles.chipText, opt.selected && styles.chipTextActive]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        {collapsible && (
          <TouchableOpacity
            style={styles.moreChip}
            onPress={() => setExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.moreChipText}>
              {expanded ? "Thu gọn" : `+${hiddenCount} Xem thêm`}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color={Colors.primary} />
            ) : (
              <ChevronDown size={14} color={Colors.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  toggleActive: {
    borderColor: Colors.primary,
    backgroundColor: PRIMARY_TINT,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  toggleBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  panel: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  panelSubtitle: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.primary,
  },
  resetButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY_TINT,
  },
  resetButtonDisabled: {
    backgroundColor: Colors.backgroundTertiary,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  resetTextDisabled: {
    color: Colors.textLight,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginTop: 14,
    paddingTop: 14,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: Colors.backgroundTertiary,
  },
  chipActive: {
    backgroundColor: PRIMARY_TINT,
    borderColor: Colors.primary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  moreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.primary,
  },
  moreChipText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
});

/** Tạo lựa chọn chọn-nhiều (kèm "Tất cả" = bỏ chọn hết) cho FilterSection. */
export function multiSelectOptions<T>(
  items: T[],
  getKey: (item: T) => any,
  getLabel: (item: T) => string,
  selected: any[],
  setSelected: (updater: (prev: any[]) => any[]) => void,
  allLabel: string | null = "Tất cả"
): FilterOption[] {
  const options: FilterOption[] = items.map((item) => {
    const key = getKey(item);
    const active = selected.includes(key);
    return {
      key,
      label: getLabel(item),
      selected: active,
      onPress: () =>
        setSelected((prev) =>
          active ? prev.filter((k) => k !== key) : [...prev, key]
        ),
    };
  });
  if (allLabel == null) return options;
  return [
    {
      key: "__all__",
      label: allLabel,
      selected: selected.length === 0,
      onPress: () => setSelected(() => []),
    },
    ...options,
  ];
}
