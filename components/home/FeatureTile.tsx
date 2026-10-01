import type { LucideIcon } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { colors, elevation, radius, space } from "@/theme";

export type FeatureTileProps = {
  feature: { id: string; title: string; icon: LucideIcon };
  onPress: () => void;
  /** Chế độ sửa cấu hình (Tất cả quản lý). */
  editing?: boolean;
  selected?: boolean;
  /** Thứ tự hiển thị khi đã chọn (1-based). */
  order?: number;
  /** Ô nhỏ cho lưới 4 cột (Tất cả quản lý). */
  compact?: boolean;
};

/** Ô tính năng bo tròn lớn, bóng mềm, icon trong vòng tròn primarySubtle. */
function FeatureTileBase({ feature, onPress, editing, selected, order, compact }: FeatureTileProps) {
  const Icon = feature.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={editing && order ? `${feature.title}, thứ tự ${order}` : feature.title}
      accessibilityState={editing ? { selected: !!selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        compact ? styles.compactTile : null,
        editing && selected ? styles.selected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.icon, compact ? styles.compactIcon : null]}>
        <Icon size={compact ? 18 : 22} color={colors.brand} strokeWidth={2} />
      </View>
      <Text
        variant="caption"
        weight="medium"
        align="center"
        numberOfLines={2}
        style={compact ? styles.compactTitle : styles.title}
      >
        {feature.title}
      </Text>
      {editing && selected && order ? (
        <View style={styles.order}>
          <Text variant="label" color="onPrimary" style={styles.orderText}>
            {order}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const FeatureTile = memo(FeatureTileBase);

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 104,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm + 2,
    paddingVertical: space.lg + 2,
    paddingHorizontal: space.xs,
    borderRadius: radius.xxl,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  // Lưới 4 cột: ô thấp hơn, icon nhỏ hơn, bo vừa
  compactTile: { minHeight: 84, gap: space.sm, paddingVertical: space.md + 2, borderRadius: radius.xl },
  compactIcon: { width: 40, height: 40 },
  compactTitle: { fontSize: 12, lineHeight: 16 },
  selected: { borderColor: colors.primary },
  pressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.97 }],
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  // Không giữ chỗ 2 dòng: các ô cùng hàng tự cao bằng nhau (row stretch), nội dung căn giữa.
  title: { fontSize: 13, lineHeight: 18 },
  order: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  orderText: { letterSpacing: 0, lineHeight: 16 },
});
