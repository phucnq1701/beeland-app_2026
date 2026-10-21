import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { formatUpdatingClock } from "@/lib/otaUpdate";
import { clockType, colors, radius, space } from "@/theme";

const LOGO_SIZE = 88;

/**
 * Màn "BeeLand đang cập nhật dữ liệu mới" khi có bản OTA (components/UpdateManager.tsx).
 * Phủ toàn màn, chặn thao tác — không cho bỏ qua; tải xong app tự reload sang bản mới.
 * Nền navy `showcase` + nhấn cam, cùng ngôn ngữ với màn giới thiệu dự án.
 */
export function OtaUpdateScreen({ percent }: { percent: number | null }) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const clock = formatUpdatingClock(now);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <LinearGradient
        colors={[colors.showcase.surface, colors.showcase.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={[styles.content, { paddingTop: insets.top + space.x4, paddingBottom: insets.bottom + space.x3 }]}
      >
        <View style={styles.brand}>
          <Image
            source={require("@/assets/images/beeland-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text variant="title" color={colors.showcase.text} accessibilityRole="header">
            BeeLand
          </Text>
        </View>

        <View style={styles.body}>
          <Text
            weight={clockType.weight}
            color={colors.showcase.text}
            align="center"
            numeric
            style={{ fontSize: clockType.fontSize, lineHeight: clockType.lineHeight }}
            accessibilityLabel={`${clock.time}, ${clock.date}`}
          >
            {clock.time}
          </Text>
          <Text variant="subhead" color={colors.showcase.textMuted} align="center" importantForAccessibility="no">
            {clock.date}
          </Text>
          <Text
            variant="body"
            color={colors.showcase.text}
            align="center"
            style={styles.message}
            accessibilityLiveRegion="polite"
          >
            BeeLand đang cập nhật dữ liệu mới. Xin vui lòng chờ ...
          </Text>
          <View style={styles.progress}>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityLabel="Tiến độ tải bản cập nhật"
              accessibilityValue={{ min: 0, max: 100, now: percent ?? 0 }}
            >
              <View style={[styles.fill, { width: `${percent ?? 0}%` }]} />
            </View>
            <Text variant="caption" weight="semibold" color={colors.showcase.accent} align="center" numeric>
              {percent == null ? "Đang tải…" : `${percent}%`}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100000,
    elevation: 100,
    backgroundColor: colors.showcase.bg,
  },
  content: { flex: 1, alignItems: "center", paddingHorizontal: space.xxl },
  brand: { alignItems: "center", gap: space.md },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: radius.xxl },
  body: { flex: 1, width: "100%", maxWidth: 420, alignItems: "center", justifyContent: "center", gap: space.sm },
  message: { marginTop: space.xl },
  progress: { width: "100%", gap: space.sm, marginTop: space.xxl },
  track: { height: 8, borderRadius: radius.full, overflow: "hidden", backgroundColor: colors.showcase.track },
  fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.showcase.accent },
});
