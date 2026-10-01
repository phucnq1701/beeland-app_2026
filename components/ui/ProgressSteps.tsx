import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

import { Text } from './Text';

export type ProgressStepsProps = {
  steps: readonly string[];
  /** Chỉ số bước hiện tại (0-based). */
  current: number;
  cancelled?: boolean;
};

export function ProgressSteps({ steps, current, cancelled }: ProgressStepsProps) {
  const label = cancelled
    ? 'Tiến độ: đã huỷ'
    : `Tiến độ: bước ${current + 1}/${steps.length}, ${steps[current] ?? ''}`;

  return (
    <View accessible accessibilityLabel={label} style={cancelled ? styles.cancelled : null}>
      <View style={styles.bars}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[styles.bar, { backgroundColor: !cancelled && i <= current ? colors.brand : colors.border }]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {steps.map((s, i) => {
          const active = !cancelled && i === current;
          return (
            <Text
              key={s}
              variant="label"
              weight={active ? 'semibold' : 'regular'}
              color={active ? 'text' : 'textSecondary'}
              align={i === 0 ? 'left' : i === steps.length - 1 ? 'right' : 'center'}
              style={styles.label}
              numberOfLines={1}
            >
              {s}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: space.xs },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  labels: { flexDirection: 'row', marginTop: space.xs + 2 },
  label: { flex: 1, letterSpacing: 0 },
  cancelled: { opacity: 0.6 },
});
