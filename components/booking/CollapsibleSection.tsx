import { ChevronDown } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card, Text } from "@/components/ui";
import { colors, space } from "@/theme";

type Props = {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/** Khối thông tin gập/mở trong màn chi tiết (mặc định đóng để màn gọn). */
export function CollapsibleSection({ title, count, open, onToggle, children }: Props) {
  return (
    <Card padding={0}>
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
        <ChevronDown
          size={20}
          color={colors.textTertiary}
          style={open ? styles.chevronOpen : undefined}
        />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: space.lg,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  title: { flex: 1 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  body: { paddingHorizontal: space.lg, paddingBottom: space.md },
});
