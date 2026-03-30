import React, { useState, useCallback, useEffect } from "react";
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
import {
  Download,
  Search,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Share2,
  X,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { DocumentService } from "../sevices/DocumentService";

// cấu hình icon theo type
const FILE_TYPE_CONFIG: Record<
  string,
  { icon: typeof FileText; color: string; label: string }
> = {
  pdf: { icon: FileText, color: "#EF4444", label: "PDF" },
  doc: { icon: File, color: "#3B82F6", label: "DOC" },
  docx: { icon: File, color: "#3B82F6", label: "DOCX" },
  xls: { icon: FileSpreadsheet, color: "#10B981", label: "XLS" },
  xlsx: { icon: FileSpreadsheet, color: "#10B981", label: "XLSX" },
  jpg: { icon: Image, color: "#F59E0B", label: "JPG" },
  png: { icon: Image, color: "#F59E0B", label: "PNG" },
  pages: { icon: File, color: "#8B5CF6", label: "PAGES" },
  txt: { icon: FileText, color: "#6B7280", label: "TXT" },
};

const getTypeConfig = (type: string) =>
  FILE_TYPE_CONFIG[type.toLowerCase()] ?? {
    icon: File,
    color: "#6B7280",
    label: type.toUpperCase(),
  };

interface DocumentItem {
  id: number;
  name: string;
  type: string;
  size: string;
  date: string;
  link: string;
  ghiChu: string;
}

export default function DocumentsScreen() {
  const { folderId } = useLocalSearchParams<{
    folderId: string;
  }>();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  const loadData = async (inputSearch: string = "") => {
    try {
      const res = await DocumentService.getDetail({
        DocumentID: Number(folderId),
        InputSearch: inputSearch,
      });

      const mapped: DocumentItem[] = res?.data?.map((doc: any) => ({
        id: doc.ID,
        name: doc.Name,
        type: doc.Type,
        size: doc.Size > 0 ? `${doc.Size} MB` : "0 MB",
        date: new Date(doc.CreatedAt).toLocaleDateString(),
        link: doc.Link.startsWith("http")
          ? doc.Link
          : `https://upload.beesky.vn/${doc.Link.replace(/^\/+/, "")}`,
        ghiChu: doc.GhiChu,
      }));

      setDocuments(mapped);
    } catch (error) {
      console.error("Load documents error:", error);
      Alert.alert("Lỗi", "Không tải được dữ liệu tài liệu");
    }
  };

  useEffect(() => {
    void loadData();
  }, [folderId]);

  // debounce input search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(
      setTimeout(() => {
        void loadData(text);
      }, 500)
    );
  };

  const filteredDocuments = documents.filter(
    (doc) =>
      (selectedType === "all" || doc.type.toLowerCase() === selectedType) &&
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTypePress = (type: string) => {
    setSelectedType(type);
  };
  const canOpenInWebView = (type: string) => {
    const webTypes = [
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "txt",
      "html",
      "doc",
      "docx",
      "xls",
      "xlsx",
    ];
    return webTypes.includes(type.toLowerCase());
  };

  const handleDocumentPress = (document: DocumentItem) => {
    console.log("[Documents] Document pressed", document);

    if (Platform.OS === "web") {
      window.open(document.link, "_blank");
      return;
    }

    const fileType = document.type.toLowerCase();

    if (canOpenInWebView(fileType)) {
      // mở trong app bằng WebView
      router.push({
        pathname: "/documents/viewer",
        params: {
          link: encodeURIComponent(document.link),
          type: fileType,
          name: document.name,
        },
      });
    } else {
      // mở ngoài nếu WebView không hỗ trợ
      Linking.openURL(document.link).catch(() =>
        Alert.alert("Lỗi", "Không thể mở tài liệu")
      );
    }
  };

  const typeGroups = filteredDocuments.reduce<Record<string, DocumentItem[]>>(
    (acc, doc) => {
      const key = doc.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    },
    {}
  );

  const uniqueTypes = Array.from(
    new Set(documents.map((doc) => doc.type.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Folder ${folderId}`,
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
            onPress={() => handleTypePress("all")}
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
                onPress={() => handleTypePress(type)}
              >
                <Text style={[styles.statNumber, { color: config.color }]}>
                  {typeGroups[type]?.length || 0}
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
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearchChange("")}
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
        {filteredDocuments.length === 0 ? (
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
                  <Text style={styles.docName} numberOfLines={1}>
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
                    <Text style={styles.docMetaText}>{document.size}</Text>
                    <View style={styles.dotSep} />
                    <Text style={styles.docMetaText}>{document.date}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// Styles giữ nguyên
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
    height: 32,
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
  docInfo: { flex: 1, gap: 5 },
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
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: "500" },
});
