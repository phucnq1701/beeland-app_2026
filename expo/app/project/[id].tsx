import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  FileText,
  ImageIcon,
  Package,
  ArrowLeft,
  MapPin,
  ChevronRight,
} from "lucide-react-native";
import Colors from "@/constants/colors";

const DEFAULT_PROJECT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

export default function ProjectOptionsScreen() {
  const { project } = useLocalSearchParams<{ project: any }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const projectData = project ? JSON.parse(project) : null;

  if (!projectData) return null;

  const options = [
    {
      id: "products",
      title: "Sản phẩm",
      subtitle: "Xem danh sách sản phẩm",
      icon: Package,
      color: Colors.primary,
      bg: "rgba(232, 111, 37, 0.1)",
      onPress: () =>
        router.push(`/products?MaDA=${projectData.MaDA}` as any),
    },
    {
      id: "documents",
      title: "Tài liệu",
      subtitle: "Quản lý tài liệu dự án",
      icon: FileText,
      color: Colors.accent.blue,
      bg: "rgba(59, 130, 246, 0.1)",
      onPress: () => router.push(`/folders/${projectData.MaDA}` as any),
    },
    {
      id: "gallery",
      title: "Thư viện ảnh",
      subtitle: "Hình ảnh & media dự án",
      icon: ImageIcon,
      color: Colors.accent.green,
      bg: "rgba(16, 185, 129, 0.1)",
      onPress: () =>
        router.push(`/photo-gallery?projectId=${projectData.MaDA}` as any),
    },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.imageWrapper}>
        <Image
          source={{
            uri:
              (projectData.icon && projectData.icon.trim() !== '') ? projectData.icon : DEFAULT_PROJECT_IMAGE,
          }}
          style={styles.projectImage}
          contentFit="cover"
        />
        <View style={styles.imageOverlay} />

        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <View style={styles.backButtonInner}>
            <ArrowLeft color="#fff" size={22} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        <View style={[styles.imageContent, { paddingTop: insets.top + 56 }]}>
          <Text style={styles.projectTitle} numberOfLines={2}>
            {projectData.TenDA}
          </Text>
          {(projectData.district || projectData.city) && (
            <View style={styles.locationRow}>
              <MapPin color="rgba(255,255,255,0.85)" size={14} />
              <Text style={styles.locationText}>
                {[projectData.district, projectData.city]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>Chức năng</Text>

        <View style={styles.optionsList}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionRow,
                index < options.length - 1 && styles.optionRowBorder,
              ]}
              activeOpacity={0.6}
              onPress={option.onPress}
            >
              <View style={[styles.optionIcon, { backgroundColor: option.bg }]}>
                <option.icon color={option.color} size={22} strokeWidth={2} />
              </View>

              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>

              <ChevronRight
                color={Colors.textTertiary}
                size={20}
                strokeWidth={2}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  imageWrapper: {
    height: 260,
    position: "relative" as const,
  },

  projectImage: {
    width: "100%",
    height: "100%",
  },

  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  imageContent: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 24,
  },

  projectTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: -0.3,
    marginBottom: 6,
  },

  locationRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },

  locationText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500" as const,
  },

  backButton: {
    position: "absolute" as const,
    left: 16,
    zIndex: 10,
  },

  backButtonInner: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  optionsList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
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

  optionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },

  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
    marginHorizontal: 0,
  },

  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },

  optionText: {
    flex: 1,
    gap: 2,
  },

  optionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },

  optionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
