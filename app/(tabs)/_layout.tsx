import { Tabs, useFocusEffect } from "expo-router";
import { Home, LucideIcon, User } from "lucide-react-native";
import React, { useCallback, useState } from "react";

import { FloatingTabBar } from "@/components/home/FloatingTabBar";
import { colors } from "@/theme";
import { features } from "@/mocks/features";
import { loadMenuTabIds } from "@/components/utils/menuTabs";

function TabIcon({ icon: Icon, focused, color }: { icon: LucideIcon; focused: boolean; color: string }) {
  return <Icon color={color} size={20} strokeWidth={focused ? 2.25 : 1.9} />;
}

export default function TabLayout() {
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
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
        feature ? <TabIcon icon={feature.icon} focused={focused} color={color} /> : null,
    };
  };

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trang chủ",
          tabBarAccessibilityLabel: "Trang chủ",
          tabBarIcon: ({ focused, color }) => <TabIcon icon={Home} focused={focused} color={color} />,
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
          tabBarIcon: ({ focused, color }) => <TabIcon icon={User} focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
