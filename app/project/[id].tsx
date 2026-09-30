import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, FileText, ImageIcon, LucideIcon, Map, MapPin, Package } from "lucide-react-native";

import { ImageCarousel } from "@/components/product/ImageCarousel";
import { Card, IconButton, ListItem, SectionHeader, Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

const DEFAULT_PROJECT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

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
      <StatusBar style="light" />
      {/* Màn trưng bày: ảnh tràn lên vùng status bar, nút quay lại nổi trên ảnh */}
      <View style={styles.root}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
          <ImageCarousel images={[projectData.icon]} fallback={DEFAULT_PROJECT_IMAGE} height={260 + insets.top} />
          <View style={styles.info}>
            <Text variant="title" color={colors.showcase.text} numberOfLines={2} accessibilityRole="header">
              {projectData.TenDA || "Dự án"}
            </Text>
            {place ? (
              <View style={styles.place}>
                <MapPin size={16} color={colors.showcase.textMuted} />
                <Text variant="caption" color={colors.showcase.textMuted}>
                  {place}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.content}>
            <SectionHeader title="Chức năng" />
            <Card padding={0}>
              {options.map((o, i) => {
                const Icon = o.icon;
                return (
                  <View key={o.id} style={i > 0 ? styles.divider : null}>
                    <ListItem
                      leading={
                        <View style={styles.icon}>
                          <Icon size={20} color={colors.brand} />
                        </View>
                      }
                      title={o.title}
                      subtitle={o.subtitle}
                      chevron
                      onPress={o.onPress}
                    />
                  </View>
                );
              })}
            </Card>
          </View>
        </ScrollView>
        <View style={[styles.back, { top: insets.top + space.sm }]}>
          <IconButton icon={ChevronLeft} variant="onDark" accessibilityLabel="Quay lại" onPress={() => router.back()} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.showcase.paper },
  back: { position: "absolute", left: space.md },
  info: {
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    backgroundColor: colors.showcase.bg,
  },
  place: { flexDirection: "row", alignItems: "center", gap: space.xs },
  content: { padding: space.lg, gap: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
});
