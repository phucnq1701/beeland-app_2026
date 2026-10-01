import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, elevation, radius, space } from '@/theme';

import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  count?: number;
  onPress: () => void;
  /** `soft`: không viền, nền trắng bóng nhẹ (kiểu trang chủ). */
  variant?: 'default' | 'soft';
};

/** Chip lọc ngang. Cao 36, hitSlop bù đủ vùng chạm 44. */
export function Chip({ label, selected = false, count, onPress, variant = 'default' }: ChipProps) {
  const text = count === undefined ? label : `${label} · ${count}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        variant === 'soft' ? (selected ? styles.softSelected : styles.softIdle) : null,
        pressed && !selected ? styles.pressed : null,
      ]}
    >
      <Text variant="caption" weight="medium" color={selected ? 'onInverse' : 'text'} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  selected: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  pressed: { backgroundColor: colors.surfaceMuted },
  softIdle: { height: 38, paddingHorizontal: space.lg, borderColor: colors.surface, ...elevation.soft },
  softSelected: { height: 38, paddingHorizontal: space.lg },
});
