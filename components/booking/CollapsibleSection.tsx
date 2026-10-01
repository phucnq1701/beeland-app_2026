import { ChevronDown } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { colors, elevation, radius, space } from "@/theme";

type Props = {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/** Khối thông tin gập/mở trong màn chi tiết (mặc định đóng để màn gọn). Card bo tròn, bóng nhẹ. */
export function CollapsibleSection({ title, count, open, onToggle, children }: Props) {
  return (
    // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
    <View style={styles.card}>
      <View style={styles.clip}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          style={({ pressed }) => [styles.header, pressed ? styles.pressed : null]}
        >
          <Text variant="subhead" style={styles.title}>
            {title}
            {count ? <Text variant="subhead" color="textTertiary">{` (${count})`}</Text> : null}
          </Text>
          <View style={styles.chevron}>
            <ChevronDown
              size={16}
              color={colors.textSecondary}
              strokeWidth={2.5}
              style={open ? styles.chevronOpen : undefined}
            />
          </View>
        </Pressable>
        {open ? <View style={styles.body}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: space.lg + 2,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  title: { flex: 1 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  body: { paddingHorizontal: space.lg + 2, paddingBottom: space.md },
});
