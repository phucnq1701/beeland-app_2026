import React, { useEffect, useState, useCallback, memo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, Building2, MapPin, SearchX } from "lucide-react-native";

import {
  AppHeader,
  Badge,
  EmptyState,
  ErrorState,
  Screen,
  SearchBar,
  Skeleton,
  Text,
} from "@/components/ui";
import { foldVietnamese } from "@/lib/format";
import { colors, radius, space } from "@/theme";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

const DEFAULT_PROJECT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;
const CARD_H = 232;

const ProjectCard = memo(function ProjectCard({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: (item: any) => void;
}) {
  const isActive = item?.is_active;
  const uri = item?.icon && String(item.icon).trim() !== "" ? item.icon : DEFAULT_PROJECT_IMAGE;
  return (
    <Pressable
      testID={`project-card-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`Dự án ${item?.TenDA ?? ""}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        placeholder={DEFAULT_PROJECT_IMAGE}
        transition={150}
      />
      <LinearGradient colors={colors.showcase.scrim} locations={[0.35, 0.65, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.top}>
        <Badge label={isActive ? "Đang bán" : "Ngừng bán"} tone={isActive ? "success" : "neutral"} />
        <View style={styles.arrow}>
          <ArrowUpRight size={18} color={colors.showcase.text} strokeWidth={2.2} />
        </View>
      </View>
      <View style={styles.caption}>
        <Text variant="heading" color={colors.showcase.text} numberOfLines={1} style={styles.name}>
          {item?.TenDA || "Dự án"}
        </Text>
        <View style={styles.place}>
          <MapPin size={14} color={colors.showcase.textMuted} strokeWidth={2} />
          <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
            {item?.district || "Chưa cập nhật"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export default function ProjectsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await ProjectService.getProjects({});
      if (res?.data) {
        setProjects(res.data);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.log("[Projects] load error:", error);
      setProjects([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleProjectPress = useCallback(
    (project: any) => {
      router.push({
        pathname: "/project/[id]",
        params: {
          id: project.MaDA,
          project: JSON.stringify(project),
        },
      });
    },
    [router]
  );

  // Tìm không phân biệt dấu theo tên, quận, mã dự án
  const q = foldVietnamese(search.trim());
  const filteredProjects = q
    ? projects.filter((p: any) =>
        [p?.TenDA, p?.district, p?.MaDA].some((field) => foldVietnamese(String(field || "")).includes(q))
      )
    : projects;

  const renderProject = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <ProjectCard item={item} index={index} onPress={handleProjectPress} />
    ),
    [handleProjectPress]
  );

  const empty = loading ? (
    <View style={styles.skeletons}>
      <Skeleton height={CARD_H} radius={radius.x3} />
      <Skeleton height={CARD_H} radius={radius.x3} />
    </View>
  ) : loadError ? (
    <ErrorState onRetry={() => void loadProjects()} />
  ) : search ? (
    <EmptyState icon={SearchX} title="Không tìm thấy dự án" description="Thử tìm kiếm với từ khóa khác." />
  ) : (
    <EmptyState icon={Building2} title="Chưa có dự án nào" />
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={<AppHeader title="Dự án" hideBack={embedded} variant="soft" />}
      >
        <FlatList
          data={loading && projects.length === 0 ? [] : filteredProjects}
          renderItem={renderProject}
          keyExtractor={(item: any, index: number) => item?.MaDA?.toString() || index.toString()}
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Tìm dự án, khu vực" variant="soft" />
              {!loading && projects.length > 0 ? (
                <Text variant="caption" color="textSecondary">
                  {filteredProjects.length} dự án
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={[styles.list, { paddingBottom: embedded ? TAB_BAR_SPACE : space.xxl }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl },
  header: { gap: space.md, paddingTop: space.sm, paddingBottom: space.lg },
  gap: { height: space.lg },
  skeletons: { gap: space.lg },
  card: {
    height: CARD_H,
    borderRadius: radius.x3,
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
});
