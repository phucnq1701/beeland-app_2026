import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { Paths, File } from "expo-file-system";
import * as Sharing from "expo-sharing";

import {
  getRawDocumentUrl, getDocumentType, getDocumentFileName,
  getOfficeViewerUrl, OFFICE_TYPES, OFFICE_MIME, OFFICE_UTI,
} from "@/components/utils/documentLinks";

export default function DocumentViewer() {
  const { link, type, name } = useLocalSearchParams<{
    link: string;
    type: string;
    name: string;
  }>();

  let decodedLink = "";
  try {
    decodedLink = getRawDocumentUrl(link || "");
  } catch {
    // Show an actionable error screen instead of throwing during render.
  }
  const lowerType = getDocumentType(type || "", name || "", decodedLink);
  const isOffice = OFFICE_TYPES.includes(lowerType);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [webHeight, setWebHeight] = useState(200);
  const [txtContent, setTxtContent] = useState<string>("");
  const downloadLock = useRef(false);

  // Only open on a user gesture; no automatic redirect to Office Online.
  const openUrl = async (url: string) => {
    setError("");
    try {
      if (Platform.OS === "web") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        await Linking.openURL(url);
      }
    } catch {
      setError("Không mở được trình duyệt. Bạn có thể thử tải file về.");
    }
  };
  const openInBrowser = () => openUrl(decodedLink);

  /* =========================
      TXT
  ========================= */
  useEffect(() => {
    if (lowerType === "txt" && decodedLink) {
      setLoading(true);
      fetch(decodedLink)
        .then((res) => res.text())
        .then((text) => setTxtContent(text))
        .catch(() => Alert.alert("Lỗi", "Không tải được file TXT"))
        .finally(() => setLoading(false));
    }
  }, [decodedLink, lowerType]);

  /* =========================
      TẢI FILE + MỞ BẰNG APP KHÁC
  ========================= */
  const handleDownloadAndOpen = async () => {
    if (!decodedLink || downloadLock.current) return;
    if (Platform.OS === "web") {
      await openInBrowser();
      return;
    }
    downloadLock.current = true;
    setDownloading(true);
    setError("");
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setError("Thiết bị không hỗ trợ chia sẻ file. Hãy chọn mở link file gốc.");
        return;
      }
      // Use the raw file URL, never the Office HTML page; do not reuse stale cache.
      const safeName = getDocumentFileName(name || "", lowerType);
      const target = new File(Paths.cache, `${Date.now()}_${safeName}`);
      const downloaded = await File.downloadFileAsync(decodedLink, target);
      if (!downloaded.size) throw new Error("File tải về rỗng.");
      await Sharing.shareAsync(downloaded.uri, {
        mimeType: OFFICE_MIME[lowerType],
        dialogTitle: "Lưu vào Tệp hoặc mở bằng ứng dụng",
        UTI: OFFICE_UTI[lowerType],
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(`Không tải/mở được tài liệu: ${detail}. Bạn có thể thử mở link file gốc.`);
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  };

  const renderHTML = (html: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 10px; color: #111827; }
      </style>
    </head>
    <body>
      <pre>${html}</pre>
      <script>
        function sendHeight() {
          const height = document.body.scrollHeight;
          window.ReactNativeWebView.postMessage(height);
        }
        setTimeout(sendHeight, 300);
        setTimeout(sendHeight, 800);
        setTimeout(sendHeight, 1200);
      </script>
    </body>
    </html>
  `;

  /* =========================
      FILE OFFICE
  ========================= */
  if (!decodedLink) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: name || "Xem tài liệu", headerBackTitle: "Quay lại" }} />
        <View style={styles.center}>
          <Text style={styles.hintTitle}>Đường dẫn tài liệu không hợp lệ</Text>
          <Text style={styles.hintText}>Quay lại danh sách và thử tải lại tài liệu.</Text>
        </View>
      </View>
    );
  }

  if (isOffice) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{ title: name || "Xem tài liệu", headerBackTitle: "Quay lại" }}
        />

        <View style={styles.center}>
          <Text style={styles.hintTitle}>{name || "Tài liệu Office"}</Text>
          <Text style={styles.hintText}>
            Mở file gốc không qua Microsoft Office Online. Trình duyệt có thể
            xem trước hoặc tải xuống tùy thiết bị. Bạn cũng có thể lưu vào Tệp
            (Files) hoặc mở bằng Word/Pages/Excel đã cài đặt.
          </Text>
          {!!error && <Text accessibilityRole="alert" style={[styles.hintText, { color: "#B91C1C", marginTop: 12 }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 20 }]}
            onPress={openInBrowser}
          >
            <Text style={styles.primaryBtnText}>Mở link file gốc</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: 12 }]}
            onPress={handleDownloadAndOpen}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#E86F25" />
            ) : (
              <Text style={styles.secondaryBtnText}>
                {Platform.OS === "web" ? "Tải file gốc bằng trình duyệt" : "Tải về / Lưu vào Tệp / Mở bằng…"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: 12 }]}
            onPress={() => void openUrl(getOfficeViewerUrl(decodedLink))}
          >
            <Text style={styles.secondaryBtnText}>Thử xem bằng Office Online</Text>
          </TouchableOpacity>
          <Text style={[styles.hintText, { marginTop: 16 }]}>
            Office Online là dịch vụ Microsoft và cần truy cập được file qua
            Internet. Nếu trắng trang, quay lại và mở file gốc. Simulator có thể
            không có ứng dụng Word/Pages hay đầy đủ tùy chọn lưu file như máy thật.
          </Text>
        </View>
      </View>
    );
  }

  /* =========================
      TXT / PDF / ẢNH
  ========================= */
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: name || "Xem tài liệu", headerBackTitle: "Quay lại" }}
      />

      {loading && <ActivityIndicator size="large" style={styles.loading} />}

      {lowerType === "txt" ? (
        <WebView
          originWhitelist={["*"]}
          scrollEnabled={false}
          style={{ height: webHeight, flex: 1 }}
          onMessage={(event) => {
            const height = Number(event.nativeEvent.data);
            if (!isNaN(height)) setWebHeight(height);
          }}
          source={{ html: renderHTML(txtContent) }}
        />
      ) : (
        <WebView
          originWhitelist={["*"]}
          style={{ flex: 1 }}
          source={{ uri: decodedLink }}
          startInLoadingState={true}
          renderLoading={() => (
            <ActivityIndicator size="large" style={styles.loading} />
          )}
          onError={() => {
            if (Platform.OS !== "web") {
              Linking.openURL(decodedLink).catch(() =>
                Alert.alert("Lỗi", "Không thể hiển thị tài liệu này.")
              );
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  hintTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  loading: {
    position: "absolute",
    top: 200,
    alignSelf: "center",
    zIndex: 10,
  },
  primaryBtn: {
    backgroundColor: "#E86F25",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#E86F25",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#E86F25", fontWeight: "600", fontSize: 15 },
});