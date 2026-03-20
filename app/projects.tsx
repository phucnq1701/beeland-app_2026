

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { MapPin, ArrowRight } from "lucide-react-native";

import Colors from "@/constants/colors";
import { ProjectService } from "./sevices/ProjectService";

const DEFAULT_PROJECT_IMAGE = "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bigwmih05tf7or57crm12";

export default function ProjectsScreen() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


  useEffect(() => {
    void loadProjects();
  }, []);

  // const handleProjectPress = (id: string) => {
  //   console.log('[Projects] Navigate to project', { id });
  //   router.push({ pathname: '/project/[id]', params: { id } });
  // };

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

  // const handleProjectPress = (id: string) => {
  //   router.push({
  //     pathname: "/project/[id]",
  //     params: { id },
  //   });
  // };

  const handleProjectPress = (project: any) => {
    router.push({
      pathname: "/project/[id]",
      params: {
        id: project.MaDA,
        project: JSON.stringify(project),
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Danh sách dự án",
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
          },
          headerShadowVisible: false,
        }}
      />

      {/* Loading */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dự án...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {projects.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Không có dự án</Text>
            </View>
          )}

          {projects.map((project: any) => (
            <TouchableOpacity
              key={project.MaDA}
              style={styles.projectCard}
              activeOpacity={0.8}
              onPress={() => handleProjectPress(project)}
            >
              <Image
                source={{
                  uri:
                    project.icon ||
                    DEFAULT_PROJECT_IMAGE,
                }}
                style={styles.projectImage}
                contentFit="cover"
              />

              <View style={styles.projectInfo}>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectTitle} numberOfLines={1}>
                    {project.TenDA || "Dự án"}
                  </Text>

                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>
                      {project?.is_active ? "Đang bán" : "Không xác định"}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <MapPin color={Colors.textSecondary} size={14} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {project.district || "Chưa cập nhật"}
                  </Text>
                </View>

                <View style={styles.projectFooter}>
                  <Text style={styles.priceText}>
                    {project.price || "Liên hệ"}
                  </Text>

                  <View style={styles.arrowButton}>
                    <ArrowRight color={Colors.primary} size={18} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    padding: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },

  emptyBox: {
    alignItems: "center",
    marginTop: 40,
  },

  emptyText: {
    color: Colors.textSecondary,
  },

  projectCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,

    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      },
    }),
  },

  projectImage: {
    width: "100%",
    height: 180,
    backgroundColor: Colors.background,
  },

  projectInfo: {
    padding: 16,
  },

  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  projectTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  locationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },

  projectFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },

  priceText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.primary,
  },

  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
});
