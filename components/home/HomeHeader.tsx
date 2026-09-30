import { Bell, Search } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { IconButton, Text } from "@/components/ui";
import { colors, space } from "@/theme";

type Props = {
  name?: string | null;
  onSearchPress: () => void;
  onBellPress: () => void;
};

/**
 * Đầu trang chủ. Chuông không hiển thị số chưa đọc: màn Thông báo đang dùng dữ liệu mẫu
 * (quyết định Q1 – GĐ2), hiện số sẽ là số giả.
 */
export function HomeHeader({ name, onSearchPress, onBellPress }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text variant="caption" color="textSecondary">
          Xin chào
        </Text>
        <Text variant="title" numberOfLines={1} accessibilityRole="header">
          {name || "Beeland Sales"}
        </Text>
      </View>
      <IconButton icon={Search} accessibilityLabel="Tìm sản phẩm" variant="filled" onPress={onSearchPress} />
      <IconButton icon={Bell} accessibilityLabel="Thông báo" variant="filled" onPress={onBellPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    backgroundColor: colors.bg,
  },
  texts: { flex: 1 },
});
