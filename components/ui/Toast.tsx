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
type OffsetApi = { set: (owner: number, height: number) => void; clear: (owner: number) => void };
/** BottomActionBar của màn đang hiển thị báo chiều cao để toast nằm ngay trên nó. */
const ToastOffsetContext = createContext<OffsetApi>({ set: () => {}, clear: () => {} });
let nextOwner = 1;

const DEFAULT_DURATION = 3000;
const ACTION_DURATION = 5000;
/** Khoảng cách giữa toast và mép dưới (hoặc thanh hành động). */
const GAP = 12;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  // Chủ sở hữu = thanh của màn được focus gần nhất. Màn cũ dọn dẹp muộn (vd sau router.replace)
  // không được xoá chiều cao mà màn mới đã báo.
  const [bar, setBar] = useState<{ owner: number; height: number } | null>(null);
  const offsetApi = useMemo<OffsetApi>(
    () => ({
      set: (owner, height) => setBar({ owner, height }),
      clear: (owner) => setBar((cur) => (cur && cur.owner === owner ? null : cur)),
    }),
    []
  );
  const barHeight = bar?.height ?? null;
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
    // Chỉ xoá khi animation chạy hết: nếu toast mới chen vào giữa chừng (animation bị ngắt)
    // thì không được xoá toast mới.
    Animated.timing(anim, { toValue: 0, duration: motion.exit, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
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
      <ToastOffsetContext.Provider value={offsetApi}>
        {children}
        {toast ? (
          // Toast nằm dưới (trên thanh hành động nếu có) để không bao giờ che tiêu đề header.
          <View
            pointerEvents="box-none"
            style={[styles.host, { bottom: (barHeight ?? insets.bottom) + GAP }]}
          >
            <Animated.View
              key={toast.id}
              accessibilityLiveRegion="polite"
              style={{
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              }}
            >
              <ToastView toast={toast} onDismiss={hide} />
            </Animated.View>
          </View>
        ) : null}
      </ToastOffsetContext.Provider>
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

/** Dùng trong BottomActionBar: báo chiều cao thanh; mỗi thanh có một mã chủ sở hữu riêng. */
export function useToastBottomOffset(): OffsetApi & { newOwner: () => number } {
  const api = useContext(ToastOffsetContext);
  return useMemo(() => ({ ...api, newOwner: () => nextOwner++ }), [api]);
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
