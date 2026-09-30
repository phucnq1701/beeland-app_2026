import { Tabs, useFocusEffect } from "expo-router";
import { Home, LucideIcon, User } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { colors, elevation } from "@/theme";
import { features } from "@/mocks/features";
import { loadMenuTabIds } from "@/components/utils/menuTabs";

// Chiều cao vùng nội dung của tab bar (chưa gồm safe-area phía dưới)
const TAB_BAR_CONTENT_HEIGHT = 56;

function TabIcon({ icon: Icon, focused }: { icon: LucideIcon; focused: boolean }) {
  return (
    <Icon
      color={focused ? colors.primary : colors.textTertiary}
      size={24}
      strokeWidth={focused ? 2.25 : 1.75}
    />
  );
}

function TabLabel({ title, focused }: { title: string; focused: boolean }) {
  return (
    // Nhãn tab không phóng theo cỡ chữ hệ thống để thanh tab không vỡ (ngoại lệ có chủ đích).
    <Text
      variant="label"
      weight={focused ? "semibold" : "medium"}
      color={focused ? "primary" : "textTertiary"}
      numberOfLines={1}
      allowFontScaling={false}
      style={styles.label}
    >
      {title}
    </Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // 2 tab menu động ở giữa: cấu hình qua "Tất cả quản lý" → "Tab menu"
  // Mặc định: 2 mục đầu tiên (Dự án, Sản phẩm)
  const [menuTabIds, setMenuTabIds] = useState<string[]>(() =>
    features.slice(0, 2).map((f) => f.id)
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadMenuTabIds()
        .then((ids) => {
          if (alive) setMenuTabIds(ids);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [])
  );

  const menuFeatures = [0, 1].map((slot) => {
    const id = menuTabIds[slot];
    return features.find((f) => f.id === id) ?? features[slot];
  });

  const featureTab = (slot: 0 | 1) => {
    const feature = menuFeatures[slot];
    const title = feature?.title ?? "Menu";
    return {
      title,
      tabBarAccessibilityLabel: title,
      tabBarLabel: ({ focused }: { focused: boolean }) => <TabLabel title={title} focused={focused} />,
      tabBarIcon: ({ focused }: { focused: boolean }) =>
        feature ? <TabIcon icon={feature.icon} focused={focused} /> : null,
    };
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          // Full width, dán sát đáy; height gồm safe-area để nền phủ vùng home indicator (iOS)
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          ...elevation.raised,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trang chủ",
          tabBarAccessibilityLabel: "Trang chủ",
          tabBarLabel: ({ focused }) => <TabLabel title="Trang chủ" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon icon={Home} focused={focused} />,
        }}
      />

      {/* 2 tab menu động ở giữa (nội dung cấu hình trong "Tất cả quản lý") */}
      <Tabs.Screen name="feature-1" options={featureTab(0)} />
      <Tabs.Screen name="feature-2" options={featureTab(1)} />

      <Tabs.Screen
        name="ai-chat"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarAccessibilityLabel: "Tài khoản",
          tabBarLabel: ({ focused }) => <TabLabel title="Tài khoản" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon icon={User} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { letterSpacing: 0, marginTop: 2 },
});
