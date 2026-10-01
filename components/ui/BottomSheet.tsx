import type { LucideIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, elevation, motion, radius, space } from '@/theme';

import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Gọi khi sheet đã đóng HẲN (trên iOS: sau khi Modal gốc đã dismiss xong).
   * Mở camera / thư viện ảnh / Alert ở đây, không mở ngay sau khi bấm lựa chọn:
   * iOS trình bày view controller mới lên Modal đang đóng sẽ bị huỷ âm thầm.
   */
  onClosed?: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
};

/** Bottom sheet dựng trên RN Modal + Animated (không thêm thư viện). */
export function BottomSheet({
  visible,
  onClose,
  onClosed,
  title,
  children,
  maxHeightRatio = 0.85,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  // Modal gốc hiển thị (true suốt lúc chạy animation đóng). Modal luôn được render và chỉ
  // đổi `visible` → iOS mới phát onDismiss (unmount thẳng thì không có onDismiss).
  const [shown, setShown] = useState(visible);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const notifyClosed = () => onClosedRef.current?.();

  const finishClose = () => {
    setShown(false);
    // iOS: chờ onDismiss của Modal. Nền tảng khác không có onDismiss → báo ở khung hình kế tiếp.
    if (Platform.OS !== 'ios') requestAnimationFrame(notifyClosed);
  };

  useEffect(() => {
    if (visible) {
      setShown(true);
      if (reduceMotion) progress.setValue(1);
      else Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
    } else if (shown) {
      if (reduceMotion) {
        progress.setValue(0);
        finishClose();
      } else {
        // Mở lại giữa chừng sẽ ngắt animation này (finished = false) → không được đóng Modal.
        Animated.timing(progress, { toValue: 0, duration: motion.exit, useNativeDriver: true }).start(({ finished }) => {
          if (finished) finishClose();
        });
      }
    }
    // finishClose chỉ dùng ref + setState ổn định
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shown, progress, reduceMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.4, 0] });

  return (
    <Modal
      transparent
      visible={shown}
      animationType="none"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? notifyClosed : undefined}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng" accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            elevation.overlay,
            {
              maxHeight: height * maxHeightRatio,
              paddingBottom: Math.max(insets.bottom, space.lg),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabber} />
          {title ? (
            <Text variant="heading" style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export type SheetOptionProps = {
  icon?: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function SheetOption({ icon: Icon, label, onPress, destructive }: SheetOptionProps) {
  const fg = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null]}
    >
      {Icon ? <Icon size={20} color={destructive ? colors.danger : colors.textSecondary} /> : null}
      <Text variant="body" color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.md,
  },
  title: { marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionPressed: { backgroundColor: colors.surfaceMuted },
});
