import { Image } from "expo-image";
import { MapPin } from "lucide-react-native";
import React, { useState } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, View } from "react-native";

import { Badge, BadgeTone, Skeleton, Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

const CARD_W = 280;
const CARD_H = 200;
const GAP = space.md;

/** Ảnh mặc định khi dự án chưa có ảnh (giữ như trang chủ cũ). */
export const DEFAULT_PROJECT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bigwmih05tf7or57crm12";

/** Trạng thái dự án → badge (giữ cách nhận diện cũ theo TenTT/MaTT). */
function projectStatus(p: any): { label: string; tone: BadgeTone } {
  const tt = String(p?.TenTT || p?.ten_tt || "").trim();
  const ma = String(p?.MaTT ?? p?.ma_tt ?? "");
  if (tt === "Đã bán" || ma === "2") return { label: tt || "Đã bán", tone: "danger" };
  if (tt === "Đầu tư" || ma === "3") return { label: tt || "Đầu tư", tone: "brand" };
  return { label: tt || "Đang bán", tone: "success" };
}

type Props = {
  projects: any[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onPress: (project: any) => void;
};

/** Dự án nổi bật – card phong cách trưng bày (navy + cam sáng). */
export function ProjectCarousel({ projects, loading, error, onRetry, onPress }: Props) {
  const [active, setActive] = useState(0);

  if (loading && projects.length === 0) {
    return (
      <View style={styles.row}>
        <Skeleton width={CARD_W} height={CARD_H} radius={radius.lg} />
        <Skeleton width={CARD_W} height={CARD_H} radius={radius.lg} />
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
    setActive(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP)));
  };

  return (
    <View>
      {error ? retryRow : null}
      <FlatList
        horizontal
        data={projects}
        keyExtractor={(p, i) => String(p?.MaDA ?? i)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
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
              style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
            >
              <Image
                source={{ uri: item?.icon || DEFAULT_PROJECT_IMAGE }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.badge}>
                <Badge label={status.label} tone={status.tone} />
              </View>
              <View style={styles.caption}>
                <Text variant="heading" color={colors.showcase.text} numberOfLines={1}>
                  {item?.TenDA || "Dự án"}
                </Text>
                {place ? (
                  <View style={styles.place}>
                    <MapPin size={14} color={colors.showcase.textMuted} />
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
  row: { flexDirection: "row", gap: GAP, paddingHorizontal: space.lg },
  list: { paddingHorizontal: space.lg },
  inline: { flexDirection: "row", paddingHorizontal: space.lg },
  retry: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: space.lg },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.showcase.bg,
  },
  pressed: { opacity: 0.9 },
  badge: { position: "absolute", top: space.md, left: space.md },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.md,
    gap: 2,
    backgroundColor: colors.showcase.bg,
  },
  place: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotOn: { width: 18, backgroundColor: colors.brand },
});
