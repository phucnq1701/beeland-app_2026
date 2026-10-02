import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { ChevronRight, Folder, FolderX, Share2 } from "lucide-react-native";

import { AppHeader, EmptyState, ErrorState, Screen, SkeletonList, Text } from "@/components/ui";
import { colors, elevation, hitSlop, radius, space } from "@/theme";

export type FolderItem = { id: string; name: string; count?: number | null; cover?: string | null; note?: string | null; raw?: any };

/** Danh sách thư mục (tài liệu / ảnh / video của dự án): tải, kéo làm mới, mở thư mục, chia sẻ (tuỳ chọn). */
export function FolderListScreen({
  title,
  countUnit,
  load,
  onOpen,
  onShare,
  emptyTitle,
}: {
  title: string;
  countUnit: string;
  load: () => Promise<FolderItem[]>;
  onOpen: (f: FolderItem) => void;
  onShare?: (f: FolderItem) => void;
  emptyTitle: string;
}) {
  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const run = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        setItems(await load());
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load]
  );

  useEffect(() => {
    void run();
  }, [run]);

  const total = items.reduce((s, f) => s + (Number(f.count) || 0), 0);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={<AppHeader variant="soft" title={title} subtitle={loading ? undefined : `${items.length} thư mục${total ? ` · ${total} ${countUnit}` : ""}`} />}
      >
        <FlatList
          data={loading || error ? [] : items}
          keyExtractor={(f, i) => `${f.id}-${i}`}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void run(true)} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            loading ? (
              <SkeletonList />
            ) : error ? (
              <ErrorState description="Không tải được danh sách thư mục." onRetry={() => void run()} />
            ) : (
              <EmptyState icon={FolderX} title={emptyTitle} />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mở thư mục ${item.name}`}
              onPress={() => onOpen(item)}
              style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
            >
              {item.cover ? (
                <Image source={{ uri: item.cover }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverIcon]}>
                  <Folder size={24} color={colors.primary} strokeWidth={2} />
                </View>
              )}
              <View style={styles.texts}>
                <Text variant="subhead" numberOfLines={2}>
                  {item.name}
                </Text>
                {item.count != null ? (
                  <Text variant="caption" color="textSecondary">
                    {item.count} {countUnit}
                  </Text>
                ) : null}
                {item.note ? (
                  <Text variant="caption" color="textTertiary" numberOfLines={1}>
                    {item.note}
                  </Text>
                ) : null}
              </View>
              {onShare ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Chia sẻ thư mục ${item.name}`}
                  hitSlop={hitSlop}
                  onPress={() => onShare(item)}
                  style={({ pressed }) => [styles.roundBtn, pressed ? styles.roundPressed : null]}
                >
                  <Share2 size={16} color={colors.inverse} strokeWidth={2.2} />
                </Pressable>
              ) : null}
              <View style={styles.roundBtn}>
                <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.5} />
              </View>
            </Pressable>
          )}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxl },
  gap: { height: space.sm + 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.md,
    paddingRight: space.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    minHeight: 80,
    ...elevation.soft,
  },
  pressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.98 }] },
  cover: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  roundPressed: { opacity: 0.6 },
  coverIcon: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySubtle },
  texts: { flex: 1, gap: 2 },
});
