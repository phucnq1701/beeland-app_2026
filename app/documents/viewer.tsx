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

// Định dạng Office không render trực tiếp trong WebView iOS.
const OFFICE_EXTS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

const OFFICE_VIEWER_HOST = "view.officeapps.live.com";

function getFileExtension(url: string, fallback: string): string {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const ext = clean.substring(clean.lastIndexOf(".") + 1).toLowerCase();
    return ext && ext.length <= 5 ? ext : fallback;
  } catch {
    return fallback;
  }
}

/**
 * QUY TẮC: file Office KHÔNG trả URL gốc — phải đóng gói thành
 * https://view.officeapps.live.com/op/view.aspx?src=<URL_FILE_GOC_DA_URL_ENCODE>
 */
function toOfficeViewerUrl(fileUrl: string): string {
  if (fileUrl.includes(OFFICE_VIEWER_HOST)) return fileUrl; // đã wrap, tránh double
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export default function DocumentViewer() {
  const { link, type, name } = useLocalSearchParams<{
    link: string;
    type: string;
    name: string;
  }>();

  const decodedLink = link ? decodeURIComponent(link) : "";
  const lowerType = (type || "").toLowerCase();
  const isOffice =
    OFFICE_EXTS.includes(lowerType) || decodedLink.includes(OFFICE_VIEWER_HOST);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [webHeight, setWebHeight] = useState(200);
  const [txtContent, setTxtContent] = useState<string>("");
  const autoOpened = useRef(false);

  // URL Office Viewer cuối cùng (link vào đã wrap thì giữ nguyên)
  const viewerUrl = isOffice ? toOfficeViewerUrl(decodedLink) : decodedLink;

  const openInBrowser = async () => {
    try {
      await Linking.openURL(viewerUrl);
    } catch {
      Alert.alert("Lỗi", "Không mở được trình duyệt");
    }
  };

  // File Office: tự động mở bằng trình duyệt hệ thống (giống hành vi web)
  useEffect(() => {
    if (isOffice && viewerUrl && !autoOpened.current) {
      autoOpened.current = true;
      void openInBrowser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffice, viewerUrl]);

  /* =========================
      TXT
  ========================= */
  useEffect(() => {
    if (lowerType === "txt" && decodedLink && !decodedLink.includes(OFFICE_VIEWER_HOST)) {
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
    if (!decodedLink) return;
    try {
      if (Platform.OS === "web") {
        window.open(decodedLink, "_blank");
        return;
      }

      setDownloading(true);

      const fileName =
        (name && name.trim()) ||
        `document.${getFileExtension(decodedLink, "docx")}`;
      const safeName = fileName.replace(/[^\w.\-() ]+/g, "_");

      // API expo-file-system v19: File + Paths + downloadFileAsync
      const target = new File(Paths.cache, safeName);
      const downloaded = target.exists
        ? target
        : await File.downloadFileAsync(decodedLink, target);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          dialogTitle: "Mở tài liệu bằng",
          UTI: "org.openxmlformats.wordprocessingml.document",
        });
      } else {
        await Linking.openURL(decodedLink);
      }
    } catch (e) {
      console.log("Download/open error:", e);
      Alert.alert(
        "Lỗi",
        "Không tải/mở được tài liệu. Thử mở bằng trình duyệt."
      );
    } finally {
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
  if (isOffice) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{ title: name || "Xem tài liệu", headerBackTitle: "Quay lại" }}
        />

        <View style={styles.center}>
          <Text style={styles.hintTitle}>Đang mở tài liệu…</Text>
          <Text style={styles.hintText}>
            Tài liệu Word/Excel được mở bằng trình duyệt (giống trên web). Nếu
            không tự mở, bấm nút bên dưới.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 20 }]}
            onPress={openInBrowser}
          >
            <Text style={styles.primaryBtnText}>Mở bằng trình duyệt</Text>
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
                Tải về & mở bằng ứng dụng khác
              </Text>
            )}
          </TouchableOpacity>
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