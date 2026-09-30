import React, { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Lock } from "lucide-react-native";

import { Card, Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

import { UNIT_CELL_SIZE, UnitCell } from "./UnitCell";

const CELL_GAP = 4;
const ROW_H = UNIT_CELL_SIZE - 12 + CELL_GAP;

/**
 * Lưới căn của một khu: cột trái là tầng (cuộn dọc đồng bộ), bên phải cuộn ngang theo vị trí.
 * Màu ô lấy từ dữ liệu (ColorTT / MauNen); ô vừa đổi trạng thái (realtime) được viền nổi bật.
 */
const BlockGrid = ({
  block,
  leftRef,
  rightRef,
  scrollYRef,
  localChange,
  handlePressProduct,
  getHexColor,
}: {
  block: any;
  leftRef: any;
  rightRef: any;
  scrollYRef: any;
  localChange: any;
  handlePressProduct: (id: string) => void;
  getHexColor: (n: any) => string;
}) => {
  const rawBlock = block?.rawBlock;
  if (!rawBlock) return null;

  const floors = [...(rawBlock.floor || [])].map((f) => ({
    ...f,
    detailFloor: f.detailFloor || [],
  }));

  const locations = rawBlock.location || [];

  const unitColor = (unit: any): string =>
    unit.ColorTT ||
    (typeof unit.MauNen === "string" && unit.MauNen.startsWith("#") ? unit.MauNen : getHexColor(unit.MauNen)) ||
    colors.surfaceMuted;

  return (
    <Card>
      <Text variant="subhead" style={styles.title}>
        {block.name}
      </Text>

      <View style={styles.row}>
        {/* Cột tầng */}
        <View>
          <View style={[styles.cell, styles.headCell]}>
            <Text variant="label" color="textTertiary">
              T\V
            </Text>
          </View>
          <ScrollView ref={leftRef} scrollEnabled={false} showsVerticalScrollIndicator={false}>
            {floors.map((floor) => (
              <View key={floor.maTang} style={[styles.cell, styles.floorCell]}>
                <Text variant="label" color="textSecondary">
                  {floor.tenTang?.replace("Tầng", "T")}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Lưới vị trí */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.row}>
              {locations.map((loc: any) => (
                <View key={loc.maVT} style={[styles.cell, styles.headCell]}>
                  <Text variant="label" color="textTertiary" numberOfLines={1}>
                    {loc.tenVT || loc.maVT}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView
              ref={rightRef}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                rightRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
              }}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                scrollYRef.current = y;
                leftRef.current?.scrollTo({ y, animated: false });
              }}
            >
              {floors.map((floor) => {
                const details = floor.detailFloor || [];
                return (
                  <View key={floor.maTang} style={styles.row}>
                    {locations.map((loc: any) => {
                      const unit = details.find((d: any) => {
                        const vt = d.MaVT ?? d.MaViTri ?? d.ViTri;
                        if (vt == null) return false;
                        // ma_tang/vi_tri là uuid → so khớp bằng chuỗi
                        return String(vt) === String(loc.maVT);
                      });

                      if (!unit) {
                        return (
                          <View key={`${floor.maTang}-${loc.maVT}`} style={[styles.cell, styles.empty]}>
                            <Lock size={14} color={colors.textTertiary} />
                          </View>
                        );
                      }

                      const changed =
                        String(localChange?.MaTang) === String(floor.maTang) &&
                        String(localChange?.MaVT) === String(loc.maVT);

                      return (
                        <View key={`${floor.maTang}-${loc.maVT}`} style={styles.cell}>
                          <UnitCell
                            code={unit.KyHieu}
                            bg={unitColor(unit)}
                            highlight={changed}
                            onPress={() => handlePressProduct(unit.MaSP)}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </Card>
  );
};

export default memo(BlockGrid);

const styles = StyleSheet.create({
  title: { marginBottom: space.sm },
  row: { flexDirection: "row" },
  cell: {
    width: UNIT_CELL_SIZE + CELL_GAP,
    height: ROW_H,
    alignItems: "center",
    justifyContent: "center",
  },
  headCell: { height: 28 },
  floorCell: { alignItems: "flex-start", paddingLeft: 2, width: 40 },
  empty: {
    margin: CELL_GAP / 2,
    width: UNIT_CELL_SIZE,
    height: UNIT_CELL_SIZE - 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
});
