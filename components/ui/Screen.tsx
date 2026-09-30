import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

export type ScreenProps = {
  children: React.ReactNode;
  /** Đặt trên cùng, ngoài vùng cuộn (thường là AppHeader). */
  header?: React.ReactNode;
  /** Đặt dưới cùng, ngoài vùng cuộn (thường là BottomActionBar). */
  footer?: React.ReactNode;
  /** false khi màn tự dùng FlatList. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  tone?: 'work' | 'showcase';
  padded?: boolean;
  keyboardAware?: boolean;
};

/**
 * Khung màn hình chuẩn: safe-area trên/trái/phải + nền token.
 * Safe-area dưới do BottomActionBar hoặc tab bar lo.
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  tone = 'work',
  padded = true,
  keyboardAware,
}: ScreenProps) {
  const bg = tone === 'showcase' ? colors.showcase.paper : colors.bg;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, padded && styles.padded]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded]}>{children}</View>
  );

  const inner = (
    <>
      {header}
      {body}
      {footer}
    </>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: bg }]}>
      {keyboardAware ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.md, paddingBottom: space.xxl },
  padded: { padding: space.lg },
});
