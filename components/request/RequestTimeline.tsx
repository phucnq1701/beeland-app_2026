import React from "react";
import { StyleSheet, View } from "react-native";

import { StatusBadge, Text } from "@/components/ui";
import type { RequestLog } from "@/lib/customerRequest";
import { formatDateTime } from "@/lib/format";
import { colors, radius, space } from "@/theme";

const DOT = 12;

/**
 * Lịch sử xử lý (fn_customer_request_logs, mới nhất trên): chấm + đường dọc, mỗi mục có trạng thái (nếu đổi),
 * nội dung, ngày giờ · người xử lý. Web hiện dạng bảng (RequestDetailDrawer) – cùng cột.
 */
export function RequestTimeline({ items }: { items: RequestLog[] }) {
  if (!items.length) {
    return (
      <Text variant="caption" color="textSecondary">
        Chưa có lịch sử xử lý.
      </Text>
    );
  }
  return (
    <View>
      {items.map((l, i) => {
        const last = i === items.length - 1;
        return (
          <View key={l.id || String(i)} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, i === 0 ? styles.dotFirst : null]} />
              {last ? null : <View style={styles.line} />}
            </View>
            <View style={[styles.body, last ? null : styles.bodyGap]}>
              {l.statusName ? <StatusBadge label={l.statusName} color={l.color} size="sm" /> : null}
              <Text variant="body">{l.note || "—"}</Text>
              <Text variant="caption" color="textTertiary">
                {[l.at ? formatDateTime(l.at) : null, l.by || null].filter(Boolean).join(" · ") || "—"}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  rail: { width: DOT, alignItems: "center" },
  dot: {
    width: DOT,
    height: DOT,
    marginTop: space.xs,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  dotFirst: { borderColor: colors.primary, backgroundColor: colors.primary },
  line: { flex: 1, width: 2, marginVertical: 2, backgroundColor: colors.border },
  body: { flex: 1, gap: space.xs },
  bodyGap: { paddingBottom: space.lg },
});
