import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Share,
  Linking,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import {
  Search,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Share2,
  X,
  Youtube,
  Video,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { DocumentService } from "@/sevices/DocumentService";

const FILE_TYPE_CONFIG: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  pdf: { icon: FileText, color: "#EF4444", label: "PDF" },
  doc: { icon: File, color: "#3B82F6", label: "DOC" },
  docx: { icon: File, color: "#3B82F6", label: "DOCX" },
  xls: { icon: FileSpreadsheet, color: "#10B981", label: "XLS" },
  xlsx: { icon: FileSpreadsheet, color: "#10B981", label: "XLSX" },
  jpg: { icon: Image, color: "#F59E0B", label: "JPG" },
  jpeg: { icon: Image, color: "#F59E0B", label: "JPEG" },
  png: { icon: Image, color: "#F59E0B", label: "PNG" },
  pages: { icon: File, color: "#8B5CF6", label: "PAGES" },
  txt: { icon: FileText, color: "#6B7280", label: "TXT" },
  youtube: { icon: Youtube, color: "#FF0000", label: "YouTube" },
  video: { icon: Video, color: "#8B5CF6", label: "Video" },
};

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pages: "application/octet-stream",
  txt: "text/plain",
};

const getTypeConfig = (type: string) =>
  FILE_TYPE_CONFIG[type.toLowerCase()] ?? {
    icon: File,
    color: "#6B7280",
    label: type.toUpperCase() || "FILE",
  };

const getMimeType = (type: string) =>
  MIME_TYPES[type.toLowerCase()] ?? "application/octet-stream";

const normalizeExt = (raw: string) => raw.replace(/^\./, "").toLowerCase();

// Phát hiện loại + link từ item API
const detectItemType = (item: any): { type: string; link: string } => {
  const ytLink = item.LinkYoutube?.trim();
  if (ytLink) return { type: "youtube", link: ytLink };

  const videoLink = item.LinkVideo?.trim();
  if (videoLink) return { type: "video", link: videoLink };

  const fileLink = item.DuongDan?.trim();
  if (fileLink) {
    return { type: normalizeExt(item.KieuFile ?? ""), link: fileLink };
  }

  return { type: "file", link: "" };
};

interface DocumentItem {
  id: number;
  name: string;
  type: string;
  size: string;
  date: string;
  link: string;
  ghiChu: string;
  kyHieu: string;
}

export default function DocumentsScreen() {
  const { folderId, folderName, maLoai, projectId } = useLocalSearchParams<{
    folderId: string;
    folderName: string;
    projectId: string;
    maLoai: string;
  }>();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<number | null>(null);

  const loadData = async () => {
    const loaiId = Number(maLoai ?? folderId);
    if (!loaiId) return;

    try {
      setLoading(true);
      const res = await DocumentService.getDetailVideo({
        MaDA: Number(projectId),
        MaLoai: loaiId,
      });
      const data: any[] = res?.data ?? [];

      console.log("[DocumentsScreen] raw data:", data);

      const mapped: DocumentItem[] = data.map((item: any) => {
        const { type, link } = detectItemType(item);
        return {
          id: item.ID,
          name: item.TenThuVien ?? "Không có tên",
          type,
          size: item.KichThuoc ? `${item.KichThuoc} KB` : "—",
          date: item.NgayNhap
            ? new Date(item.NgayNhap).toLocaleDateString("vi-VN")
            : "—",
          link,
          ghiChu: item.MoTa ?? "",
          kyHieu: item.KyHieu ?? "",
        };
      });

      setDocuments(mapped);
    } catch (error) {
      console.error("Load documents error:", error);
      Alert.alert("Lỗi", "Không tải được dữ liệu tài liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [maLoai, folderId]);

  const filteredDocuments = documents.filter(
    (doc) =>
      (selectedType === "all" || doc.type === selectedType) &&
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uniqueTypes = Array.from(new Set(documents.map((d) => d.type)));

  const handleDocumentPress = (document: DocumentItem) => {
    if (!document.link) {
      Alert.alert("Thông báo", "Tài liệu này chưa có đường dẫn");
      return;
    }

    if (Platform.OS === "web") {
      window.open(document.link, "_blank");
      return;
    }

    router.push({
      pathname: "/documents/viewer",
      params: {
        link: encodeURIComponent(document.link),
        type: document.type,
        name: document.name,
      },
    });
  };

  const handleShare = async (document: DocumentItem) => {
    if (!document.link) {
      Alert.alert("Lỗi", "Tài liệu không có đường dẫn để chia sẻ");
      return;
    }

    try {
      setSharingId(document.id);

      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && (navigator as any).share) {
          await (navigator as any).share({
            title: document.name,
            url: document.link,
          });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(document.link);
          Alert.alert("Đã sao chép", "Đã copy link vào clipboard");
        }
        return;
      }

      // YouTube/video: chỉ share link
      if (document.type === "youtube" || document.type === "video") {
        await Share.share({
          title: document.name,
          message: `${document.name}\n${document.link}`,
          url: document.link,
        });
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        await Share.share({
          title: document.name,
          message: `${document.name}\n${document.link}`,
          url: document.link,
        });
        return;
      }

      const safeName = document.name?.trim() || `file.${document.type}`;
      const fileUri = `${FileSystem.cacheDirectory}${safeName}`;
      const downloadResult = await FileSystem.downloadAsync(
        document.link,
        fileUri
      );
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: getMimeType(document.type),
        dialogTitle: `Chia sẻ ${document.name}`,
        UTI: getMimeType(document.type),
      });
    } catch (error) {
      console.error("[Documents] Share error:", error);
      Alert.alert("Lỗi", "Không thể chia sẻ, vui lòng thử lại");
    } finally {
      setSharingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: folderName ?? `Thư mục ${folderId}`,
          headerStyle: { backgroundColor: "#FAFAFA" },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.topSection}>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[
              styles.statChip,
              {
                backgroundColor:
                  selectedType === "all" ? "#3B82F612" : Colors.white,
                borderWidth: selectedType === "all" ? 0 : 1,
                borderColor: Colors.border,
              },
            ]}
            onPress={() => setSelectedType("all")}
          >
            <Text
              style={[
                styles.statNumber,
                { color: selectedType === "all" ? "#3B82F6" : Colors.text },
              ]}
            >
              {documents.length}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: selectedType === "all" ? "#3B82F6" : Colors.text },
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>

          {uniqueTypes.map((type) => {
            const config = getTypeConfig(type);
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.statChip,
                  {
                    backgroundColor:
                      selectedType === type
                        ? config.color + "20"
                        : config.color + "10",
                  },
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={[styles.statNumber, { color: config.color }]}>
                  {documents.filter((d) => d.type === type).length}
                </Text>
                <Text style={[styles.statLabel, { color: config.color }]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchContainer}>
          <Search color={Colors.textTertiary} size={18} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tài liệu..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              activeOpacity={0.7}
            >
              <X color={Colors.textTertiary} size={18} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Đang tải...</Text>
          </View>
        ) : filteredDocuments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Không tìm thấy tài liệu</Text>
          </View>
        ) : (
          filteredDocuments.map((document, index) => {
            const config = getTypeConfig(document.type);
            const IconComponent = config.icon;
            const isLast = index === filteredDocuments.length - 1;

            return (
              <TouchableOpacity
                key={document.id}
                style={[
                  styles.documentRow,
                  !isLast && styles.documentRowBorder,
                ]}
                activeOpacity={0.6}
                onPress={() => handleDocumentPress(document)}
              >
                <View
                  style={[
                    styles.typeIndicator,
                    { backgroundColor: config.color },
                  ]}
                />
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: config.color + "10" },
                  ]}
                >
                  <IconComponent
                    color={config.color}
                    size={20}
                    strokeWidth={1.8}
                  />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={2}>
                    {document.name}
                  </Text>
                  <View style={styles.docMeta}>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: config.color + "12" },
                      ]}
                    >
                      <Text
                        style={[styles.typeBadgeText, { color: config.color }]}
                      >
                        {config.label}
                      </Text>
                    </View>
                    {document.size !== "—" && (
                      <Text style={styles.docMetaText}>{document.size}</Text>
                    )}
                    {document.date !== "—" && (
                      <>
                        <View style={styles.dotSep} />
                        <Text style={styles.docMetaText}>{document.date}</Text>
                      </>
                    )}
                  </View>
                  {document.kyHieu ? (
                    <Text style={styles.kyHieu}>{document.kyHieu}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    void handleShare(document);
                  }}
                  activeOpacity={0.6}
                  disabled={sharingId === document.id}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Share2
                    color={
                      sharingId === document.id
                        ? Colors.textLight
                        : Colors.textTertiary
                    }
                    size={18}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: "#FAFAFA",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statNumber: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 12, fontWeight: "500" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text, padding: 0 },
  content: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: "hidden",
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 0,
  },
  documentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  typeIndicator: {
    width: 3,
    height: 36,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginRight: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  docInfo: { flex: 1, gap: 4 },
  docName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 19,
  },
  docMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  typeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  docMetaText: { fontSize: 12, color: Colors.textTertiary, fontWeight: "400" },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textLight,
  },
  kyHieu: { fontSize: 11, color: Colors.textTertiary, fontStyle: "italic" },
  shareButton: {
    padding: 8,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: "500" },
});
