import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, MapPin } from "lucide-react-native";
import React, { useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Badge, Skeleton, Text } from "@/components/ui";
import { projectStatus } from "@/lib/productStatus";
import { colors, radius, space } from "@/theme";

const SIDE = space.xl;
const GAP = space.md;
/** Phần card kế tiếp ló ra để gợi ý vuốt ngang. */
const PEEK = 36;
const CARD_H = 216;
const CARD_RADIUS = radius.x3;

/** Ảnh mặc định khi dự án chưa có ảnh (giữ như trang chủ cũ). */
export const DEFAULT_PROJECT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bigwmih05tf7or57crm12";

type Props = {
  projects: any[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onPress: (project: any) => void;
};

/** Dự án nổi bật – ảnh tràn card, phủ gradient navy, bo tròn lớn. */
export function ProjectCarousel({ projects, loading, error, onRetry, onPress }: Props) {
  const [active, setActive] = useState(0);
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - SIDE * 2 - PEEK, 360);

  if (loading && projects.length === 0) {
    return (
      <View style={styles.row}>
        <Skeleton width={cardW} height={CARD_H} radius={CARD_RADIUS} />
        <Skeleton width={cardW} height={CARD_H} radius={CARD_RADIUS} />
      </View>
    );
  }
  const retryRow = (
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
      <Text variant="caption" color="danger">
        {projects.length ? "Không cập nhật được dự án ·" : "Không tải được dự án ·"}{" "}
      </Text>
      <Text variant="caption" weight="semibold" color="primary">
        Thử lại
      </Text>
    </Pressable>
  );
  if (error && projects.length === 0) return retryRow;
  if (projects.length === 0) {
    return (
      <Text variant="caption" color="textSecondary" style={styles.inline}>
        Chưa có dự án nào.
      </Text>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP)));
  };

  return (
    <View>
      {error ? retryRow : null}
      <FlatList
        horizontal
        data={projects}
        keyExtractor={(p, i) => String(p?.MaDA ?? i)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        renderItem={({ item }) => {
          const status = projectStatus(item);
          const place = item?.district || item?.DiaChi || item?.dia_chi;
          return (
            <Pressable
              testID={`property-card-${item?.MaDA}`}
              accessibilityRole="button"
              accessibilityLabel={`Dự án ${item?.TenDA ?? ""}`}
              onPress={() => onPress(item)}
              style={({ pressed }) => [styles.card, { width: cardW }, pressed ? styles.pressed : null]}
            >
              <Image
                source={{ uri: item?.icon || DEFAULT_PROJECT_IMAGE }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
              <LinearGradient
                colors={colors.showcase.scrim}
                locations={[0.3, 0.6, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.top}>
                <Badge label={status.label} tone={status.tone} />
                <View style={styles.arrow}>
                  <ArrowUpRight size={18} color={colors.showcase.text} strokeWidth={2.2} />
                </View>
              </View>
              <View style={styles.caption}>
                <Text variant="heading" color={colors.showcase.text} numberOfLines={1} style={styles.name}>
                  {item?.TenDA || "Dự án"}
                </Text>
                {place ? (
                  <View style={styles.place}>
                    <MapPin size={14} color={colors.showcase.textMuted} strokeWidth={2} />
                    <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
                      {place}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
      {projects.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {projects.map((p, i) => (
            <View key={String(p?.MaDA ?? i)} style={[styles.dot, i === active ? styles.dotOn : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: GAP, paddingHorizontal: SIDE },
  list: { paddingHorizontal: SIDE, paddingVertical: space.xs },
  inline: { flexDirection: "row", paddingHorizontal: SIDE },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: SIDE,
  },
  card: {
    height: CARD_H,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: colors.showcase.bg,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  top: {
    position: "absolute",
    top: space.md + 2,
    left: space.md + 2,
    right: space.md + 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.showcase.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.showcase.glassBorder,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg + 2,
    paddingBottom: space.lg,
    gap: space.xs,
  },
  name: { fontSize: 18 },
  place: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: space.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  dotOn: { width: 20, backgroundColor: colors.brand },
});
