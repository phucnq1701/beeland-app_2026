import React from "react";
import { StyleSheet, View } from "react-native";

import { space } from "@/theme";

import { FeatureTile, FeatureTileProps } from "./FeatureTile";

type Item = Omit<FeatureTileProps, "feature"> & {
  key: string;
  feature: FeatureTileProps["feature"];
};

/** Lưới ô tính năng `columns` cột; hàng cuối thiếu ô được lấp khoảng trống để ô không giãn. */
export function FeatureGrid({
  items,
  columns = 3,
  compact,
}: {
  items: Item[];
  columns?: number;
  /** Ô nhỏ (thường đi với columns=4). */
  compact?: boolean;
}) {
  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={[styles.grid, compact ? styles.compactGap : null]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.row, compact ? styles.compactGap : null]}>
          {row.map(({ key, ...tile }) => (
            <FeatureTile key={key} compact={compact} {...tile} />
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`pad-${i}`} style={styles.pad} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  pad: { flex: 1 },
  compactGap: { gap: space.sm + 2 },
});
