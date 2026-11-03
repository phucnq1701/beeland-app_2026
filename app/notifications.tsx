import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Bell, BellOff } from "lucide-react-native";

import { AppHeader, Button, EmptyState, ErrorState, Screen, Skeleton, Text, useToast } from "@/components/ui";
import { relativeTime, type AppNotification } from "@/lib/notifications";
import { colors, radius, space } from "@/theme";
import { NotificationService } from "@/sevicesSupabase/NotificationService";

/**
 * Thông báo — bảng `notifications` (Cloud), cùng nguồn và cách lọc với chuông thông báo web
 * (beeland-dotnet/src/components/Layout/ModuleLayout.tsx). Có thông báo mới → tự tải lại (realtime).
 */
export default function NotificationsScreen() {
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const markingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      setItems(await NotificationService.list());
    } catch (error) {
      console.log("[Notifications] load error:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return NotificationService.subscribe(() => void load());
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unread = items.filter((n) => !n.isRead);

  const markOne = useCallback(
    (item: AppNotification) => {
      if (item.isRead) return;
      NotificationService.markRead([item.id])
        .then(() => setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))))
        .catch(() => toast.show({ type: "error", message: "Không cập nhật được trạng thái đã đọc" }));
    },
    [toast]
  );

  const markAll = async () => {
    if (markingRef.current || unread.length === 0) return;
    markingRef.current = true;
    setMarkingAll(true);
    try {
      await NotificationService.markRead(unread.map((n) => n.id));
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.show({ type: "success", message: "Đã đánh dấu tất cả là đã đọc" });
    } catch {
      toast.show({ type: "error", message: "Không cập nhật được trạng thái đã đọc" });
    } finally {
      markingRef.current = false;
      setMarkingAll(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.isRead ? "" : "Chưa đọc. "}${item.title}`}
        onPress={() => markOne(item)}
        style={({ pressed }) => [styles.card, !item.isRead && styles.cardUnread, pressed && styles.pressed]}
      >
        <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
          <Bell size={18} color={item.isRead ? colors.textTertiary : colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="subhead" numberOfLines={2} style={styles.title}>
              {item.title}
            </Text>
            {!item.isRead ? <View style={styles.dot} /> : null}
          </View>
          {item.message ? (
            <Text variant="caption" color="textSecondary" numberOfLines={3}>
              {item.message}
            </Text>
          ) : null}
          <Text variant="caption" color="textTertiary">
            {relativeTime(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    ),
    [markOne]
  );

  const empty = loading ? (
    <View style={styles.gapList}>
      <Skeleton height={88} radius={radius.xl} />
      <Skeleton height={88} radius={radius.xl} />
      <Skeleton height={88} radius={radius.xl} />
    </View>
  ) : loadError ? (
    <ErrorState onRetry={() => void load()} />
  ) : (
    <EmptyState icon={BellOff} title="Chưa có thông báo nào" />
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll={false} padded={false} header={<AppHeader title="Thông báo" variant="soft" />}>
        <FlatList
          data={loading ? [] : items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={
            !loading && items.length > 0 ? (
              <View style={styles.header}>
                <Text variant="caption" color="textSecondary">
                  {unread.length > 0 ? `${unread.length} thông báo chưa đọc` : "Đã đọc hết"}
                </Text>
                {unread.length > 0 ? (
                  <Button title="Đánh dấu tất cả" variant="ghost" onPress={() => void markAll()} loading={markingAll} />
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingBottom: space.md,
    minHeight: 44,
  },
  gap: { height: space.md },
  gapList: { gap: space.md },
  card: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { backgroundColor: colors.primarySubtle, borderColor: colors.primarySubtle },
  pressed: { opacity: 0.9 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  iconUnread: { backgroundColor: colors.surface },
  body: { flex: 1, gap: space.xs },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  title: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: space.sm },
});
