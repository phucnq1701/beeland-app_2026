import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AlarmClock, Paperclip } from "lucide-react-native";

import { Badge, StatusBadge, Text } from "@/components/ui";
import type { CustomerRequest, YcCat } from "@/lib/customerRequest";
import { formatDateTime } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";

/** Màu / tên danh mục theo mã; không có trong danh mục → tên máy chủ trả về. */
export function catMeta(list: YcCat[], code: string | null, fallbackName: string) {
  const hit = code ? list.find((c) => c.ID === code) : undefined;
  return { name: hit?.Name || fallbackName || "", color: hit?.Color ?? null };
}

/**
 * 1 yêu cầu dạng card bo `radius.xxl` (như danh sách lịch ký / khách hàng).
 * Dòng 1: mã YC · nguồn | trạng thái; tiêu đề 2 dòng; khách · SĐT; ngày tiếp nhận · người xử lý | ưu tiên / quá hạn.
 */
function RequestRowItemBase({
  item,
  statuses,
  priorities,
  overdue,
  onPress,
}: {
  item: CustomerRequest;
  statuses: YcCat[];
  priorities: YcCat[];
  overdue: boolean;
  onPress: () => void;
}) {
  const status = catMeta(statuses, item.status, item.statusName);
  const priority = catMeta(priorities, item.priority, item.priorityName);
  const customer = [item.customerName, item.customerPhone].filter(Boolean).join(" · ");
  const meta = [
    item.createdAt ? formatDateTime(item.createdAt) : null,
    item.assigneeName ? `XL: ${item.assigneeName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Yêu cầu ${item.code}, ${item.title}, ${status.name || "chưa có trạng thái"}${overdue ? ", quá hạn" : ""}`}
        onPress={onPress}
        style={({ pressed }) => [styles.inner, pressed ? styles.pressed : null]}
      >
        <View style={styles.top}>
          <Text variant="label" color="primary" numberOfLines={1} style={styles.flex}>
            {[item.code, item.sourceName].filter(Boolean).join(" · ")}
          </Text>
          {status.name ? <StatusBadge label={status.name} color={status.color} size="sm" /> : null}
        </View>
        <Text variant="subhead" numberOfLines={2}>
          {item.title || "(Không có tiêu đề)"}
        </Text>
        {customer ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {customer}
          </Text>
        ) : null}
        <View style={styles.bottom}>
          <Text variant="caption" color="textTertiary" numberOfLines={1} style={styles.flex}>
            {meta || "—"}
          </Text>
          {item.attachments.length ? (
            <View style={styles.clip}>
              <Paperclip size={13} color={colors.textTertiary} />
              <Text variant="label" color="textTertiary">
                {item.attachments.length}
              </Text>
            </View>
          ) : null}
          {overdue ? <Badge label="Quá hạn" tone="danger" icon={AlarmClock} /> : null}
          {!overdue && priority.name ? <StatusBadge label={priority.name} color={priority.color} size="sm" /> : null}
        </View>
      </Pressable>
    </View>
  );
}

export const RequestRowItem = memo(RequestRowItemBase);

const styles = StyleSheet.create({
  // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  inner: {
    borderRadius: radius.xxl,
    overflow: "hidden",
    paddingHorizontal: space.lg + 2,
    paddingVertical: space.md + 2,
    gap: space.xs,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 2 },
  clip: { flexDirection: "row", alignItems: "center", gap: 2 },
});
