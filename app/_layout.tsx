import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateManager from "@/components/UpdateManager";
import { ToastProvider } from "@/components/ui/Toast";
import { applyWebFont } from "@/constants/webFont";
import { fonts } from "@/theme";
SplashScreen.preventAutoHideAsync();
applyWebFont();

const queryClient = new QueryClient();

// Không chờ font quá lâu: hết thời gian thì mở app bằng font hệ thống.
const FONT_TIMEOUT_MS = 3000;

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
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: require("../assets/fonts/BeVietnamPro-Regular.ttf"),
    [fonts.medium]: require("../assets/fonts/BeVietnamPro-Medium.ttf"),
    [fonts.semibold]: require("../assets/fonts/BeVietnamPro-SemiBold.ttf"),
    [fonts.bold]: require("../assets/fonts/BeVietnamPro-Bold.ttf"),
  });
  const [storageChecked, setStorageChecked] = useState(false);
  const [fontTimedOut, setFontTimedOut] = useState(false);
  const splashHidden = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fontsSettled = fontsLoaded || !!fontError || fontTimedOut;
    if (!storageChecked || !fontsSettled || splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.hideAsync();
  }, [storageChecked, fontsLoaded, fontError, fontTimedOut]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const stored = await AsyncStorage.getItem('@home_features_config');
        if (stored) {
          try {
            JSON.parse(stored);
          } catch (parseError) {
            console.log('[RootLayout] Clearing corrupted AsyncStorage data');
            await AsyncStorage.removeItem('@home_features_config');
          }
        }
      } catch (error) {
        console.log('[RootLayout] AsyncStorage check error:', error instanceof Error ? error.message : String(error));
      }
      setStorageChecked(true);
    };
    initApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <ToastProvider>
          <StatusBar style="dark" />
          <RootLayoutNav />
        </ToastProvider>
      </GestureHandlerRootView>
      <UpdateManager />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
