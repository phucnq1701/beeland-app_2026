import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, hitSlop, MIN_TOUCH, radius } from '@/theme';

export type IconButtonProps = {
  icon: LucideIcon;
  onPress: () => void;
  /** Bắt buộc: nút chỉ có icon phải đọc được bằng trình đọc màn hình. */
  accessibilityLabel: string;
  variant?: 'plain' | 'filled' | 'onDark';
  color?: string;
  disabled?: boolean;
};

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  color,
  disabled,
}: IconButtonProps) {
  const fg =
    color ?? (variant === 'onDark' ? colors.showcase.text : disabled ? colors.textTertiary : colors.inverse);
  const bg =
    variant === 'filled' ? colors.surfaceMuted : variant === 'onDark' ? colors.showcase.surface : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: bg, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon size={22} color={fg} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
