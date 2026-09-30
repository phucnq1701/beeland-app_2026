import { Image } from "expo-image";
import { ImageIcon, RotateCcw } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import ImageViewerModal from "@/components/ImageViewerModal";
import { Button, EmptyState, Skeleton, Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

type Props = {
  images: { id?: string; uri: string; name?: string }[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

/** Lưới ảnh chứng từ 3 cột + xem ảnh toàn màn hình. */
export function BookingDocuments({ images, loading, error, onRetry }: Props) {
  const { width } = useWindowDimensions();
  const [preview, setPreview] = useState<number | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  // Trừ lề màn (16×2), padding card (16×2), khoảng cách (8×2)
  const size = Math.floor((width - 32 - 32 - 16) / 3);

  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={size} height={size} radius={radius.md} />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="caption" color="danger" align="center">
          {error}
        </Text>
        <Button variant="secondary" icon={RotateCcw} title="Thử lại" onPress={onRetry} />
      </View>
    );
  }

  if (images.length === 0) {
    return <EmptyState icon={ImageIcon} title="Chưa có chứng từ" description="Ảnh chuyển khoản, phiếu thu sẽ hiển thị ở đây." />;
  }

  return (
    <>
      <View style={styles.grid}>
        {images.map((img, index) => {
          const key = img.id ?? String(index);
          return (
            <Pressable
              key={key}
              accessibilityRole="imagebutton"
              accessibilityLabel={img.name ?? `Chứng từ ${index + 1}`}
              onPress={() => setPreview(index)}
              style={[styles.thumb, { width: size, height: size }]}
            >
              {failed[key] ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tải lại ảnh"
                  onPress={() => {
                    setFailed((f) => ({ ...f, [key]: false }));
                    onRetry();
                  }}
                  style={styles.failed}
                >
                  <RotateCcw size={20} color={colors.textTertiary} />
                </Pressable>
              ) : (
                <Image
                  source={{ uri: img.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                  onError={() => setFailed((f) => ({ ...f, [key]: true }))}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <ImageViewerModal
        visible={preview !== null}
        images={images.map((i) => i.uri)}
        initialIndex={preview ?? 0}
        onClose={() => setPreview(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  thumb: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.skeleton,
  },
  failed: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: space.md, paddingVertical: space.md },
});
