import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import { UserService } from "../sevices/UserService";

export default function UpdateManager() {
  const [updating, setUpdating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      await checkExpoUpdate();
      await checkStoreVersion();
    })();
  }, []);

  const checkExpoUpdate = async () => {
    try {
      await new Promise((res) => setTimeout(res, 1000));
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdating(true);
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch {}
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
    Linking.openURL(url);
    setVisible(false);
  };

  if (updating) {
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
            width: 250,
            padding: 20,
            backgroundColor: "#fff",
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10 }}>Đang cập nhật phiên bản mới...</Text>
        </View>
      </View>
    );
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
