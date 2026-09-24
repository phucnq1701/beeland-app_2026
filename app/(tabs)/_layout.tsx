import { Tabs, useFocusEffect } from "expo-router";
import { Home, User } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import Colors from "@/constants/colors";
import { features } from "@/mocks/features";
import { loadMenuTabIds } from "@/components/utils/menuTabs";

// Chiều cao vùng nội dung của tab bar (chưa gồm safe-area phía dưới)
const TAB_BAR_CONTENT_HEIGHT = 50;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // 2 tab menu động ở giữa: cấu hình qua "Tất cả quản lý" → "Cấu hình menu"
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        headerShown: false,
        tabBarStyle: {
          // Kiểu Facebook: full width, dán sát đáy màn hình, nền trắng đục (opacity 1)
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          // height gồm cả safe-area để nền trắng phủ xuống vùng home indicator (iOS),
          // paddingBottom đẩy icon/label lên trên vùng đó.
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: '#FFFFFF',
          borderRadius: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(0, 0, 0, 0.12)',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
            web: {
              boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.06)',
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer]}>
              <Home 
                color={focused ? Colors.primary : Colors.textTertiary} 
                size={22} 
                strokeWidth={focused ? 2.5 : 2}
              />
          
            </View>
          ),
        }}
      />

      {/* 2 tab menu động ở giữa (nội dung cấu hình trong "Tất cả quản lý") */}
      <Tabs.Screen
        name="feature-1"
        options={{
          title: menuFeatures[0]?.title ?? "Menu",
          tabBarIcon: ({ focused }) => {
            const feature = menuFeatures[0];
            if (!feature) return null;
            const FeatureIcon = feature.icon;
            return (
              <View style={styles.iconContainer}>
                {/* Cùng tông màu với Home/Tài khoản: xám khi chưa chọn, màu chính khi chọn */}
                <FeatureIcon
                  color={focused ? Colors.primary : Colors.textTertiary}
                  size={22}
                  strokeWidth={focused ? 2.5 : 2}
                />
              </View>
            );
          },
        }}
      />
      <Tabs.Screen
        name="feature-2"
        options={{
          title: menuFeatures[1]?.title ?? "Menu",
          tabBarIcon: ({ focused }) => {
            const feature = menuFeatures[1];
            if (!feature) return null;
            const FeatureIcon = feature.icon;
            return (
              <View style={styles.iconContainer}>
                {/* Cùng tông màu với Home/Tài khoản: xám khi chưa chọn, màu chính khi chọn */}
                <FeatureIcon
                  color={focused ? Colors.primary : Colors.textTertiary}
                  size={22}
                  strokeWidth={focused ? 2.5 : 2}
                />
              </View>
            );
          },
        }}
      />

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
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer]}>
              <User 
                color={focused ? Colors.primary : Colors.textTertiary} 
                size={22} 
                strokeWidth={focused ? 2.5 : 2}
              />
           
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
 
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    backgroundColor: Colors.error,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.white,
    ...Platform.select({
      ios: {
        shadowColor: Colors.error,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
    }),
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
});