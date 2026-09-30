import React from 'react';

import { formatVND, formatVNDShort } from '@/lib/format';
import { ColorToken, TextVariant } from '@/theme';

import { Text, TextProps } from './Text';

export type MoneyTextProps = Omit<TextProps, 'children' | 'variant' | 'color'> & {
  value: unknown;
  /** "3,48 tỷ" thay vì "3.482.600.000 ₫". */
  short?: boolean;
  variant?: TextVariant;
  color?: ColorToken | string;
};

export function MoneyText({ value, short, variant = 'body', color, weight, ...rest }: MoneyTextProps) {
  return (
    <Text
      {...rest}
      numeric
      variant={variant}
      color={color}
      weight={weight ?? (variant === 'body' || variant === 'caption' ? 'semibold' : undefined)}
    >
      {short ? formatVNDShort(value) : formatVND(value)}
    </Text>
  );
}
