import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SkeletonList, Text } from "@/components/ui";
import { colors, elevation, radius, space } from "@/theme";

import { HomeSectionHeader } from "./HomeSectionHeader";

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
    if (loading && items.length === 0) {
      return (
        <View style={[styles.card, styles.clip]}>
          <SkeletonList count={3} />
        </View>
      );
    }
    const retryRow = (
      <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.card, styles.message]}>
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
        <View style={[styles.card, styles.message]}>
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
          // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
          <View key={i} style={styles.card}>
            <View style={styles.clip}>{renderItem(item, i)}</View>
          </View>
        ))}
      </>
    );
  })();

  return (
    <View style={styles.section}>
      <HomeSectionHeader title={title} actionLabel="Xem tất cả" onAction={onSeeAll} />
      <View style={styles.list}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md, paddingHorizontal: space.xl },
  list: { gap: space.sm + 2 },
  card: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  message: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
});
