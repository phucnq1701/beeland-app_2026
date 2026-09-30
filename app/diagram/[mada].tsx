import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

import { AppHeader, ErrorState, Screen, SkeletonDetail } from "@/components/ui";
import { colors } from "@/theme";
import { getValidSupabaseJwt } from "@/sevicesSupabase/cloudTenant";

// Trang sơ đồ phân lô — đọc dữ liệu bằng cloud_jwt (xem API doc mục "Sơ đồ phân lô")
const BASE_URL = "https://real.beesky.vn/products/sodophanlo-app";

export default function DiagramViewer() {
  const { mada } = useLocalSearchParams<{ mada: string }>();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tăng key để WebView tải lại từ đầu khi bấm "Thử lại"
  const [reloadKey, setReloadKey] = useState(0);

  const buildUrl = async () => {
    setError(null);
    try {
      // Trang web đọc dữ liệu bằng cloud_jwt (7 ngày) — KHÔNG dùng legacy @token.
      // Token legacy không được nhận → trang hiện form đăng nhập.
      const cloudJwt = await getValidSupabaseJwt();

      if (!cloudJwt) {
        setError("Phiên đăng nhập cloud đã hết hạn. Vui lòng đăng xuất và đăng nhập lại.");
        return;
      }

      // Theo API doc: ?jwt=<cloud_jwt>&mada=<ma_da_code>
      // (param token=<cloud_jwt> cũng được trang tự nhận — chuỗi 3 phần JWT)
      const url =
        `${BASE_URL}?jwt=${encodeURIComponent(cloudJwt)}` +
        `&token=${encodeURIComponent(cloudJwt)}` +
        `&mada=${encodeURIComponent(mada ?? "")}`;
      setUri(url);
    } catch {
      setError("Không lấy được thông tin phiên đăng nhập");
    }
  };

  useEffect(() => {
    void buildUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mada]);

  const retry = () => {
    setReloadKey((k) => k + 1);
    void buildUrl();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll={false} padded={false} header={<AppHeader title="Sơ đồ phân lô" />}>
        {error ? (
          <ErrorState title="Không hiển thị được sơ đồ" description={error} onRetry={retry} />
        ) : uri ? (
          <WebView
            key={reloadKey}
            style={styles.flex}
            source={{ uri }}
            originWhitelist={["*"]}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <SkeletonDetail />
              </View>
            )}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            onError={() => setError("Không thể hiển thị sơ đồ phân lô. Kiểm tra kết nối mạng rồi thử lại.")}
            onHttpError={() => setError("Máy chủ sơ đồ phân lô đang lỗi. Vui lòng thử lại sau.")}
          />
        ) : (
          <SkeletonDetail />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
});
