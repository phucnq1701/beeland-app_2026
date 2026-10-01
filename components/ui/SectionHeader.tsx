import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { Text } from './Text';

export type SectionHeaderProps = { title: string; actionLabel?: string; onAction?: () => void };

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="label" color="textTertiary" style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onAction}>
          <Text variant="caption" weight="semibold" color="primary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginTop: space.xs,
    paddingHorizontal: 2,
  },
  title: { textTransform: 'uppercase' },
});
