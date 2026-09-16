import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

import { getValidSupabaseJwt } from "@/sevicesSupabase/cloudTenant";

// Trang sơ đồ phân lô — đọc dữ liệu bằng cloud_jwt (xem API doc mục "Sơ đồ phân lô")
const BASE_URL = "https://real.beesky.vn/products/sodophanlo-app";

export default function DiagramViewer() {
  const { mada } = useLocalSearchParams<{ mada: string }>();
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      // Trang web đọc dữ liệu bằng cloud_jwt (7 ngày) — KHÔNG dùng legacy @token.
      // Token legacy không được nhận → trang hiện form đăng nhập.
      const cloudJwt = await getValidSupabaseJwt();

      if (!cloudJwt) {
        setError(
          "Phiên đăng nhập cloud đã hết hạn. Vui lòng đăng xuất và đăng nhập lại."
        );
        setLoading(false);
        return;
      }

      // Theo API doc: ?jwt=<cloud_jwt>&mada=<ma_da_code>
      // (param token=<cloud_jwt> cũng được trang tự nhận — chuỗi 3 phần JWT)
      const url =
        `${BASE_URL}?jwt=${encodeURIComponent(cloudJwt)}` +
        `&token=${encodeURIComponent(cloudJwt)}` +
        `&mada=${encodeURIComponent(mada ?? "")}`;
      setUri(url);
    } catch (e) {
      setError("Không lấy được thông tin phiên đăng nhập");
      setLoading(false);
    }
  };

  useEffect(() => {
    void buildUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mada]);

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen
          options={{ title: "Sơ đồ phân lô", headerBackTitle: "Quay lại" }}
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void buildUrl()}>
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: "Sơ đồ phân lô", headerBackTitle: "Quay lại" }}
      />
      {uri && (
        <WebView
          style={styles.flex}
          source={{ uri }}
          originWhitelist={["*"]}
          startInLoadingState
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          onError={() =>
            Alert.alert("Lỗi", "Không thể hiển thị sơ đồ phân lô")
          }
        />
      )}
      {loading && <ActivityIndicator size="large" style={styles.loading} />}
    </View>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    padding: 24,
  },
  flex: { flex: 1 },
  loading: {
    position: "absolute",
    top: height / 2 - 20,
    left: width / 2 - 20,
    zIndex: 10,
  },
  errorText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "#E86F25",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});