import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import ImageViewerModal from "@/components/ImageViewerModal";
import { Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

type Props = {
  images: string[];
  /** Ảnh dùng khi danh sách rỗng hoặc ảnh lỗi. */
  fallback: string;
  height?: number;
  /** Mặc định chạm ảnh mở xem toàn màn hình. */
  onOpen?: (index: number) => void;
  /** Nội dung đè lên đáy ảnh (vd tên dự án). */
  children?: React.ReactNode;
};

/** Khối ảnh đầu màn trưng bày: vuốt ngang, chấm phân trang, bộ đếm, xem toàn màn hình. */
export function ImageCarousel({ images, fallback, height = 260, onOpen, children }: Props) {
  const { width } = useWindowDimensions();
  const list = images.filter((u) => typeof u === "string" && u.trim() !== "");
  const data = list.length ? list : [fallback];
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  // Đánh dấu ảnh lỗi theo URL (không theo vị trí) để ảnh thật tải về sau không bị ẩn nhầm
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const dataKey = data.join("|");

  // Danh sách ảnh đổi (vd banner tải xong sau ảnh mặc định) → về ảnh đầu
  useEffect(() => {
    setIndex(0);
  }, [dataKey]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ height }}>
      <FlatList
        horizontal
        pagingEnabled
        data={data}
        keyExtractor={(u, i) => `${i}-${u}`}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item, index: i }) => (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`Ảnh ${i + 1}/${data.length}`}
            onPress={() => (onOpen ? onOpen(i) : setViewer(i))}
            style={{ width, height }}
          >
            <Image
              source={{ uri: failed[item] ? fallback : item }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              onError={() => {
                if (item !== fallback) setFailed((f) => ({ ...f, [item]: true }));
              }}
            />
          </Pressable>
        )}
      />
      {children ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          {children}
        </View>
      ) : null}
      {data.length > 1 ? (
        <>
          <View style={styles.counter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text variant="label" color={colors.showcase.text} style={styles.counterText}>
              {index + 1}/{data.length}
            </Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {data.map((u, i) => (
              <View key={`${i}-${u}`} style={[styles.dot, i === index ? styles.dotOn : null]} />
            ))}
          </View>
        </>
      ) : null}
      {!onOpen ? (
        <ImageViewerModal
          visible={viewer !== null}
          images={data}
          initialIndex={viewer ?? 0}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0 },
  counter: {
    position: "absolute",
    right: space.md,
    bottom: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.showcase.bg,
  },
  counterText: { letterSpacing: 0 },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: space.md,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.showcase.textMuted },
  dotOn: { width: 18, backgroundColor: colors.showcase.accent },
});
