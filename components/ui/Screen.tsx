import React from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

export type ScreenProps = {
  children: React.ReactNode;
  /** Đặt trên cùng, ngoài vùng cuộn (thường là AppHeader). */
  header?: React.ReactNode;
  /** Đặt dưới cùng, ngoài vùng cuộn (thường là BottomActionBar). */
  footer?: React.ReactNode;
  /** Form: ẩn thanh thao tác dưới khi bàn phím mở (kết quả tìm / ô nhập không bị che, không bấm nhầm nút). Không dùng cho chat. */
  hideFooterWithKeyboard?: boolean;
  /** false khi màn tự dùng FlatList. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  tone?: 'work' | 'showcase';
  padded?: boolean;
  keyboardAware?: boolean;
  /** Chừa thêm khoảng trống cuối nội dung (vd 100 khi có tab bar nổi). */
  bottomInset?: number;
};

/**
 * Khung màn hình chuẩn: safe-area trên/trái/phải + nền token.
 * Safe-area dưới do BottomActionBar hoặc tab bar lo.
 */
export function Screen({
  children,
  header,
  footer,
  hideFooterWithKeyboard,
  scroll = true,
  refreshing = false,
  onRefresh,
  tone = 'work',
  padded = true,
  keyboardAware,
  bottomInset = 0,
}: ScreenProps) {
  const kb = useKeyboardShown(!!hideFooterWithKeyboard);
  const bg = tone === 'showcase' ? colors.showcase.paper : colors.bg;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, padded && styles.padded, bottomInset ? { paddingBottom: bottomInset } : null]}
      keyboardShouldPersistTaps="handled"
      // Vuốt nội dung ⇒ ẩn bàn phím (bàn phím số iOS không có phím "Xong")
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
      {hideFooterWithKeyboard && kb ? null : footer}
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

/** Bàn phím đang mở (chỉ nghe khi `enabled`). */
function useKeyboardShown(enabled: boolean): boolean {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setShown(true));
    const b = Keyboard.addListener(hideEvt, () => setShown(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, [enabled]);
  return shown;
}
