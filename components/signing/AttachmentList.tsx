import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { FileText, Plus, X } from "lucide-react-native";

import ImageViewerModal from "@/components/ImageViewerModal";
import { Text } from "@/components/ui";
import { fileExt, fileUrl, isImageFile, type Attachment } from "@/lib/signing";
import { colors, radius, space } from "@/theme";

const TILE = 92;

/**
 * Hình ảnh / tài liệu đính kèm của lịch ký (cột tai_lieu) – như web AttachmentsField.
 * Chạm ảnh → xem toàn màn hình; chạm tệp khác → trình xem tài liệu. Có `onAdd` / `onRemove` thì sửa được.
 */
export function AttachmentList({
  items,
  onAdd,
  onRemove,
  uploading,
}: {
  items: Attachment[];
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  uploading?: boolean;
}) {
  const router = useRouter();
  const images = items.filter((a) => isImageFile(a.fileName || a.url));
  const [viewer, setViewer] = useState<number | null>(null);

  const open = (a: Attachment) => {
    if (isImageFile(a.fileName || a.url)) {
      setViewer(images.indexOf(a));
      return;
    }
    const url = fileUrl(a.url);
    router.push({
      pathname: "/documents/viewer",
      params: { link: encodeURIComponent(url), type: fileExt(a.fileName || url), name: a.fileName || "Tài liệu" },
    });
  };

  if (!items.length && !onAdd) {
    return (
      <Text variant="caption" color="textSecondary">
        Chưa có hồ sơ đính kèm.
      </Text>
    );
  }

  return (
    <>
      <View style={styles.grid}>
        {items.map((a, i) => {
          const image = isImageFile(a.fileName || a.url);
          return (
            <View key={`${a.url}-${i}`} style={styles.tileWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mở ${a.fileName || "tệp đính kèm"}`}
                onPress={() => open(a)}
                style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
              >
                {image ? (
                  <Image source={{ uri: fileUrl(a.url) }} style={styles.image} />
                ) : (
                  <View style={styles.file}>
                    <FileText size={24} color={colors.textSecondary} />
                    <Text variant="label" color="textSecondary" numberOfLines={2} align="center">
                      {a.fileName || fileExt(a.url).toUpperCase() || "Tệp"}
                    </Text>
                  </View>
                )}
              </Pressable>
              {onRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ ${a.fileName || "tệp đính kèm"}`}
                  hitSlop={8}
                  onPress={() => onRemove(i)}
                  style={styles.remove}
                >
                  <X size={14} color={colors.onPrimary} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm hình ảnh / tài liệu"
            disabled={uploading}
            onPress={onAdd}
            style={({ pressed }) => [styles.tile, styles.add, pressed ? styles.pressed : null]}
          >
            {uploading ? <ActivityIndicator color={colors.primary} /> : <Plus size={24} color={colors.primary} />}
            <Text variant="label" color="primary">
              {uploading ? "Đang tải…" : "Thêm"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ImageViewerModal
        visible={viewer !== null}
        images={images.map((a) => fileUrl(a.url))}
        initialIndex={viewer ?? 0}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tileWrap: { width: TILE, height: TILE },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  image: { width: "100%", height: "100%" },
  file: { alignItems: "center", gap: space.xs, padding: space.sm },
  add: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    gap: 2,
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inverse,
  },
});
