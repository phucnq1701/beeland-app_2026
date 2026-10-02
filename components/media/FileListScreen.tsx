import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { File, FileSpreadsheet, FileText, FileX2, Image as ImageIcon, PlayCircle, Share2, Youtube } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { AppHeader, Chip, EmptyState, ErrorState, Screen, SearchBar, SkeletonList, Text } from "@/components/ui";
import { foldVietnamese } from "@/lib/format";
import { colors, elevation, hitSlop, radius, space } from "@/theme";

export type FileItem = { id: string | number; name: string; type: string; size?: string; date?: string; note?: string };

/** Icon + màu theo loại tệp; `bg` = nền nhạt cùng tông cho vòng tròn icon. */
const TYPE_META: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  pdf: { icon: FileText, color: colors.danger, bg: colors.dangerSubtle, label: "PDF" },
  doc: { icon: File, color: colors.info, bg: colors.infoSubtle, label: "DOC" },
  docx: { icon: File, color: colors.info, bg: colors.infoSubtle, label: "DOCX" },
  xls: { icon: FileSpreadsheet, color: colors.success, bg: colors.successSubtle, label: "XLS" },
  xlsx: { icon: FileSpreadsheet, color: colors.success, bg: colors.successSubtle, label: "XLSX" },
  jpg: { icon: ImageIcon, color: colors.warning, bg: colors.warningSubtle, label: "JPG" },
  jpeg: { icon: ImageIcon, color: colors.warning, bg: colors.warningSubtle, label: "JPEG" },
  png: { icon: ImageIcon, color: colors.warning, bg: colors.warningSubtle, label: "PNG" },
  txt: { icon: FileText, color: colors.textSecondary, bg: colors.surfaceMuted, label: "TXT" },
  video: { icon: PlayCircle, color: colors.primary, bg: colors.primarySubtle, label: "Video" },
  youtube: { icon: Youtube, color: colors.danger, bg: colors.dangerSubtle, label: "YouTube" },
};
const metaOf = (type: string) =>
  TYPE_META[type.toLowerCase()] ?? {
    icon: File,
    color: colors.textSecondary,
    bg: colors.surfaceMuted,
    label: (type || "file").toUpperCase(),
  };

/** Danh sách tệp trong thư mục: tìm kiếm, lọc theo loại, mở, chia sẻ (tuỳ chọn). */
export function FileListScreen({
  title,
  items,
  loading,
  error,
  refreshing,
  onRefresh,
  onOpen,
  onShare,
  sharingId,
  query,
  onQueryChange,
}: {
  title: string;
  items: FileItem[];
  loading: boolean;
  error: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (f: FileItem) => void;
  onShare?: (f: FileItem) => void;
  sharingId?: string | number | null;
  /** Có thì tìm kiếm do màn gọi máy chủ; không thì lọc tại chỗ theo tên */
  query?: string;
  onQueryChange?: (q: string) => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [type, setType] = useState("all");
  const q = query ?? localQuery;
  const types = useMemo(() => Array.from(new Set(items.map((d) => d.type.toLowerCase()))), [items]);
  const shown = useMemo(() => {
    const k = foldVietnamese(q.trim());
    return items.filter((d) => (type === "all" || d.type.toLowerCase() === type) && (!k || foldVietnamese(d.name).includes(k)));
  }, [items, q, type]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={<AppHeader variant="soft" title={title} subtitle={loading ? undefined : `${items.length} tệp`} />}
      >
        <FlatList
          data={loading || error ? [] : shown}
          keyExtractor={(f, i) => `${f.id}-${i}`}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchBar value={q} onChangeText={onQueryChange ?? setLocalQuery} placeholder="Tìm theo tên tệp…" variant="soft" />
              {types.length > 1 ? (
                // Tràn ra mép màn để bóng chip không bị cắt ở hai đầu
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScroll}
                  contentContainerStyle={styles.chips}
                >
                  <Chip
                    variant="soft"
                    label="Tất cả"
                    count={items.length}
                    selected={type === "all"}
                    onPress={() => setType("all")}
                  />
                  {types.map((t) => (
                    <Chip
                      variant="soft"
                      key={t}
                      label={metaOf(t).label}
                      count={items.filter((d) => d.type.toLowerCase() === t).length}
                      selected={type === t}
                      onPress={() => setType(t)}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <SkeletonList />
            ) : error ? (
              <ErrorState description="Không tải được danh sách tệp." onRetry={onRefresh} />
            ) : (
              <EmptyState icon={FileX2} title={q || type !== "all" ? "Không có tệp phù hợp" : "Thư mục chưa có tệp"} />
            )
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const m = metaOf(item.type);
            const Icon = m.icon;
            return (
              // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
              <View style={styles.card}>
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mở ${item.name}`}
                    onPress={() => onOpen(item)}
                    style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
                  >
                    <View style={[styles.icon, { backgroundColor: m.bg }]}>
                      <Icon size={20} color={m.color} strokeWidth={2} />
                    </View>
                    <View style={styles.texts}>
                      <Text variant="subhead" numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>
                        {[m.label, item.size, item.date].filter(Boolean).join(" · ")}
                      </Text>
                      {item.note ? (
                        <Text variant="caption" color="textTertiary" numberOfLines={1}>
                          {item.note}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  {onShare ? (
                    sharingId === item.id ? (
                      <ActivityIndicator style={styles.spinner} color={colors.primary} />
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Chia sẻ ${item.name}`}
                        hitSlop={hitSlop}
                        onPress={() => onShare(item)}
                        style={({ pressed }) => [styles.share, pressed ? styles.sharePressed : null]}
                      >
                        <Share2 size={16} color={colors.inverse} strokeWidth={2.2} />
                      </Pressable>
                    )
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  header: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg, gap: space.md },
  chipsScroll: { marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.lg, borderRadius: radius.xxl, overflow: "hidden" },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingLeft: space.md + 2,
    paddingRight: space.sm,
    minHeight: 72,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 2 },
  separator: { height: space.sm + 2 },
  share: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
  sharePressed: { opacity: 0.6 },
  spinner: { width: 32 },
});
