import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme';

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  padding?: number;
  tone?: 'work' | 'showcase';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Card phẳng + viền (không bóng). Có onPress thì chạm được. */
export function Card({ children, onPress, padding = space.lg, tone = 'work', style, accessibilityLabel }: CardProps) {
  const toneStyle = tone === 'showcase' ? styles.showcase : styles.work;
  if (!onPress) {
    return <View style={[styles.base, toneStyle, { padding }, style]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.base, toneStyle, { padding, opacity: pressed ? 0.85 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  work: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  showcase: { backgroundColor: colors.showcase.surface },
});
