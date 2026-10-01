import { Check, ChevronDown } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { foldVietnamese as fold } from '@/lib/format';
import { colors, elevation, radius, space } from '@/theme';

import { BottomSheet } from './BottomSheet';
import { EmptyState } from './EmptyState';
import { SearchBar } from './SearchBar';
import { Text } from './Text';

export type SelectOption<T extends string | number> = { value: T; label: string; description?: string };

export type SelectFieldProps<T extends string | number> = {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  loading?: boolean;
  sheetTitle?: string;
  /**
   * `soft`: cùng kiểu TextField soft (nền xám nhạt, không viền, bo lớn) – đặt trong card trắng.
   * `raised`: nền trắng, viên thuốc, bóng nhẹ – đặt thẳng trên nền màn (bộ lọc).
   */
  variant?: 'default' | 'soft' | 'raised';
};

const SEARCH_THRESHOLD = 8;

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Chọn',
  error,
  required,
  loading,
  sheetTitle,
  variant = 'default',
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? options.filter((o) => fold(o.label).includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <Text variant="caption" weight="semibold">
        {label}
        {required ? <Text variant="caption" weight="semibold" color="danger">{' *'}</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint={error ?? undefined}
        disabled={loading}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.box,
          variant === 'soft' ? styles.soft : variant === 'raised' ? styles.raised : null,
          error ? (variant === 'default' ? styles.error : styles.softError) : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text variant="body" color={selected ? 'text' : 'textTertiary'} numberOfLines={1} style={styles.value}>
          {selected?.label ?? placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" color={colors.textTertiary} /> : <ChevronDown size={18} color={colors.textTertiary} />}
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={open} onClose={close} title={sheetTitle ?? label}>
        {options.length > SEARCH_THRESHOLD ? (
          <View style={styles.search}>
            <SearchBar value={query} onChangeText={setQuery} />
          </View>
        ) : null}
        {/* ScrollView + map (danh sách ngắn): FlatList lồng trong ScrollView của Screen gây cảnh báo VirtualizedList. */}
        <ScrollView keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? <EmptyState title="Không có kết quả" /> : null}
          {filtered.map((item) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                key={String(item.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
                style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
              >
                <View style={styles.optionTexts}>
                  <Text variant="body" weight={isSelected ? 'semibold' : undefined}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text variant="caption" color="textSecondary">
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Check size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

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
  error: { borderWidth: 2, borderColor: colors.danger },
  soft: {
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceMuted,
  },
  softError: { borderColor: colors.danger, backgroundColor: colors.surface },
  raised: {
    minHeight: 50,
    paddingHorizontal: space.lg + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  value: { flex: 1 },
  search: { marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionTexts: { flex: 1, gap: 2 },
});
