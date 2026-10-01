import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatDate } from '@/lib/format';
import { colors, radius, space } from '@/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';

export type DateFieldProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

/**
 * Ô chọn ngày. Android: hộp chọn ngày của hệ thống; iOS: bánh xe trong BottomSheet + nút "Xong"
 * (chỉ áp dụng khi bấm Xong). Picker luôn nền sáng (spec: DateTimePicker sáng).
 */
export function DateField({ label, value, onChange, placeholder = 'Chọn ngày', minimumDate, maximumDate }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date>(value ?? new Date());

  const show = () => {
    setPending(value ?? new Date());
    setOpen(true);
  };

  return (
    <View style={styles.container}>
      <Text variant="caption" weight="semibold">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
        onPress={show}
        style={({ pressed }) => [styles.box, pressed ? styles.pressed : null]}
      >
        <Text variant="body" color={value ? 'text' : 'textTertiary'} style={styles.value}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <CalendarDays size={18} color={colors.textTertiary} />
      </Pressable>

      {Platform.OS === 'android' ? (
        open ? (
          <DateTimePicker
            mode="date"
            display="default"
            value={pending}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(e, d) => {
              setOpen(false);
              if (e.type === 'set' && d) onChange(d);
            }}
          />
        ) : null
      ) : (
        <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
          <DateTimePicker
            mode="date"
            display="spinner"
            themeVariant="light"
            locale="vi-VN"
            value={pending}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, d) => d && setPending(d)}
          />
          <Button
            title="Xong"
            size="lg"
            onPress={() => {
              onChange(pending);
              setOpen(false);
            }}
          />
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs + 2, flex: 1 },
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
  pressed: { backgroundColor: colors.surfaceMuted },
  value: { flex: 1 },
});
