import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

import { Badge, ListItem, Text } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { statusMeta, timeOf, type SigningRow } from "@/lib/signing";
import { colors, elevation, radius, space } from "@/theme";

/** 1 lịch ký dạng card bo tròn (danh sách + chế độ lịch). Cột phải: trạng thái trên, giờ ký dưới. */
function SigningRowItemBase({
  row,
  onPress,
  showDate = true,
}: {
  row: SigningRow;
  onPress: () => void;
  showDate?: boolean;
}) {
  const meta = statusMeta(row.State);
  const when = row.NgayBookKy
    ? [showDate ? formatDate(row.NgayBookKy) : null, row.TenCa || null].filter(Boolean).join(" · ")
    : "Chưa có ngày ký";
  return (
    // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
    <View style={styles.card}>
      <View style={styles.clip}>
        <ListItem
          title={row.MaCan || "—"}
          subtitle={[row.TenKH, row.TenDA].filter(Boolean).join(" · ") || undefined}
          meta={[when, row.DaiLy].filter(Boolean).join(" · ")}
          onPress={onPress}
          accessibilityLabel={`Lịch ký ${row.MaCan || ""}, ${row.TenKH || ""}, ${meta.label}`}
          trailing={
            <View style={styles.trailing}>
              <Badge label={meta.label} tone={meta.tone} />
              {row.NgayBookKy ? (
                <Text variant="subhead" numeric>
                  {timeOf(row.NgayBookKy)}
                </Text>
              ) : null}
            </View>
          }
        />
      </View>
    </View>
  );
}

export const SigningRowItem = memo(SigningRowItemBase);

const styles = StyleSheet.create({
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  trailing: { alignItems: "flex-end", gap: space.xs },
});
