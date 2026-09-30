import React from "react";
import { StyleSheet, View } from "react-native";

import { space } from "@/theme";

import { FeatureTile, FeatureTileProps } from "./FeatureTile";

type Item = Omit<FeatureTileProps, "feature"> & { key: string; feature: FeatureTileProps["feature"] };

/** Lưới ô tính năng `columns` cột; hàng cuối thiếu ô được lấp khoảng trống để ô không giãn. */
export function FeatureGrid({ items, columns = 3 }: { items: Item[]; columns?: number }) {
  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map(({ key, ...tile }) => (
            <FeatureTile key={key} {...tile} />
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
  grid: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  pad: { flex: 1 },
});
