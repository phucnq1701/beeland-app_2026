import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, elevation, radius, space } from "@/theme";

/** Các tab hiện trên thanh (route khác như `ai-chat` có `href: null` → bỏ qua). */
const VISIBLE_ROUTES = ["home", "feature-1", "feature-2", "account"];

export const TAB_BAR_HEIGHT = 54;
const PAD = 5;
/** Mỗi tab rộng cố định → thanh gọn, căn giữa (kiểu Instagram), không kéo hết bề ngang. */
const SLOT = 64;
const PILL_H = TAB_BAR_HEIGHT - PAD * 2;
const PILL_W = SLOT - 6;

/**
 * Thanh tab nổi dạng viên thuốc kính xanh xám mờ, căn giữa: chỉ icon, tab đang chọn nằm trong viên
 * kính sáng (icon cam) trượt mượt giữa các tab. Nhãn vẫn đọc được bằng trình đọc màn hình (`tabBarAccessibilityLabel`).
 * Nội dung các màn chừa đáy `TAB_BAR_SPACE` = 100 (≥ bottom + TAB_BAR_HEIGHT).
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => VISIBLE_ROUTES.includes(r.name));
  const activeIndex = Math.max(
    0,
    routes.findIndex((r) => r.key === state.routes[state.index]?.key),
  );

  const offsetOf = (i: number) => SLOT * i + (SLOT - PILL_W) / 2;
  // Khởi tạo đúng vị trí tab hiện tại → lần đầu không trượt từ mép trái
  const x = useRef(new Animated.Value(offsetOf(activeIndex))).current;

  useEffect(() => {
    Animated.spring(x, { toValue: offsetOf(activeIndex), useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [activeIndex, x]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - space.sm, space.md) }]}>
      <View style={styles.shadow}>
        <View style={styles.bar}>
          {/* Android cần dimezisBlurView mới nhòe thật; thiếu nó lớp phủ navy sẽ trông loang */}
          <BlurView
            intensity={95}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.frost]} />
          <Animated.View style={[styles.pill, { transform: [{ translateX: x }] }]} />
          {routes.map((route, i) => {
            const { options } = descriptors[route.key];
            const focused = i === activeIndex;
            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [styles.item, pressed && !focused ? styles.pressed : null]}
              >
                {options.tabBarIcon?.({
                  focused,
                  color: focused ? colors.primary : colors.inverse,
                  size: 20,
                })}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  // Bóng ở lớp ngoài; lớp trong bo + cắt để BlurView không tràn góc (iOS: overflow hidden làm mất bóng)
  shadow: { borderRadius: radius.full, ...elevation.overlay },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PAD,
    borderRadius: radius.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.frostedBorder,
  },
  frost: { backgroundColor: colors.frosted },
  pill: {
    position: "absolute",
    left: PAD,
    top: PAD - 1,
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    backgroundColor: colors.frostedActive,
  },
  item: { width: SLOT, height: PILL_H, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
