import type { LucideIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, elevation, motion, radius, space } from '@/theme';

import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
};

/** Bottom sheet dựng trên RN Modal + Animated (không thêm thư viện). */
export function BottomSheet({ visible, onClose, title, children, maxHeightRatio = 0.85 }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  // Giữ Modal mở trong lúc chạy animation đóng.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduceMotion) progress.setValue(1);
      else Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
    } else if (mounted) {
      if (reduceMotion) {
        progress.setValue(0);
        setMounted(false);
      } else {
        Animated.timing(progress, { toValue: 0, duration: motion.exit, useNativeDriver: true }).start(() =>
          setMounted(false)
        );
      }
    }
  }, [visible, mounted, progress, reduceMotion]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.4, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
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

/**
 * Đợi sheet đóng hẳn rồi mới mở Alert / ImagePicker. Trên iOS, trình bày một view
 * controller mới trong lúc Modal đang đóng có thể bị huỷ âm thầm.
 */
export function afterSheetClose(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, motion.exit + 150));
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
