import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getInitials } from '@/lib/format';
import { colors, radius } from '@/theme';

import { Text } from './Text';

export type AvatarProps = { name: string; uri?: string | null; size?: 32 | 40 | 56 };

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const box = { width: size, height: size, borderRadius: size >= 56 ? radius.lg : radius.md };
  if (uri) {
    return <Image source={{ uri }} style={[styles.base, box]} contentFit="cover" accessibilityLabel={name} />;
  }
  return (
    <View style={[styles.base, styles.initials, box]} accessibilityElementsHidden importantForAccessibility="no">
      <Text variant={size >= 56 ? 'heading' : 'label'} color="onPrimarySubtle" weight="bold">
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  initials: { backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
});
