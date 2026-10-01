import { Timer } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { countdownTone, formatCountdown, remainingSeconds } from '@/lib/countdown';
import { colors, radius, space } from '@/theme';

import { Text } from './Text';

export type CountdownPillProps = {
  expiresAt: unknown;
  label?: string;
  /** Gọi đúng một lần khi đồng hồ về 0. */
  onExpire?: () => void;
  compact?: boolean;
};

/** Đồng hồ giữ chỗ: vàng, đỏ khi < 3 phút, "Đã hết hạn giữ chỗ" khi về 0. */
export function CountdownPill({ expiresAt, label = 'Giữ chỗ còn', onExpire, compact }: CountdownPillProps) {
  const [now, setNow] = useState(() => Date.now());
  const expiredFired = useRef(false);
  const seconds = remainingSeconds(expiresAt, now);
  const tone = countdownTone(seconds);

  useEffect(() => {
    if (tone === 'none' || tone === 'expired') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tone]);

  // Hạn mới (vd sau khi tải lại) → cho phép báo hết hạn lần nữa.
  useEffect(() => {
    expiredFired.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (tone === 'expired' && !expiredFired.current) {
      expiredFired.current = true;
      onExpire?.();
    }
  }, [tone, onExpire]);

  if (tone === 'none' || seconds === null) return null;

  const urgent = tone !== 'normal';
  const bg = urgent ? colors.dangerSubtle : colors.warningSubtle;
  const fg = urgent ? colors.onDangerSubtle : colors.onWarningSubtle;
  const minutes = Math.floor(seconds / 60);
  const a11y =
    tone === 'expired' ? 'Đã hết hạn giữ chỗ' : `${label} ${minutes} phút ${seconds % 60} giây`;

  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[styles.pill, compact ? styles.compact : styles.full, { backgroundColor: bg }]}
    >
      <View style={styles.left}>
        <Timer size={16} color={fg} />
        <Text variant="caption" weight="medium" color={fg}>
          {tone === 'expired' ? 'Đã hết hạn giữ chỗ' : label}
        </Text>
      </View>
      {tone === 'expired' ? null : (
        <Text variant="subhead" numeric color={fg}>
          {formatCountdown(seconds)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  full: { minHeight: 40, alignSelf: 'stretch' },
  compact: { minHeight: 32, alignSelf: 'flex-start' },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
});
