import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { antdPresetTagColor, normalizeHexColor, statusTextColorOf } from '@/components/utils/statusColor';
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
 * (giữ logic statusTextColorOf hiện có). color_code là tên preset antd (blue, green… – web cài
 * trong Danh mục) → nền nhạt + chữ đậm cùng tông, không viền (kiểu soft). Không có màu hợp lệ → badge trung tính.
 * size="sm": chữ 11, pill thấp hơn – dùng ở góc card (vd danh sách khách hàng).
 */
export function StatusBadge({ label, color, size = 'md' }: { label: string; color?: string | null; size?: 'md' | 'sm' }) {
  const preset = antdPresetTagColor(color);
  const bg = preset ? preset.bg : normalizeHexColor(color);
  const fg = preset ? preset.fg : bg ? statusTextColorOf(bg) : colors.textSecondary;
  const sm = size === 'sm';
  return (
    <View
      style={[
        styles.pill,
        sm && styles.pillSm,
        { backgroundColor: bg ?? colors.surfaceMuted },
      ]}
    >
      <Text variant="label" color={fg} numberOfLines={1} style={sm ? styles.textSm : undefined}>
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
  pillSm: { paddingHorizontal: space.sm, paddingVertical: 2 },
  textSm: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
});
