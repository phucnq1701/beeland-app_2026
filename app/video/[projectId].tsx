import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FileText, FolderOpen } from "lucide-react-native";
import Colors from "@/constants/colors";
import { DocumentService } from "@/sevices/DocumentService";

// Màu cho từng loại folder theo thứ tự
const FOLDER_COLORS = [
  "#4A90D9",
  "#E67E22",
  "#27AE60",
  "#8E44AD",
  "#E74C3C",
  "#16A085",
  "#2980B9",
  "#D35400",
];

interface FolderItem {
  id: string; // MaLoai
  name: string; // TenLoai
  color: string;
  documentCount: number;
}

export default function FoldersScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const router = useRouter();

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFolders = async () => {
    try {
      setLoading(true);
      // API mới trả về danh sách loại tài liệu (MaLoai, TenLoai)
      const res = await DocumentService.getFolderVideo({
        InputSearch: "",
        MaDA: Number(projectId),
        TypeDocument: "GALLERY",
      });
      const data: any[] = res?.data ?? [];
      console.log('====================================');
      console.log(res?.data);
      console.log('====================================');

      const mappedFolders: FolderItem[] = data.map(
        (item: any, index: number) => ({
          id: item.MaLoai?.toString() ?? Math.random().toString(),
          name: item.TenLoai ?? "Không có tên",
          color: FOLDER_COLORS[index % FOLDER_COLORS.length],
          documentCount: 0, // sẽ load chi tiết khi vào folder
        })
      );

      setFolders(mappedFolders);
    } catch (error) {
      console.error("Lỗi load folder", error);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const handleFolderPress = (folderItem: FolderItem) => {
    console.log("[Folders] Folder pressed", {
      projectId,
      folderId: folderItem.id,
    });
    router.push({
      pathname: `/videos/${folderItem.id}`,
      params: {
        projectId,
        folderName: folderItem.name,
        maLoai: folderItem.id,
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Video dự án",
          headerStyle: { backgroundColor: "#FAFAFA" },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <FolderOpen size={18} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.summaryText}>{folders.length} thư mục</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Đang tải...</Text>
          </View>
        ) : folders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Không có thư mục nào</Text>
          </View>
        ) : (
          folders.map((folderItem) => (
            <TouchableOpacity
              key={folderItem.id}
              style={styles.folderCard}
              activeOpacity={0.6}
              onPress={() => handleFolderPress(folderItem)}
              testID={`folder-card-${folderItem.id}`}
            >
              <View style={styles.folderRow}>
                <View
                  style={[
                    styles.colorStripe,
                    { backgroundColor: folderItem.color },
                  ]}
                />

                <View style={styles.folderInfo}>
                  <Text style={styles.folderName} numberOfLines={1}>
                    {folderItem.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.countChip,
                        { backgroundColor: folderItem.color + "14" },
                      ]}
                    >
                      <FileText
                        size={12}
                        color={folderItem.color}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.countChipText,
                          { color: folderItem.color },
                        ]}
                      >
                        Xem video
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.arrowWrap,
                    { backgroundColor: folderItem.color + "10" },
                  ]}
                >
                  <Text style={[styles.arrowText, { color: folderItem.color }]}>
                    ›
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginBottom: 4,
    gap: 12,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  folderCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingRight: 14,
    paddingLeft: 0,
  },
  colorStripe: {
    width: 4,
    alignSelf: "stretch",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    marginRight: 14,
  },
  folderInfo: {
    flex: 1,
    gap: 6,
  },
  folderName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countChipText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  arrowText: {
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 28,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: "500" },
  bottomSpacer: {
    height: 30,
  },
});
