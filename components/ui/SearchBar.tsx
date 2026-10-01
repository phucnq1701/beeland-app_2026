import { Search, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput } from 'react-native';

import { colors, elevation, fontStyleFor, hitSlop, MAX_FONT_SCALE, motion, radius, space } from '@/theme';

import { useFontsLoaded } from './FontStatus';

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** `soft`: bo tròn hẳn, không viền, bóng nhẹ (kiểu trang chủ). */
  variant?: 'default' | 'soft';
};

/**
 * Ô tìm kiếm. Màn tự debounce bằng useDebouncedValue.
 * Focus → viền chuyển dần sang `primary`, icon kính lúp đổi màu; nút xoá hiện/ẩn mờ dần.
 */
export function SearchBar({ value, onChangeText, placeholder = 'Tìm kiếm', autoFocus, variant = 'default' }: SearchBarProps) {
  const fontsLoaded = useFontsLoaded();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const clearAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const soft = variant === 'soft';

  useEffect(() => {
    // Màu viền không chạy được native driver
    Animated.timing(focusAnim, { toValue: focused ? 1 : 0, duration: motion.enter, useNativeDriver: false }).start();
  }, [focused, focusAnim]);

  useEffect(() => {
    Animated.timing(clearAnim, { toValue: value ? 1 : 0, duration: motion.press + 50, useNativeDriver: true }).start();
  }, [value, clearAnim]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [soft ? colors.surface : colors.borderStrong, colors.primary],
  });

  return (
    // Chạm vào bất kỳ đâu trong ô (kể cả icon) đều focus input
    <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
      <Animated.View style={[styles.box, soft ? styles.soft : null, { borderColor }]}>
        <Search size={18} color={focused ? colors.primary : colors.textTertiary} strokeWidth={2} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={placeholder}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.input, fontStyleFor('regular', fontsLoaded)]}
        />
        <Animated.View
          pointerEvents={value ? 'auto' : 'none'}
          style={{ opacity: clearAnim, transform: [{ scale: clearAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xoá tìm kiếm"
            accessibilityElementsHidden={!value}
            hitSlop={hitSlop}
            onPress={() => onChangeText('')}
            style={({ pressed }) => [styles.clear, pressed ? styles.clearPressed : null]}
          >
            <X size={14} color={colors.textSecondary} strokeWidth={2.5} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  soft: {
    minHeight: 50,
    paddingLeft: space.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
    ...elevation.soft,
  },
  input: {
    flex: 1,
    minHeight: 42,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  clearPressed: { backgroundColor: colors.border },
});
