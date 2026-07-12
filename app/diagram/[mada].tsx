import React, { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";

// const BASE_URL = "https://rem-dev.beesky.vn/products/sodophanlo-app";
const BASE_URL = "https://rem.beesky.vn/products/sodophanlo-app";

export default function DocumentViewer() {
  const { mada } = useLocalSearchParams<{ mada: string }>();
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buildUrl = async () => {
      try {
        const token = await AsyncStorage.getItem("@token");
        const url = `${BASE_URL}?token=${encodeURIComponent(
          token ?? ""
        )}&mada=${encodeURIComponent(mada ?? "")}`;
        setUri(url);
      } catch (e) {
        Alert.alert("Lỗi", "Không lấy được thông tin phiên đăng nhập");
      }
    };
    buildUrl();
  }, [mada]);

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
          onError={() => Alert.alert("Lỗi", "Không thể hiển thị sơ đồ")}
        />
      )}
      {loading && <ActivityIndicator size="large" style={styles.loading} />}
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
