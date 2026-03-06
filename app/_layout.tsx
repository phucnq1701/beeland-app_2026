import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Quay lại" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen name="price-calculator/[id]" options={{ title: 'Tính giá sản phẩm' }} />
    </Stack>
  );
}

export default function RootLayout() {
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
      SplashScreen.hideAsync();
    };
    initApp();
  }, []);

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
});
