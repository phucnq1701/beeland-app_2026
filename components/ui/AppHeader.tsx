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
  variant?: 'light' | 'dark' | 'transparent';
};

/** Header chuẩn cao 56, một cách "Quay lại" duy nhất cho toàn app. */
export function AppHeader({ title, subtitle, onBack, hideBack, actions, variant = 'light' }: AppHeaderProps) {
  const router = useRouter();
  const dark = variant === 'dark';

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
      ]}
    >
      {hideBack ? null : (
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="Quay lại"
          onPress={goBack}
          variant={dark ? 'onDark' : 'plain'}
        />
      )}
      <View style={styles.titles}>
        <Text variant="heading" color={dark ? colors.showcase.text : 'text'} numberOfLines={1} accessibilityRole="header">
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
  titles: { flex: 1, paddingHorizontal: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
