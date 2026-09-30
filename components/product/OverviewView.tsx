import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Card, Chip, EmptyState, Text } from "@/components/ui";
import { buildOverviewFloors, overviewSummary, SummaryKey } from "@/lib/productOverview";
import { CatalogStatus, unitStatusOf } from "@/lib/productRealtime";
import { unitStatusMeta } from "@/lib/productStatus";
import { colors, space } from "@/theme";

import { UnitCell } from "./UnitCell";

/** Tone trạng thái → cặp màu nền/chữ đạt tương phản (thay nền đậm + chữ trắng cũ). */
const TONE_COLORS: Record<string, { bg: string; fg: string }> = {
  success: { bg: colors.successSubtle, fg: colors.onSuccessSubtle },
  info: { bg: colors.infoSubtle, fg: colors.onInfoSubtle },
  warning: { bg: colors.warningSubtle, fg: colors.onWarningSubtle },
  brand: { bg: colors.primarySubtle, fg: colors.onPrimarySubtle },
  danger: { bg: colors.dangerSubtle, fg: colors.onDangerSubtle },
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
};

type Props = {
  dataGrid: any[];
  /** Danh mục trạng thái (FilterService.getStatusSP) – nhận trạng thái theo mã, đổi đúng khi realtime. */
  catalog: CatalogStatus[];
  selected: SummaryKey;
  onSelect: (key: SummaryKey) => void;
  onPressUnit: (id: string) => void;
};

/** Chế độ "Tổng quan": tóm tắt số căn theo trạng thái + từng tầng dạng lưới ô. */
export function OverviewView({ dataGrid, catalog, selected, onSelect, onPressUnit }: Props) {
  const floors = useMemo(
    () => buildOverviewFloors(dataGrid, (item) => unitStatusOf(item, catalog)),
    [dataGrid, catalog]
  );
  const summary = useMemo(() => overviewSummary(floors), [floors]);

  const visibleFloors = floors
    .map((f) => ({ ...f, shown: selected === "all" ? f.units : f.units.filter((u) => u.status === selected) }))
    .filter((f) => f.shown.length > 0);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {summary.map((s) => (
          <Chip key={s.key} label={s.label} count={s.count} selected={selected === s.key} onPress={() => onSelect(s.key)} />
        ))}
      </ScrollView>

      {visibleFloors.length === 0 ? (
        <EmptyState title="Không có căn nào" description="Thử chọn trạng thái khác." />
      ) : null}

      {visibleFloors.map((floor) => (
        <Card key={floor.id}>
          <View style={styles.floorHead}>
            <Text variant="subhead">{floor.name}</Text>
            <Text variant="caption" color="textSecondary">
              {floor.shown.length}/{floor.totalUnits} căn
            </Text>
          </View>
          <View style={styles.grid}>
            {floor.shown.map((unit, index) => {
              const meta = unitStatusMeta(unit.status);
              const c = TONE_COLORS[meta.tone];
              return (
                <UnitCell
                  key={unit.id ?? `${floor.id}-${index}`}
                  id={unit.id}
                  code={unit.code}
                  sub={unit.price || undefined}
                  bg={c.bg}
                  fg={c.fg}
                  accessibilityLabel={`Căn ${unit.code || "không rõ mã"}, ${meta.label}`}
                  onPress={onPressUnit}
                />
              );
            })}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  floorHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
