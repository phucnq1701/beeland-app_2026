import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { IconButton, Text } from "@/components/ui";
import { addMonths, monthGrid, WEEKDAY_SHORT } from "@/lib/signing";
import { colors, elevation, radius, space } from "@/theme";

/**
 * Lịch tháng gọn cho mobile: mỗi ô là 1 ngày, chấm + số lượng lịch ký của ngày; chạm để chọn ngày.
 * Dùng chung cho chế độ "Lịch" của danh sách (counts = số lịch ký) và chọn ngày ở form (counts = lượt còn trống).
 */
export function SigningCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  counts,
  mode = "events",
  disablePast = false,
  flat = false,
}: {
  /** Một ngày bất kỳ trong tháng đang xem (YYYY-MM-DD) */
  month: string;
  onMonthChange: (anyDay: string) => void;
  selected: string | null;
  onSelect: (day: string) => void;
  today: string;
  counts: Record<string, number>;
  /** events: số lịch ký; slots: lượt còn trống (0 = hết chỗ) */
  mode?: "events" | "slots";
  disablePast?: boolean;
  /** Nằm trong card khác: bỏ lề ngoài, nền và bóng */
  flat?: boolean;
}) {
  const grid = monthGrid(month);
  const monthKey = month.slice(0, 7);
  return (
    <View style={flat ? styles.flat : styles.card}>
      <View style={styles.head}>
        <IconButton
          icon={ChevronLeft}
          variant="soft"
          accessibilityLabel="Tháng trước"
          onPress={() => onMonthChange(addMonths(month, -1))}
        />
        <Text variant="subhead" style={styles.title}>
          Tháng {month.slice(5, 7)}/{month.slice(0, 4)}
        </Text>
        <IconButton
          icon={ChevronRight}
          variant="soft"
          accessibilityLabel="Tháng sau"
          onPress={() => onMonthChange(addMonths(month, 1))}
        />
      </View>
      <View style={styles.row}>
        {WEEKDAY_SHORT.map((d) => (
          <Text key={d} variant="label" color="textTertiary" align="center" style={styles.cell}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={styles.row}>
          {grid.slice(w * 7, w * 7 + 7).map((day) => {
            const inMonth = day.slice(0, 7) === monthKey;
            const past = day < today;
            const disabled = !inMonth || (disablePast && past);
            const active = selected === day;
            const n = counts[day];
            const full = mode === "slots" && n !== undefined && n <= 0;
            const hasDot = mode === "events" ? (n ?? 0) > 0 : n !== undefined && !full;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={`Ngày ${day.slice(8, 10)}/${day.slice(5, 7)}${
                  mode === "events"
                    ? n
                      ? `, ${n} lịch ký`
                      : ""
                    : full
                      ? ", hết chỗ"
                      : n !== undefined
                        ? `, còn ${n} chỗ`
                        : ""
                }`}
                disabled={disabled}
                onPress={() => onSelect(day)}
                style={[styles.cell, styles.day, active ? styles.dayActive : full && inMonth ? styles.dayFull : null]}
              >
                <Text
                  variant="caption"
                  weight={active || day === today ? "semibold" : undefined}
                  color={active ? "onPrimary" : disabled ? "textTertiary" : day === today ? "primary" : "text"}
                  style={!inMonth ? styles.faded : null}
                >
                  {Number(day.slice(8, 10))}
                </Text>
                {inMonth && hasDot ? (
                  <Text
                    variant="label"
                    color={active ? "onPrimary" : mode === "slots" ? "success" : "primary"}
                    style={styles.count}
                  >
                    {n}
                  </Text>
                ) : inMonth && full ? (
                  <Text variant="label" color="danger" style={styles.count}>
                    Hết
                  </Text>
                ) : (
                  <View style={styles.countSpace} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.xl,
    padding: space.md,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    gap: 2,
    ...elevation.soft,
  },
  flat: { gap: 2 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: space.sm },
  title: { flex: 1, textAlign: "center" },
  row: { flexDirection: "row" },
  cell: { flex: 1 },
  day: { alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: radius.md, margin: 1 },
  dayActive: { backgroundColor: colors.primary },
  dayFull: { backgroundColor: colors.dangerSubtle },
  faded: { opacity: 0.4 },
  count: { lineHeight: 16 },
  countSpace: { height: 16 },
});
