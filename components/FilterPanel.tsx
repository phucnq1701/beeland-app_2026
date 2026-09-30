import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { colors, radius, space } from "@/theme";

/**
 * Bộ lọc dùng chung cho các màn danh sách (Sản phẩm, Booking, Đặt cọc,
 * Hợp đồng, Căn đã lock) — đảm bảo giao diện đồng bộ trong toàn app.
 * Giữ nguyên tên export và props; giao diện theo design system.
 */

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
    <Pressable
      style={({ pressed }) => [
        styles.toggle,
        highlighted && styles.toggleActive,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={activeCount > 0 ? `Bộ lọc, ${activeCount} đang áp dụng` : "Bộ lọc"}
      accessibilityState={{ expanded: open }}
    >
      <SlidersHorizontal color={highlighted ? colors.primary : colors.inverse} size={18} />
      <Text variant="caption" weight="semibold" color={highlighted ? "primary" : "inverse"}>
        Bộ lọc
      </Text>
      {activeCount > 0 ? (
        <View style={styles.toggleBadge}>
          <Text variant="label" color="onPrimary" style={styles.badgeText}>
            {activeCount}
          </Text>
        </View>
      ) : open ? (
        <ChevronUp color={colors.primary} size={16} />
      ) : (
        <ChevronDown color={colors.inverse} size={16} />
      )}
    </Pressable>
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
  // Màn thấp (360dp) + nhiều dự án/khu/trạng thái: panel tự cuộn, không vượt quá ~nửa màn hình
  const { height } = useWindowDimensions();
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text variant="subhead">Bộ lọc</Text>
        {activeCount > 0 && (
          <Text variant="caption" color="primary">
            {activeCount} đang áp dụng
          </Text>
        )}
        {onReset && (
          <Pressable
            style={[styles.resetButton, !canReset && styles.resetButtonDisabled]}
            onPress={onReset}
            disabled={!canReset}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canReset }}
          >
            <RotateCcw size={14} color={canReset ? colors.primary : colors.textTertiary} />
            <Text variant="caption" weight="semibold" color={canReset ? "primary" : "textTertiary"}>
              Đặt lại
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        style={{ maxHeight: Math.round(height * 0.5) }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {sections.map((section, i) => (
          <View key={i} style={i > 0 ? styles.sectionDivider : undefined}>
            {section}
          </View>
        ))}
      </ScrollView>
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
        <Text variant="label" color="textSecondary" style={styles.sectionTitle}>
          {title}
        </Text>
        {hint ? (
          <Text variant="label" weight="regular" color="textTertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.chips}>
        {visible.map((opt) => (
          <Pressable
            key={String(opt.key)}
            style={({ pressed }) => [
              styles.chip,
              opt.selected && styles.chipActive,
              pressed && !opt.selected && styles.pressed,
            ]}
            onPress={opt.onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: opt.selected }}
          >
            {opt.selected ? (
              <Check size={14} color={colors.onPrimarySubtle} strokeWidth={3} />
            ) : opt.color ? (
              <View style={[styles.chipDot, { backgroundColor: opt.color }]} />
            ) : null}
            <Text
              variant="caption"
              weight={opt.selected ? "semibold" : "medium"}
              color={opt.selected ? "onPrimarySubtle" : "text"}
              numberOfLines={1}
              style={styles.chipText}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
        {collapsible && (
          <Pressable
            style={styles.moreChip}
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
          >
            <Text variant="caption" weight="semibold" color="primary">
              {expanded ? "Thu gọn" : `+${hiddenCount} Xem thêm`}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color={colors.primary} />
            ) : (
              <ChevronDown size={14} color={colors.primary} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  toggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  toggleBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { lineHeight: 16, letterSpacing: 0 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.md,
  },
  resetButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.primarySubtle,
  },
  resetButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: space.md + 2,
    paddingTop: space.md + 2,
  },
  section: {
    gap: space.sm + 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.xs + 2,
  },
  sectionTitle: {
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    maxWidth: "100%",
    minHeight: 36,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    flexShrink: 1,
  },
  moreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
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
