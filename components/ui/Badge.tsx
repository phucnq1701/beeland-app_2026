import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { normalizeHexColor, statusTextColorOf } from '@/components/utils/statusColor';
import { colors, radius, space } from '@/theme';

import { Text } from './Text';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  brand: { bg: colors.primarySubtle, fg: colors.onPrimarySubtle },
  success: { bg: colors.successSubtle, fg: colors.onSuccessSubtle },
  warning: { bg: colors.warningSubtle, fg: colors.onWarningSubtle },
  danger: { bg: colors.dangerSubtle, fg: colors.onDangerSubtle },
  info: { bg: colors.infoSubtle, fg: colors.onInfoSubtle },
};

export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: BadgeTone; icon?: LucideIcon }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {Icon ? <Icon size={12} color={t.fg} strokeWidth={2.5} /> : null}
      <Text variant="label" color={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Trạng thái nghiệp vụ: nền lấy đúng color_code của dữ liệu, chữ tự tính cho đủ tương phản
 * (giữ logic statusTextColorOf hiện có). Không có màu hợp lệ → badge trung tính.
 */
export function StatusBadge({ label, color }: { label: string; color?: string | null }) {
  const bg = normalizeHexColor(color);
  return (
    <View style={[styles.pill, { backgroundColor: bg ?? colors.surfaceMuted }]}>
      <Text variant="label" color={bg ? statusTextColorOf(bg) : colors.textSecondary} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm + 1,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
});
