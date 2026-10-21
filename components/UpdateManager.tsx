import { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import { UserService } from "../sevices/UserService";
import { progressPercent, runOtaUpdate } from "@/lib/otaUpdate";
import { OtaUpdateScreen } from "./OtaUpdateScreen";

/**
 * Khi mở app:
 * 1. OTA (EAS Update): có bản JS mới → màn "đang cập nhật dữ liệu mới" (bắt buộc, không bỏ qua), tải xong tự reload.
 *    Offline / máy chủ lỗi → vào app bằng bản đang có. Chi tiết: docs/ota-update.md.
 * 2. Bản Store: máy chủ báo version native mới hơn → hộp "PHIÊN BẢN MỚI" mở link Store.
 */
export default function UpdateManager() {
  const [updating, setUpdating] = useState(false);
  const [visible, setVisible] = useState(false);
  const { downloadProgress } = Updates.useUpdates();

  useEffect(() => {
    (async () => {
      await checkExpoUpdate();
      await checkStoreVersion();
    })();
  }, []);

  const checkExpoUpdate = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    const result = await runOtaUpdate({
      check: Updates.checkForUpdateAsync,
      fetch: Updates.fetchUpdateAsync,
      reload: Updates.reloadAsync,
      onUpdating: () => {
        setUpdating(true);
        // Màn chờ phải hiện ngay, không nằm sau splash.
        void SplashScreen.hideAsync();
      },
    });
    if (result === "error") setUpdating(false);
  };

  const checkStoreVersion = async () => {
    try {
      const res = await UserService.checkVersion();
      // console.log("checkStoreVersion", res);
      const currentVersion = Number(Application.nativeApplicationVersion);
      // console.log("currentVersion", currentVersion);

      const serverVersion =
        Platform.OS === "ios"
          ? Number(res?.data?.VesionIOS)
          : Number(res?.data?.VesionAndroid);
      if (serverVersion > currentVersion) {
        setVisible(true);
      }
    } catch {}
  };

  const updateVersion = async () => {
    const res = await UserService.checkVersion();
    const url =
      Platform.OS === "ios" ? res?.data?.linkIOS : res?.data?.linkAndroid;
    if (url) Linking.openURL(url);
    setVisible(false);
  };

  if (updating) {
    return <OtaUpdateScreen percent={progressPercent(downloadProgress)} />;
  }

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        zIndex: 99999,
      }}
    >
      <View
        style={{
          backgroundColor: "#fff",
          padding: 20,
          borderRadius: 12,
          alignItems: "center",
          margin: 20,
        }}
      >
        <Text
          style={{
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          PHIÊN BẢN MỚI
        </Text>

        <Text
          style={{
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Đã có phiên bản mới vui lòng cập nhật.
        </Text>

        <TouchableOpacity
          onPress={updateVersion}
          style={{
            backgroundColor: "#FF4757",
            paddingHorizontal: 30,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Cập nhật</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
