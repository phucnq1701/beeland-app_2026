import React, { memo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Lock } from "lucide-react-native";

const BlockGrid = ({
  block,
  leftRef,
  rightRef,
  scrollYRef,
  localChange,
  handlePressProduct,
  getHexColor,
  styles,
}: {
  block: any;
  leftRef: any;
  rightRef: any;
  scrollYRef: any;
  localChange: any;
  handlePressProduct: any;
  getHexColor: any;
  styles: any;
}) => {
  const rawBlock = block?.rawBlock;
  if (!rawBlock) return null;

  const floors = [...(rawBlock.floor || [])].map((f) => ({
    ...f,
    detailFloor: f.detailFloor || [],
  }));

  const locations = rawBlock.location || [];

  return (
    <View style={styles.blockCard}>
      <Text style={styles.blockTitle}>{block.name}</Text>

      <View style={{ flexDirection: "row" }}>
        {/* LEFT */}
        <View>
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.headerCell]}>
              <Text style={styles.headerCellText}>T\V</Text>
            </View>
          </View>

          <ScrollView
            ref={leftRef}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            // style={{ maxHeight: 500 }}
          >
            {floors.map((floor) => (
              <View
                key={floor.maTang}
                style={{ ...styles.gridRow, marginRight: 3 }}
              >
                <View style={[styles.gridCell, styles.floorCell]}>
                  <Text style={styles.floorCellText}>
                    {floor.tenTang?.replace("Tầng", "T")}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* RIGHT */}
        <ScrollView horizontal>
          <View>
            {/* HEADER */}
            <View style={styles.gridRow}>
              {locations.map((loc: any) => (
                <View
                  key={loc.maVT}
                  style={[styles.gridCell, styles.headerCell]}
                >
                  <Text style={styles.headerCellText}>
                    {loc.tenVT || loc.maVT}
                  </Text>
                </View>
              ))}
            </View>

            {/* BODY */}
            <ScrollView
              ref={rightRef}
              //   style={{ maxHeight: 500 }}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                rightRef.current?.scrollTo({
                  y: scrollYRef.current,
                  animated: false,
                });
              }}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                scrollYRef.current = y;

                leftRef.current?.scrollTo({
                  y,
                  animated: false,
                });
              }}
            >
              {floors.map((floor) => {
                const details = floor.detailFloor || [];

                return (
                  <View key={floor.maTang} style={styles.gridRow}>
                    {locations.map((loc: any) => {
                      const unit = details.find((d: any) => {
                        const vt = d.MaVT ?? d.MaViTri ?? d.ViTri;
                        if (vt == null) return false;
                        return Number(vt) === Number(loc.maVT);
                      });

                      if (!unit) {
                        return (
                          <View
                            key={`${floor.maTang}-${loc.maVT}`}
                            style={styles.gridCell}
                          >
                            <View style={styles.disabledCell}>
                              <Lock size={14} color="#9CA3AF" />
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View
                          key={`${floor.maTang}-${loc.maVT}`}
                          style={styles.gridCell}
                        >
                          <TouchableOpacity
                            style={[
                              styles.unitCell,
                              {
                                backgroundColor:
                                  localChange?.MaTang === floor.maTang &&
                                  localChange?.MaVT === loc.maVT
                                    ? "yellow"
                                    : getHexColor(unit.MauNen),
                              },
                            ]}
                            onPress={() => {
                              if (unit.MaTT !== 2 && unit.MaTT !== 18) return;
                              handlePressProduct(unit.MaSP);
                            }}
                          >
                            <Text style={styles.unitCellText}>
                              {unit.KyHieu}
                            </Text>
                          </TouchableOpacity>
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
    </View>
  );
};

export default memo(BlockGrid);
