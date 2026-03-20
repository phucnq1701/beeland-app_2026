import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { MapPin, Search, Building2, ChevronRight } from "lucide-react-native";

import Colors from "@/constants/colors";
import { ProjectService } from "./sevices/ProjectService";

const DEFAULT_PROJECT_IMAGE =
  "https://r2-pub.rork.com/attachments/bigwmih05tf7or57crm12";

export default function ProjectsScreen() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await ProjectService.getProjects({});
      if (res?.data) {
        setProjects(res.data);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.log("[Projects] load error:", error);
      setProjects([]);
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

  const filteredProjects = projects.filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.TenDA || "").toLowerCase().includes(q) ||
      (p.district || "").toLowerCase().includes(q) ||
      (p.MaDA || "").toLowerCase().includes(q)
    );
  });

  const renderProject = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isActive = item?.is_active;
      return (
        <TouchableOpacity
          key={item.MaDA}
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => handleProjectPress(item)}
          testID={`project-card-${index}`}
        >
          <Image
            source={{ uri: item.icon || DEFAULT_PROJECT_IMAGE }}
            style={styles.cardImage}
            contentFit="cover"
          />

          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.TenDA || "Dự án"}
              </Text>
              <ChevronRight color={Colors.textTertiary} size={18} />
            </View>

            <View style={styles.cardLocation}>
              <MapPin color={Colors.textSecondary} size={13} />
              <Text style={styles.cardLocationText} numberOfLines={1}>
                {item.district || "Chưa cập nhật"}
              </Text>
            </View>

            <View style={styles.cardBottom}>
              {item.price ? (
                <Text style={styles.cardPrice}>{item.price}</Text>
              ) : (
                <Text style={styles.cardPriceContact}>Liên hệ</Text>
              )}

              <View
                style={[
                  styles.statusChip,
                  isActive ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isActive ? "#10B981" : "#94A3B8",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusLabel,
                    { color: isActive ? "#10B981" : "#94A3B8" },
                  ]}
                >
                  {isActive ? "Đang bán" : "Ngừng bán"}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleProjectPress]
  );

  const keyExtractor = useCallback(
    (item: any, index: number) => item.MaDA?.toString() || index.toString(),
    []
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Dự án",
          headerStyle: { backgroundColor: "#FAFAFA" },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search color={Colors.textTertiary} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm dự án..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            testID="project-search-input"
          />
        </View>
        <View style={styles.countRow}>
          <Building2 color={Colors.primary} size={14} />
          <Text style={styles.countText}>
            {filteredProjects.length} dự án
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dự án...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderProject}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Building2 color={Colors.textTertiary} size={48} />
              <Text style={styles.emptyTitle}>Không tìm thấy dự án</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "Thử tìm kiếm với từ khóa khác"
                  : "Chưa có dự án nào"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.text,
    ...Platform.select({
      web: { outlineStyle: "none" } as any,
    }),
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },
  countText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      },
    }),
  },
  cardImage: {
    width: 100,
    height: 100,
    backgroundColor: "#F0F0F0",
  },
  cardBody: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
    flex: 1,
    marginRight: 4,
  },
  cardLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  cardLocationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  cardPriceContact: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  statusInactive: {
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
