import React, { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui";
import { statusTextColorOf } from "@/components/utils/statusColor";
import { colors, radius } from "@/theme";

export const UNIT_CELL_SIZE = 56;

type Props = {
  code: string;
  /** Màu nền (hex) – từ dữ liệu hoặc từ token trạng thái. */
  bg: string;
  /** Màu chữ; bỏ trống → tự tính theo nền cho đủ tương phản. */
  fg?: string;
  /** Dòng phụ nhỏ (vd giá). */
  sub?: string;
  /** Vừa đổi trạng thái (realtime) → viền nổi bật trong giây lát. */
  highlight?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Ô căn trong chế độ Lưới / Tổng quan. Kích thước ≥ 44 để dễ chạm. */
function UnitCellBase({ code, bg, fg, sub, highlight, onPress, accessibilityLabel }: Props) {
  const color = fg ?? statusTextColorOf(bg);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Căn ${code}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
        highlight ? styles.highlight : null,
      ]}
    >
      <Text variant="label" color={color} numberOfLines={1} style={styles.code}>
        {code}
      </Text>
      {sub ? (
        <Text variant="label" weight="regular" color={color} numberOfLines={1} style={styles.code}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const UnitCell = memo(UnitCellBase);

const styles = StyleSheet.create({
  cell: {
    minWidth: UNIT_CELL_SIZE,
    minHeight: UNIT_CELL_SIZE - 12,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  highlight: { borderWidth: 3, borderColor: colors.brand },
  code: { letterSpacing: 0 },
});
