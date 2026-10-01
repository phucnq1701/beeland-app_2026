import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { File, FileSpreadsheet, FileText, FileX2, Image as ImageIcon, PlayCircle, Share2, Youtube } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { AppHeader, Chip, EmptyState, ErrorState, IconButton, Screen, SearchBar, SkeletonList, Text } from "@/components/ui";
import { foldVietnamese } from "@/lib/format";
import { colors, radius, space } from "@/theme";

export type FileItem = { id: string | number; name: string; type: string; size?: string; date?: string; note?: string };

const TYPE_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  pdf: { icon: FileText, color: colors.danger, label: "PDF" },
  doc: { icon: File, color: colors.info, label: "DOC" },
  docx: { icon: File, color: colors.info, label: "DOCX" },
  xls: { icon: FileSpreadsheet, color: colors.success, label: "XLS" },
  xlsx: { icon: FileSpreadsheet, color: colors.success, label: "XLSX" },
  jpg: { icon: ImageIcon, color: colors.warning, label: "JPG" },
  jpeg: { icon: ImageIcon, color: colors.warning, label: "JPEG" },
  png: { icon: ImageIcon, color: colors.warning, label: "PNG" },
  txt: { icon: FileText, color: colors.textSecondary, label: "TXT" },
  video: { icon: PlayCircle, color: colors.primary, label: "Video" },
  youtube: { icon: Youtube, color: colors.danger, label: "YouTube" },
};
const metaOf = (type: string) => TYPE_META[type.toLowerCase()] ?? { icon: File, color: colors.textSecondary, label: (type || "file").toUpperCase() };

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
      <Screen scroll={false} padded={false} header={<AppHeader title={title} subtitle={loading ? undefined : `${items.length} tệp`} />}>
        <FlatList
          data={loading || error ? [] : shown}
          keyExtractor={(f, i) => `${f.id}-${i}`}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchBar value={q} onChangeText={onQueryChange ?? setLocalQuery} placeholder="Tìm theo tên tệp…" />
              {types.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Chip label="Tất cả" count={items.length} selected={type === "all"} onPress={() => setType("all")} />
                  {types.map((t) => (
                    <Chip
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
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Mở ${item.name}`}
                  onPress={() => onOpen(item)}
                  style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
                >
                  <View style={styles.icon}>
                    <Icon size={22} color={m.color} />
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
                    <IconButton icon={Share2} accessibilityLabel={`Chia sẻ ${item.name}`} onPress={() => onShare(item)} />
                  )
                ) : null}
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
  header: { padding: space.lg, gap: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.sm, backgroundColor: colors.surface },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingLeft: space.lg, minHeight: 64 },
  pressed: { backgroundColor: colors.surfaceMuted },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
  texts: { flex: 1, gap: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 76 },
  spinner: { width: 44 },
});
