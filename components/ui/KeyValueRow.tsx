import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { hapticLight } from '@/lib/haptics';
import { colors, space } from '@/theme';

import { Text } from './Text';
import { useToast } from './Toast';

export type KeyValueRowProps = {
  label: string;
  value: React.ReactNode;
  /** Có giá trị → chạm cả dòng để sao chép. */
  copyValue?: string;
  last?: boolean;
};

export function KeyValueRow({ label, value, copyValue, last }: KeyValueRowProps) {
  const toast = useToast();

  const content = (
    <>
      <Text variant="body" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      <View style={styles.valueWrap}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text variant="body" weight="medium" align="right" style={styles.value}>
            {value}
          </Text>
        ) : (
          value
        )}
        {copyValue ? <Copy size={16} color={colors.primary} /> : null}
      </View>
    </>
  );

  const rowStyle = [styles.row, last ? null : styles.divider];

  if (!copyValue) return <View style={rowStyle}>{content}</View>;

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(copyValue);
      hapticLight();
      toast.show({ type: 'success', message: `Đã sao chép ${label.toLowerCase()}` });
    } catch {
      toast.show({ type: 'error', message: 'Không sao chép được' });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${copyValue}. Chạm để sao chép`}
      onPress={onCopy}
      style={({ pressed }) => [...rowStyle, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  label: { flexShrink: 0 },
  valueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm },
  value: { flexShrink: 1 },
});
