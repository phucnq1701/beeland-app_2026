import { Search, X } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, fontStyleFor, MAX_FONT_SCALE, radius, space } from '@/theme';

import { useFontsLoaded } from './FontStatus';

import { IconButton } from './IconButton';

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

/** Ô tìm kiếm. Màn tự debounce bằng useDebouncedValue. */
export function SearchBar({ value, onChangeText, placeholder = 'Tìm kiếm', autoFocus }: SearchBarProps) {
  const fontsLoaded = useFontsLoaded();
  return (
    <View style={styles.box}>
      <Search size={18} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.input, fontStyleFor('regular', fontsLoaded)]}
      />
      {value ? <IconButton icon={X} accessibilityLabel="Xoá tìm kiếm" onPress={() => onChangeText('')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
});
