import React, { forwardRef, useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { colors, fontStyleFor, MAX_FONT_SCALE, radius, space } from '@/theme';

import { useFontsLoaded } from './FontStatus';

import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string | null;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** `soft`: nền xám nhạt, không viền, bo lớn; focus → nền trắng + viền `primary` (đặt trong card trắng). */
  variant?: 'default' | 'soft';
};

/** Ô nhập chuẩn: nhãn luôn ở trên, lỗi/gợi ý ngay dưới ô (spec 4.5). */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, helper, error, required, prefix, suffix, containerStyle, variant = 'default', style, onFocus, onBlur, ...inputProps },
  ref
) {
  const [focused, setFocused] = useState(false);
  const fontsLoaded = useFontsLoaded();
  const soft = variant === 'soft';
  const borderStyle = soft
    ? error
      ? styles.softError
      : focused
        ? styles.softFocused
        : null
    : error
      ? styles.error
      : focused
        ? styles.focused
        : null;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text variant="caption" weight="semibold">
        {label}
        {required ? <Text variant="caption" weight="semibold" color="danger">{' *'}</Text> : null}
      </Text>
      <View style={[styles.box, soft ? styles.soft : null, borderStyle]}>
        {prefix}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          placeholderTextColor={colors.textTertiary}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, fontStyleFor('regular', fontsLoaded), style]}
        />
        {suffix}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="textSecondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: space.xs + 2 },
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  focused: { borderWidth: 2, borderColor: colors.primary, paddingHorizontal: space.md + 1 },
  error: { borderWidth: 2, borderColor: colors.danger, paddingHorizontal: space.md + 1 },
  // Viền soft giữ nguyên độ dày khi focus/lỗi → chữ không nhảy
  soft: {
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceMuted,
  },
  softFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  softError: { borderColor: colors.danger, backgroundColor: colors.surface },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
});
