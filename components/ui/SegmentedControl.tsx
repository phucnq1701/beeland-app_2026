import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, elevation, radius, space } from '@/theme';

import { Text } from './Text';

export type SegmentedControlProps<T extends string> = {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** `soft`: rãnh + phân đoạn bo tròn hẳn, phân đoạn chọn có bóng nhẹ (kiểu trang chủ). */
  /** `accent`: như `soft` nhưng rãnh cam nhạt, chữ cam đậm; phân đoạn chọn trắng chữ `primary` (đăng nhập). */
  variant?: 'default' | 'soft' | 'accent';
};

/** Chọn 1 trong 2–3 phân đoạn (vd "Trang chủ" / "Tab menu"). */
export function SegmentedControl<T extends string>({ value, options, onChange, variant = 'default' }: SegmentedControlProps<T>) {
  const accent = variant === 'accent';
  const soft = variant === 'soft' || accent;
  return (
    <View style={[styles.track, soft ? styles.softTrack : null, accent ? styles.accentTrack : null]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              soft ? styles.softSegment : null,
              accent ? styles.accentSegment : null,
              selected ? [styles.selected, soft ? elevation.soft : elevation.raised] : null,
            ]}
          >
            <Text
              variant={soft ? 'caption' : 'subhead'}
              weight={soft ? 'semibold' : undefined}
              color={selected ? (soft ? 'primary' : 'text') : accent ? 'onPrimarySubtle' : 'textSecondary'}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
  },
  selected: { backgroundColor: colors.surface },
  softTrack: { borderRadius: radius.full, padding: 5, gap: 0, backgroundColor: colors.border },
  softSegment: { minHeight: 38, borderRadius: radius.full },
  accentTrack: { backgroundColor: colors.primarySubtle },
  accentSegment: { minHeight: 42 },
});
