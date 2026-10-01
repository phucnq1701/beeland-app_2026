import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, radius as radii, space } from '@/theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height, radius = radii.sm, style }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity }, style]}
    />
  );
}

/** Khung chờ cho danh sách: các hàng giống ListItem. */
export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityLabel="Đang tải" accessible>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={40} height={40} radius={radii.md} />
          <View style={styles.texts}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={10} />
          </View>
          <Skeleton width={70} height={12} />
        </View>
      ))}
    </View>
  );
}

/** Khung chờ cho màn chi tiết: khối lớn + 3 dòng. */
export function SkeletonDetail() {
  return (
    <View style={styles.detail} accessibilityLabel="Đang tải" accessible>
      <Skeleton height={120} radius={radii.lg} />
      <Skeleton width="70%" height={14} />
      <Skeleton width="90%" height={14} />
      <Skeleton width="50%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
  },
  texts: { flex: 1, gap: space.sm },
  detail: { gap: space.md, padding: space.lg },
});
