import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { AuthService } from "./sevices/AuthService";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // 👈 hiển thị banner khi app đang mở
    shouldPlaySound: true, // 👈 có tiếng
    shouldSetBadge: false,
  }),
});
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Quay lại" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen name="price-calculator/[id]" options={{ title: 'Tính giá sản phẩm' }} />
      <Stack.Screen name="customer/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="contract/[id]" options={{ headerShown: true, title: 'Chi tiết hợp đồng' }} />
      <Stack.Screen name="deposits" options={{ headerShown: true, title: 'Đặt cọc' }} />
      <Stack.Screen name="deposit/[id]" options={{ headerShown: true, title: 'Chi tiết đặt cọc' }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [updating, setUpdating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdating(true);
          // tải update
          await Updates.fetchUpdateAsync();
          // apply ngay không cần người dùng đóng app
          await Updates.reloadAsync();
        }
      } catch (e) {}
    }
    checkForUpdates();
    async function checkForUpdateStoreAsync() {
      try {
        let _res = await AuthService.checkVersion();
        const currentVersion = Application.nativeApplicationVersion;
        const serverIOS = Number(_res?.data?.VesionIOS);
        const serverAndroid = Number(_res?.data?.VesionAndroid);
        if (Platform.OS === "ios") {
          if (serverIOS > Number(currentVersion)) {
            setVisible(true);
          }
        } else {
          if (serverAndroid > Number(currentVersion)) {
            setVisible(true);
          }
        }
      } catch {}
    }
    checkForUpdateStoreAsync();
    const initApp = async () => {
      try {
        const stored = await AsyncStorage.getItem("@home_features_config");
        if (stored) {
          try {
            JSON.parse(stored);
          } catch (parseError) {
            console.log("[RootLayout] Clearing corrupted AsyncStorage data");
            await AsyncStorage.removeItem("@home_features_config");
          }
        }
      } catch (error) {
        console.log(
          "[RootLayout] AsyncStorage check error:",
          error instanceof Error ? error.message : String(error),
        );
      }
      SplashScreen.hideAsync();
    };
    initApp();
  }, []);
  const updateVersion = async () => {
    let _res = await AuthService.checkVersion();
    if (Platform.OS === "ios") {
      Linking.openURL(_res?.data?.linkIOS);
      setVisible(false);
    } else {
      Linking.openURL(_res?.data?.linkAndroid);
      setVisible(false);
    }
  };
  if (updating) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.4)", // nền tối mờ
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
          <ActivityIndicator size="large" color="#000" />
          <Text style={{ marginTop: 10, fontSize: 16, textAlign: "center" }}>
            Đang cập nhật phiên bản mới...
          </Text>
        </View>
      </View>
    );
  }
  if (visible) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.4)", // nền tối mờ
        }}
      >
        <View style={styles.process}>
          <Text
            style={{
              marginBottom: 16,
              fontSize: 14,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            PHIÊN BẢN MỚI
          </Text>
          <Text
            style={{
              marginBottom: 16,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Đã có phiên bản mới vui lòng cập nhật để có trải nghiệm tốt nhất
          </Text>
          <TouchableOpacity
            onPress={() => updateVersion()}
            style={{
              // width: 150,
              backgroundColor: "#FF4757",
              paddingHorizontal: 30,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Text style={{ fontWeight: "900", color: "white" }}>Cập nhật</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  process: {
    backgroundColor: "white",
    alignItems: "center",
    borderRadius: 8,
    padding: 16,
    margin: 20,
  },
});
