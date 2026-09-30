import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, space } from '@/theme';

/** Thanh hành động cố định đáy màn, tự chừa vùng home indicator. */
export function BottomActionBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, elevation.raised, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
