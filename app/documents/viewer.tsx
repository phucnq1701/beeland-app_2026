import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Dimensions, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

export default function DocumentViewer() {
  const { link, type, name } = useLocalSearchParams<{
    link: string;
    type: string;
    name: string;
  }>();

  const decodedLink = link ? decodeURIComponent(link) : "";

  const [loading, setLoading] = useState(false);
  const [webHeight, setWebHeight] = useState(200);
  const [txtContent, setTxtContent] = useState<string>("");

  useEffect(() => {
    if (type?.toLowerCase() === "txt" && decodedLink) {
      fetch(decodedLink)
        .then((res) => res.text())
        .then((text) => setTxtContent(text))
        .catch(() => Alert.alert("Lỗi", "Không tải được file TXT"))
        .finally(() => setLoading(false));
    }
  }, [decodedLink, type]);

  const getWebViewLink = (fileType: string, url: string) => {
    const lowerType = fileType.toLowerCase();
    if (["doc", "docx", "xls", "xlsx"].includes(lowerType)) {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
    }
    return url;
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: name || "Xem tài liệu", headerBackTitle: "Quay lại" }}
      />

      {loading && <ActivityIndicator size="large" style={styles.loading} />}

      {type?.toLowerCase() === "txt" ? (
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
          source={{ uri: getWebViewLink(type || "", decodedLink) }}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator size="large" style={styles.loading} />}
          onError={() => Alert.alert("Lỗi", "Không thể hiển thị tài liệu này.")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loading: {
    position: "absolute",
    top: Dimensions.get("window").height / 2 - 20,
    left: Dimensions.get("window").width / 2 - 20,
    zIndex: 10,
  },
});