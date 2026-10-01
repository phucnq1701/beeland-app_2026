import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, FileText, ImageIcon, LucideIcon, Map, MapPin, Package } from "lucide-react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { FocusStatusBar } from "@/components/ui/FocusStatusBar";
import { IconButton, Text } from "@/components/ui";
import { colors, elevation, radius, space } from "@/theme";

const DEFAULT_PROJECT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

/** Phần nội dung bo góc trên, trồi đè lên đáy ảnh. */
const SHEET_OVERLAP = radius.x3;

type Option = { id: string; title: string; subtitle: string; icon: LucideIcon; onPress: () => void };

export default function ProjectOptionsScreen() {
  const { project } = useLocalSearchParams<{ project: any }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  let projectData: any = null;
  try {
    projectData = project ? JSON.parse(project) : null;
  } catch {
    projectData = null;
  }

  if (!projectData) return null;

  const options: Option[] = [
    {
      id: "products",
      title: "Sản phẩm",
      subtitle: "Xem danh sách sản phẩm",
      icon: Package,
      onPress: () => router.push(`/products?MaDA=${projectData.MaDA}` as any),
    },
    {
      id: "documents",
      title: "Tài liệu",
      subtitle: "Quản lý tài liệu dự án",
      icon: FileText,
      onPress: () => router.push(`/folders/${projectData.MaDA}` as any),
    },
    {
      id: "gallery",
      title: "Thư viện ảnh",
      subtitle: "Hình ảnh & media dự án",
      icon: ImageIcon,
      onPress: () => router.push(`/photo-gallery?projectId=${projectData.MaDA}` as any),
    },
    {
      id: "diagram",
      title: "Sơ đồ phân lô",
      subtitle: "Xem sơ đồ quy hoạch dự án",
      icon: Map,
      onPress: () => router.push(`/diagram/${projectData.MaDA}` as any),
    },
  ];

  const place = [projectData.district, projectData.city].filter(Boolean).join(", ");

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="light" />
      {/* Màn trưng bày: ảnh tràn lên vùng status bar, tên dự án đè lên ảnh, nút quay lại kính mờ */}
      <View style={styles.root}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
          <ImageCarousel images={[projectData.icon]} fallback={DEFAULT_PROJECT_IMAGE} height={320 + insets.top}>
            <LinearGradient
              colors={colors.showcase.scrim}
              locations={[0, 0.5, 1]}
              style={styles.scrim}
              pointerEvents="none"
            />
            <View style={styles.info} pointerEvents="none">
              <Text
                variant="title"
                color={colors.showcase.text}
                numberOfLines={2}
                accessibilityRole="header"
                style={styles.name}
              >
                {projectData.TenDA || "Dự án"}
              </Text>
              {place ? (
                <View style={styles.place}>
                  <MapPin size={16} color={colors.showcase.textMuted} strokeWidth={2} />
                  <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ) : null}
            </View>
          </ImageCarousel>
          <View style={styles.sheet}>
            <HomeSectionHeader title="Chức năng" />
            <View style={styles.options}>
              {options.map((o) => {
                const Icon = o.icon;
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="button"
                    accessibilityLabel={o.title}
                    onPress={o.onPress}
                    style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
                  >
                    <View style={styles.icon}>
                      <Icon size={20} color={colors.brand} strokeWidth={2} />
                    </View>
                    <View style={styles.texts}>
                      <Text variant="subhead" numberOfLines={1}>
                        {o.title}
                      </Text>
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>
                        {o.subtitle}
                      </Text>
                    </View>
                    <View style={styles.chevron}>
                      <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.5} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <View style={[styles.back, { top: insets.top + space.sm }]}>
          <IconButton icon={ChevronLeft} variant="glass" accessibilityLabel="Quay lại" onPress={() => router.back()} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { position: "absolute", left: space.lg },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 220 },
  info: {
    gap: space.xs,
    paddingHorizontal: space.xl,
    paddingBottom: SHEET_OVERLAP + space.lg,
  },
  name: { fontSize: 26, lineHeight: 34 },
  place: { flexDirection: "row", alignItems: "center", gap: space.xs },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
    gap: space.md,
    borderTopLeftRadius: radius.x3,
    borderTopRightRadius: radius.x3,
    backgroundColor: colors.bg,
  },
  options: { gap: space.sm + 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    paddingVertical: space.md + 2,
    paddingLeft: space.md + 2,
    paddingRight: space.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  pressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.98 }] },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  texts: { flex: 1, gap: 2 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
});
