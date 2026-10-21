import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { formatUpdatingClock } from "@/lib/otaUpdate";
import { clockType, colors, radius, space } from "@/theme";

const LOGO_SIZE = 48;
const TRACK_HEIGHT = 6;
const ACCENT_BAR = { width: 48, height: 4 };
const CONTENT_MAX_WIDTH = 440;

/**
 * Màn "BeeLand đang cập nhật dữ liệu mới" khi có bản OTA (components/UpdateManager.tsx).
 * Phủ toàn màn, chặn thao tác — không cho bỏ qua; tải xong app tự reload sang bản mới.
 * Phương án D "Navy cao cấp" (người dùng chốt 2026-10-21): nền navy `showcase`, giờ lớn căn trái,
 * thẻ navy nhạt có % và thanh tiến độ nhấn cam.
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
      <View style={[styles.content, { paddingTop: insets.top + space.x4, paddingBottom: insets.bottom + space.x3 }]}>
        <View style={styles.brand}>
          <Image
            source={require("@/assets/images/beeland-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View>
            <Text variant="heading" weight="bold" color={colors.showcase.text} accessibilityRole="header">
              BeeLand
            </Text>
            <Text variant="caption" color={colors.showcase.textMuted}>
              Cập nhật phiên bản
            </Text>
          </View>
        </View>

        <View style={styles.clockBlock}>
          <Text
            weight={clockType.weight}
            color={colors.showcase.text}
            numeric
            style={{ fontSize: clockType.fontSize, lineHeight: clockType.lineHeight, letterSpacing: clockType.letterSpacing }}
            accessibilityLabel={`${clock.time}, ${clock.date}`}
          >
            {clock.time}
          </Text>
          <Text variant="heading" weight="medium" color={colors.showcase.textMuted} importantForAccessibility="no">
            {clock.date}
          </Text>
          <View style={styles.accentBar} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardTexts}>
            <Text variant="heading" color={colors.showcase.text} accessibilityLiveRegion="polite">
              BeeLand đang cập nhật dữ liệu mới
            </Text>
            <Text variant="caption" color={colors.showcase.textMuted}>
              Xin vui lòng chờ ...
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Text variant="caption" color={colors.showcase.textMuted}>
              {percent == null ? "Đang kết nối máy chủ…" : "Đang tải bản cập nhật"}
            </Text>
            <Text variant="title" color={colors.showcase.accent} numeric>
              {percent == null ? "…" : `${percent}%`}
            </Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Tiến độ tải bản cập nhật"
            accessibilityValue={{ min: 0, max: 100, now: percent ?? 0 }}
          >
            <View style={[styles.fill, { width: `${percent ?? 0}%` }]} />
          </View>
        </View>

        <Text variant="caption" color={colors.showcase.textMuted} align="center" style={styles.footer}>
          Ứng dụng sẽ tự mở lại khi cập nhật xong
        </Text>
      </View>
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
  content: {
    flex: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: space.x3 - space.xs,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.md },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: radius.md },
  clockBlock: { flex: 1, justifyContent: "center", gap: space.sm },
  accentBar: {
    width: ACCENT_BAR.width,
    height: ACCENT_BAR.height,
    borderRadius: radius.full,
    backgroundColor: colors.showcase.accent,
    marginTop: space.lg,
  },
  card: { gap: space.lg, padding: space.xl, borderRadius: radius.x3, backgroundColor: colors.showcase.surface },
  cardTexts: { gap: space.xs },
  progressRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  track: { height: TRACK_HEIGHT, borderRadius: radius.full, overflow: "hidden", backgroundColor: colors.showcase.track },
  fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.showcase.accent },
  footer: { marginTop: space.lg },
});
