import React, { useEffect, useState, useCallback, memo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Building2, MapPin, SearchX } from "lucide-react-native";

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
      <Image source={{ uri }} style={styles.image} contentFit="cover" placeholder={DEFAULT_PROJECT_IMAGE} transition={150} />
      <View style={styles.badge}>
        <Badge label={isActive ? "Đang bán" : "Ngừng bán"} tone={isActive ? "success" : "neutral"} />
      </View>
      <View style={styles.caption}>
        <Text variant="heading" color={colors.showcase.text} numberOfLines={1}>
          {item?.TenDA || "Dự án"}
        </Text>
        <View style={styles.place}>
          <MapPin size={14} color={colors.showcase.textMuted} />
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
      <Skeleton height={220} radius={radius.lg} />
      <Skeleton height={220} radius={radius.lg} />
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
        header={<AppHeader title="Dự án" hideBack={embedded} />}
      >
        <FlatList
          data={loading && projects.length === 0 ? [] : filteredProjects}
          renderItem={renderProject}
          keyExtractor={(item: any, index: number) => item?.MaDA?.toString() || index.toString()}
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Tìm dự án, khu vực" />
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
  list: { paddingHorizontal: space.lg },
  header: { gap: space.sm, paddingTop: space.md, paddingBottom: space.md },
  gap: { height: space.md },
  skeletons: { gap: space.md },
  card: {
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.showcase.bg,
  },
  pressed: { opacity: 0.9 },
  image: { ...StyleSheet.absoluteFillObject, bottom: 64 },
  badge: { position: "absolute", top: space.md, left: space.md },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.showcase.bg,
  },
  place: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
