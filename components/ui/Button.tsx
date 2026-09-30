import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, space } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** Hiện spinner và bỏ qua mọi lần bấm (chống bấm lặp khi mạng chậm). */
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const PALETTE: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: {
    bg: colors.surface,
    pressed: colors.surfaceMuted,
    fg: colors.inverse,
    border: colors.borderStrong,
  },
  ghost: { bg: 'transparent', pressed: colors.primarySubtle, fg: colors.primary },
  danger: { bg: colors.danger, pressed: colors.onDangerSubtle, fg: colors.onPrimary },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  fullWidth,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const p = PALETTE[variant];
  const inactive = disabled || loading;
  // Khi loading vẫn giữ màu của variant để người dùng thấy đang xử lý, không phải bị khoá.
  const showDisabledLook = disabled && !loading;
  const fg = showDisabledLook ? colors.textTertiary : p.fg;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: showDisabledLook
            ? colors.surfaceMuted
            : pressed
              ? p.pressed
              : p.bg,
          borderColor: showDisabledLook ? colors.surfaceMuted : (p.border ?? 'transparent'),
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : Icon ? (
          <Icon size={18} color={fg} strokeWidth={2.2} />
        ) : null}
        <Text
          variant="subhead"
          color={fg}
          numberOfLines={1}
          style={size === 'lg' ? styles.lgText : undefined}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: 44 },
  lg: { minHeight: 52 },
  lgText: { fontSize: 16, lineHeight: 22 },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
