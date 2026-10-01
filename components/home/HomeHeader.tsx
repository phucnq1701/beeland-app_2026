import type { LucideIcon } from "lucide-react-native";
import { Bell, Search } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { colors, elevation, hitSlop, MIN_TOUCH, space } from "@/theme";

type Props = {
  name?: string | null;
  onSearchPress: () => void;
  onBellPress: () => void;
};

function RoundButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed ? styles.pressed : null]}
    >
      <Icon size={20} color={colors.inverse} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * Đầu trang chủ. Chuông không hiển thị số chưa đọc: màn Thông báo đang dùng dữ liệu mẫu
 * (quyết định Q1 – GĐ2), hiện số sẽ là số giả.
 */
export function HomeHeader({ name, onSearchPress, onBellPress }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text variant="caption" color="textSecondary">
          Xin chào 👋
        </Text>
        <Text variant="title" numberOfLines={1} accessibilityRole="header" style={styles.name}>
          {name || "Beeland Sales"}
        </Text>
      </View>
      <RoundButton icon={Search} label="Tìm sản phẩm" onPress={onSearchPress} />
      <RoundButton icon={Bell} label="Thông báo" onPress={onBellPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm + 2,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    backgroundColor: colors.bg,
  },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 24, lineHeight: 30 },
  round: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  pressed: { opacity: 0.6 },
});
