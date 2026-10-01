import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  hideBack?: boolean;
  actions?: React.ReactNode;
  /** `soft`: hoà vào nền màn (`bg`), không viền, nút quay lại tròn – kiểu trang chủ. */
  variant?: 'light' | 'dark' | 'transparent' | 'soft';
};

/** Header chuẩn cao 56, một cách "Quay lại" duy nhất cho toàn app. */
export function AppHeader({ title, subtitle, onBack, hideBack, actions, variant = 'light' }: AppHeaderProps) {
  const router = useRouter();
  const dark = variant === 'dark';
  const soft = variant === 'soft';

  const goBack =
    onBack ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    });

  return (
    <View
      style={[
        styles.bar,
        variant === 'light' && styles.light,
        dark && styles.dark,
        hideBack && styles.noBack,
        soft && styles.soft,
      ]}
    >
      {hideBack ? null : (
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="Quay lại"
          onPress={goBack}
          variant={dark ? 'onDark' : soft ? 'soft' : 'plain'}
        />
      )}
      <View style={styles.titles}>
        <Text
          variant="heading"
          color={dark ? colors.showcase.text : 'text'}
          numberOfLines={1}
          accessibilityRole="header"
          style={soft ? styles.softTitle : null}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={dark ? colors.showcase.textMuted : 'textSecondary'} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.xs,
  },
  noBack: { paddingLeft: space.lg },
  light: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dark: { backgroundColor: colors.showcase.bg },
  soft: { backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xs, gap: space.md },
  softTitle: { fontSize: 20, lineHeight: 28 },
  titles: { flex: 1, paddingHorizontal: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
