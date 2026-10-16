import { ChevronRight, type LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Icon đứng trước nhãn nút (vd "+ Thêm mới"); có icon thì bỏ mũi tên ›. */
  actionIcon?: LucideIcon;
};

/** Tiêu đề khối ở trang chủ: chữ thường, đậm vừa + nút "Xem tất cả" dạng viên thuốc. */
export function HomeSectionHeader({ title, actionLabel, onAction, actionIcon: ActionIcon }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.action, ActionIcon ? styles.actionWithIcon : null, pressed ? styles.pressed : null]}
        >
          {ActionIcon ? <ActionIcon size={15} color={colors.primary} strokeWidth={2.5} /> : null}
          <Text variant="label" color="primary" style={styles.actionText}>
            {actionLabel}
          </Text>
          {ActionIcon ? null : <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: 32,
  },
  title: { flex: 1 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primarySubtle,
  },
  actionWithIcon: { gap: space.xs, paddingLeft: space.sm + 2, paddingRight: space.md },
  pressed: { opacity: 0.7 },
  actionText: { letterSpacing: 0 },
});
