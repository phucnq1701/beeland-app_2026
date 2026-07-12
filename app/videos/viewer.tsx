import React, { useState, useEffect } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

// Lấy YouTube video ID từ nhiều dạng URL
const getYoutubeVideoId = (url: string): string | null => {
  const cleaned = url.trim();
  const patterns = [
    /[?&]v=([^&#\s]+)/, // ?v=xxx
    /youtu\.be\/([^?&\s]+)/, // youtu.be/xxx
    /embed\/([^?&\s]+)/, // /embed/xxx
    /shorts\/([^?&\s]+)/, // /shorts/xxx
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

// Tạo HTML embed YouTube responsive
const buildYoutubeHTML = (videoId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; }
    .wrap {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%;
      height: 0;
    }
    iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <iframe
      src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0"
      allow="autoplay; fullscreen; accelerometer; gyroscope"
      allowfullscreen
    ></iframe>
  </div>
</body>
</html>
`;

const buildTxtHTML = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 10px; color: #111827; }
    pre { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <pre>${content}</pre>
  <script>
    function sendHeight() { window.ReactNativeWebView.postMessage(document.body.scrollHeight); }
    setTimeout(sendHeight, 300);
    setTimeout(sendHeight, 800);
  </script>
</body>
</html>
`;

const getOfficeViewerUrl = (url: string) =>
  `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
    url
  )}`;

export default function DocumentViewer() {
  const { link, type, name } = useLocalSearchParams<{
    link: string;
    type: string;
    name: string;
  }>();

  const decodedLink = link ? decodeURIComponent(link) : "";
  const fileType = type?.toLowerCase() ?? "";

  const [txtContent, setTxtContent] = useState<string>("");
  const [webHeight, setWebHeight] = useState(200);

  useEffect(() => {
    if (fileType === "txt" && decodedLink) {
      fetch(decodedLink)
        .then((res) => res.text())
        .then(setTxtContent)
        .catch(() => Alert.alert("Lỗi", "Không tải được file TXT"));
    }
  }, [decodedLink, fileType]);

  // ----- YouTube -----
  if (fileType === "youtube") {
    const videoId = getYoutubeVideoId(decodedLink);
    if (!videoId) {
      Alert.alert("Lỗi", "Không nhận dạng được link YouTube");
    }
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{ title: name || "Video", headerBackTitle: "Quay lại" }}
        />
        <WebView
          style={styles.flex}
          originWhitelist={["*"]}
          source={{ html: buildYoutubeHTML(videoId ?? "") }}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          onError={() => Alert.alert("Lỗi", "Không thể phát video")}
        />
      </View>
    );
  }

  // ----- TXT -----
  if (fileType === "txt") {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{ title: name || "Tài liệu", headerBackTitle: "Quay lại" }}
        />
        <WebView
          originWhitelist={["*"]}
          scrollEnabled={false}
          style={{ height: webHeight, flex: 1 }}
          onMessage={(e) => {
            const h = Number(e.nativeEvent.data);
            if (!isNaN(h)) setWebHeight(h);
          }}
          source={{ html: buildTxtHTML(txtContent) }}
        />
      </View>
    );
  }

  // ----- Office files (doc/docx/xls/xlsx) → Office Viewer -----
  const officeTypes = ["doc", "docx", "xls", "xlsx"];
  const viewerUrl = officeTypes.includes(fileType)
    ? getOfficeViewerUrl(decodedLink)
    : decodedLink;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: name || "Tài liệu", headerBackTitle: "Quay lại" }}
      />
      <WebView
        originWhitelist={["*"]}
        style={styles.flex}
        source={{ uri: viewerUrl }}
        startInLoadingState
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        renderLoading={() => (
          <ActivityIndicator size="large" style={styles.loading} />
        )}
        onError={() => Alert.alert("Lỗi", "Không thể hiển thị tài liệu này.")}
      />
    </View>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  loading: {
    position: "absolute",
    top: height / 2 - 20,
    left: width / 2 - 20,
    zIndex: 10,
  },
});
