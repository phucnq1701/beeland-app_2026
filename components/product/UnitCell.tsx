import React, { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui";
import { statusTextColorOf } from "@/components/utils/statusColor";
import { colors, radius } from "@/theme";

export const UNIT_CELL_SIZE = 56;

type Props = {
  /** Mã sản phẩm – truyền lại cho onPress (để onPress ổn định, memo có tác dụng). */
  id: string;
  code: string;
  /** Màu nền (hex) – từ dữ liệu hoặc từ token trạng thái. */
  bg: string;
  /** Màu chữ; bỏ trống → tự tính theo nền cho đủ tương phản. */
  fg?: string;
  /** Dòng phụ nhỏ (vd giá). */
  sub?: string;
  /** Vừa đổi trạng thái (realtime) → viền nổi bật trong giây lát. */
  highlight?: boolean;
  onPress: (id: string) => void;
  accessibilityLabel?: string;
};

/** Ô căn trong chế độ Lưới / Tổng quan. Kích thước ≥ 44 để dễ chạm. */
function UnitCellBase({ id, code, bg, fg, sub, highlight, onPress, accessibilityLabel }: Props) {
  const color = fg ?? statusTextColorOf(bg);
  const label = code || "—";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Căn ${label}`}
      onPress={() => onPress(id)}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
        highlight ? styles.highlight : null,
      ]}
    >
      {/* Ô rộng cố định: mã dài thì tự thu nhỏ chữ, không tràn sang ô bên cạnh */}
      <Text
        variant="label"
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        allowFontScaling={false}
        style={styles.code}
      >
        {label}
      </Text>
      {sub ? (
        <Text
          variant="label"
          weight="regular"
          color={color}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          allowFontScaling={false}
          style={styles.code}
        >
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const UnitCell = memo(UnitCellBase);

const styles = StyleSheet.create({
  cell: {
    width: UNIT_CELL_SIZE,
    overflow: "hidden",
    minHeight: UNIT_CELL_SIZE - 12,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  highlight: { borderWidth: 3, borderColor: colors.brand },
  code: { letterSpacing: 0, maxWidth: UNIT_CELL_SIZE - 8, textAlign: "center" },
});
