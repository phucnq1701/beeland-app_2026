import React, { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Lock } from "lucide-react-native";

import { Card, Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

import { UNIT_CELL_SIZE, UnitCell } from "./UnitCell";

const CELL_GAP = 4;
const ROW_H = UNIT_CELL_SIZE - 12 + CELL_GAP;
const HEAD_H = 28;

/**
 * Lưới căn của một khu – kiểu bảng "cố định cột trái":
 *  - Cột tầng đứng yên bên trái, phần căn cuộn NGANG theo vị trí.
 *  - Cuộn DỌC do cả trang đảm nhận; hàng tầng và hàng căn cùng chiều cao (ROW_H) trong cùng
 *    một khối nên luôn thẳng hàng (bản cũ dùng 2 ScrollView dọc lồng nhau + đồng bộ bằng ref,
 *    thực tế không cuộn được và lệch khi có nhiều khu).
 * Màu ô lấy từ dữ liệu (ColorTT / MauNen); ô vừa đổi trạng thái (realtime) được viền nổi bật.
 */
const BlockGrid = ({
  block,
  localChange,
  handlePressProduct,
  getHexColor,
}: {
  block: any;
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
        {/* Cột tầng (cố định) */}
        <View style={styles.floorCol}>
          <View style={[styles.floorCell, styles.headRow]}>
            <Text variant="label" color="textTertiary">
              T\V
            </Text>
          </View>
          {floors.map((floor) => (
            <View key={floor.maTang} style={styles.floorCell}>
              <Text variant="label" color="textSecondary" numberOfLines={1}>
                {floor.tenTang?.replace("Tầng", "T")}
              </Text>
            </View>
          ))}
        </View>

        {/* Phần căn (cuộn ngang) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
          <View>
            <View style={[styles.row, styles.headRow]}>
              {locations.map((loc: any) => (
                <View key={loc.maVT} style={[styles.cell, styles.headRow]}>
                  <Text variant="label" color="textTertiary" numberOfLines={1}>
                    {loc.tenVT || loc.maVT}
                  </Text>
                </View>
              ))}
            </View>

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
                        <View key={`${floor.maTang}-${loc.maVT}`} style={styles.cell}>
                          <View style={styles.empty}>
                            <Lock size={14} color={colors.textTertiary} />
                          </View>
                        </View>
                      );
                    }

                    const changed =
                      String(localChange?.MaTang) === String(floor.maTang) &&
                      String(localChange?.MaVT) === String(loc.maVT);

                    return (
                      <View key={`${floor.maTang}-${loc.maVT}`} style={styles.cell}>
                        <UnitCell
                          id={unit.MaSP}
                          code={unit.KyHieu}
                          bg={unitColor(unit)}
                          highlight={changed}
                          onPress={handlePressProduct}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Card>
  );
};

export default memo(BlockGrid);

const styles = StyleSheet.create({
  title: { marginBottom: space.sm },
  flex: { flex: 1 },
  row: { flexDirection: "row" },
  floorCol: { width: 40 },
  headRow: { height: HEAD_H },
  floorCell: { height: ROW_H, justifyContent: "center", paddingLeft: 2 },
  cell: {
    width: UNIT_CELL_SIZE + CELL_GAP,
    height: ROW_H,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    width: UNIT_CELL_SIZE,
    height: UNIT_CELL_SIZE - 12,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
});
