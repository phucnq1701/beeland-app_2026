import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, space } from '@/theme';

import { useToastBottomOffset } from './Toast';

/**
 * Thanh hành động cố định đáy màn, tự chừa vùng home indicator.
 * Báo chiều cao cho ToastProvider khi màn đang được xem, để toast hiện ngay phía trên.
 */
export function BottomActionBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const offset = useToastBottomOffset();
  const owner = useRef<number | null>(null);
  if (owner.current === null) owner.current = offset.newOwner();
  const height = useRef<number | null>(null);
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const id = owner.current as number;
      focused.current = true;
      if (height.current !== null) offset.set(id, height.current);
      return () => {
        focused.current = false;
        offset.clear(id);
      };
    }, [offset])
  );

  const onLayout = (e: LayoutChangeEvent) => {
    height.current = e.nativeEvent.layout.height;
    if (focused.current) offset.set(owner.current as number, height.current);
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.bar, elevation.raised, { paddingBottom: Math.max(insets.bottom, space.md) }]}
    >
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
