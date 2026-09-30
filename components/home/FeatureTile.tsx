import type { LucideIcon } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

export type FeatureTileProps = {
  feature: { id: string; title: string; icon: LucideIcon };
  onPress: () => void;
  /** Chế độ sửa cấu hình (Tất cả quản lý). */
  editing?: boolean;
  selected?: boolean;
  /** Thứ tự hiển thị khi đã chọn (1-based). */
  order?: number;
};

/** Ô tính năng một tông (nền primarySubtle, icon brand) – thay cho 9 màu cầu vồng cũ. */
function FeatureTileBase({ feature, onPress, editing, selected, order }: FeatureTileProps) {
  const Icon = feature.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={editing && order ? `${feature.title}, thứ tự ${order}` : feature.title}
      accessibilityState={editing ? { selected: !!selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        editing && selected ? styles.selected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.icon}>
        <Icon size={24} color={colors.brand} strokeWidth={2} />
      </View>
      <Text variant="caption" weight="medium" align="center" numberOfLines={2} style={styles.title}>
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
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderWidth: 2, borderColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceMuted },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  title: { minHeight: 40 },
  order: {
    position: "absolute",
    top: space.xs + 2,
    right: space.xs + 2,
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
