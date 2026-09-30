import { AlertCircle, Check, Info } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, elevation, motion, radius, space } from '@/theme';

import { Text } from './Text';

export type ToastType = 'success' | 'error' | 'info';

export type ToastOptions = {
  type: ToastType;
  message: string;
  action?: { label: string; onPress: () => void };
  duration?: number;
};

type ToastApi = { show: (opts: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 3000;
const ACTION_DURATION = 5000;
/** Chiều cao header chuẩn – toast hiện ngay dưới header. */
const HEADER_HEIGHT = 56;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const hide = useCallback(() => {
    clearTimer();
    if (reduceMotion) {
      anim.setValue(0);
      setToast(null);
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: motion.exit, useNativeDriver: true }).start(() =>
      setToast(null)
    );
  }, [anim, reduceMotion]);

  const show = useCallback(
    (opts: ToastOptions) => {
      clearTimer();
      seq.current += 1;
      setToast({ ...opts, id: seq.current });
      AccessibilityInfo.announceForAccessibility(opts.message);
      if (reduceMotion) anim.setValue(1);
      else {
        anim.setValue(0);
        Animated.timing(anim, { toValue: 1, duration: motion.enter, useNativeDriver: true }).start();
      }
      const duration = opts.duration ?? (opts.action ? ACTION_DURATION : DEFAULT_DURATION);
      timer.current = setTimeout(hide, duration);
    },
    [anim, hide, reduceMotion]
  );

  useEffect(() => clearTimer, []);

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { top: insets.top + HEADER_HEIGHT }]}>
          <Animated.View
            key={toast.id}
            accessibilityLiveRegion="polite"
            style={{
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
            }}
          >
            <ToastView toast={toast} onDismiss={hide} />
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastOptions; onDismiss: () => void }) {
  const light = toast.type === 'info';
  const Icon = toast.type === 'success' ? Check : toast.type === 'error' ? AlertCircle : Info;
  const iconBg = toast.type === 'success' ? colors.success : toast.type === 'error' ? colors.danger : colors.infoSubtle;
  const iconFg = light ? colors.info : colors.onInverse;

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="alert"
      style={[styles.toast, light ? styles.light : styles.dark, elevation.overlay]}
    >
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Icon size={14} color={iconFg} strokeWidth={3} />
      </View>
      <Text variant="body" color={light ? 'text' : 'onInverse'} style={styles.message} numberOfLines={3}>
        {toast.message}
      </Text>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            toast.action?.onPress();
            onDismiss();
          }}
        >
          <Text variant="subhead" color={light ? 'primary' : colors.showcase.accent}>
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Hiện toast: `const toast = useToast(); toast.show({ type: 'success', message: '…' })`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải được gọi bên trong <ToastProvider> (app/_layout.tsx).');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 48,
  },
  dark: { backgroundColor: colors.inverse },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1 },
});
