import { Tabs } from "expo-router";
import { Home, MessageCircle, User } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import Colors from "@/constants/colors";
import { chatGroups } from "@/mocks/chatGroups";

export default function TabLayout() {
  const totalUnreadCount = chatGroups.reduce(
    (sum, group) => sum + group.unreadCount,
    0
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Home 
                color={focused ? Colors.primary : Colors.textTertiary} 
                size={22} 
                strokeWidth={focused ? 2.5 : 2}
              />
              {focused && (
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryLight]}
                  style={styles.activeIndicator}
                />
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="ai-chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <MessageCircle 
                color={focused ? Colors.primary : Colors.textTertiary} 
                size={22} 
                strokeWidth={focused ? 2.5 : 2}
              />
              {totalUnreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                  </Text>
                </View>
              )}
              {focused && (
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryLight]}
                  style={styles.activeIndicator}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <User 
                color={focused ? Colors.primary : Colors.textTertiary} 
                size={22} 
                strokeWidth={focused ? 2.5 : 2}
              />
              {focused && (
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryLight]}
                  style={styles.activeIndicator}
                />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(232, 111, 37, 0.12)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 30px rgba(232, 111, 37, 0.08)',
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(232, 111, 37, 0.1)',
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
