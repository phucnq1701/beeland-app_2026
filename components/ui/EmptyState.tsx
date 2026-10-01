import { AlertTriangle, Inbox, LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

type StateViewProps = {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

function StateView({ icon: Icon, iconColor, iconBg, title, description, action }: StateViewProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Icon size={26} color={iconColor} />
      </View>
      <Text variant="subhead" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="caption" color="textSecondary" align="center" style={styles.desc}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = Inbox, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <StateView
      icon={icon}
      iconColor={colors.textTertiary}
      iconBg={colors.surfaceMuted}
      title={title}
      description={description}
      action={actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    />
  );
}

export type ErrorStateProps = { title?: string; description?: string; onRetry: () => void };

export function ErrorState({
  title = 'Không tải được dữ liệu',
  description = 'Kiểm tra kết nối mạng rồi thử lại.',
  onRetry,
}: ErrorStateProps) {
  return (
    <StateView
      icon={AlertTriangle}
      iconColor={colors.danger}
      iconBg={colors.dangerSubtle}
      title={title}
      description={description}
      action={<Button variant="secondary" title="Thử lại" onPress={onRetry} />}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: space.xs },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  desc: { maxWidth: 300 },
  action: { marginTop: space.md },
});
