import { ChevronRight } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

import { Text } from './Text';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

function ListItemBase({ title, subtitle, meta, leading, trailing, chevron, onPress, accessibilityLabel }: ListItemProps) {
  const body = (
    <>
      {leading}
      <View style={styles.texts}>
        <Text variant="subhead" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {chevron ? <ChevronRight size={18} color={colors.textTertiary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {body}
    </Pressable>
  );
}

/** Dòng danh sách chuẩn, đã memo để dùng trong FlatList. */
export const ListItem = memo(ListItemBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  texts: { flex: 1, gap: 2 },
  trailing: { alignItems: 'flex-end', gap: space.xs },
});
