import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card, SectionHeader, SkeletonList, Text } from "@/components/ui";
import { colors, space } from "@/theme";

type Props<T> = {
  title: string;
  items: T[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onSeeAll: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyText: string;
};

/** Khối "gần đây" ở trang chủ: mỗi khối tự báo tải / lỗi / rỗng, không ảnh hưởng khối khác. */
export function RecentSection<T>({ title, items, loading, error, onRetry, onSeeAll, renderItem, emptyText }: Props<T>) {
  const body = (() => {
    if (loading && items.length === 0) return <SkeletonList count={3} />;
    const retryRow = (
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.message}>
        <Text variant="caption" color="danger">
          {items.length ? "Không cập nhật được ·" : "Không tải được ·"}{" "}
        </Text>
        <Text variant="caption" weight="semibold" color="primary">
          Thử lại
        </Text>
      </Pressable>
    );
    if (error && items.length === 0) return retryRow;
    if (items.length === 0) {
      return (
        <View style={styles.message}>
          <Text variant="caption" color="textSecondary">
            {emptyText}
          </Text>
        </View>
      );
    }
    // Làm mới lỗi nhưng còn dữ liệu cũ → vẫn hiện dữ liệu cũ, kèm dòng báo lỗi + Thử lại ở trên
    return (
      <>
        {error ? retryRow : null}
        {items.map((item, i) => (
          <View key={i} style={i > 0 || error ? styles.divider : null}>
            {renderItem(item, i)}
          </View>
        ))}
      </>
    );
  })();

  return (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel="Xem tất cả" onAction={onSeeAll} />
      <Card padding={0} style={styles.card}>
        {body}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, paddingHorizontal: space.lg },
  card: { overflow: "hidden" },
  message: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
