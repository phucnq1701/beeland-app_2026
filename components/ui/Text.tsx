import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import {
  colors,
  ColorToken,
  fonts,
  FontWeightName,
  MAX_FONT_SCALE,
  TextVariant,
  typography,
} from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  /** Token màu, hoặc chuỗi màu động (màu showcase, color_code từ dữ liệu). */
  color?: ColorToken | string;
  /** Ghi đè độ đậm của variant. */
  weight?: FontWeightName;
  /** Số có độ rộng bằng nhau (tiền, đếm ngược). */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
};

function resolveColor(color: ColorToken | string | undefined): string {
  if (!color) return colors.text;
  return color in colors ? (colors[color as ColorToken] as string) : color;
}

/** Nơi duy nhất trong app đặt fontFamily. */
export function Text({
  variant = 'body',
  color,
  weight,
  numeric,
  align,
  style,
  ...rest
}: TextProps) {
  const base = typography[variant];
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        base,
        { color: resolveColor(color) },
        weight ? { fontFamily: fonts[weight] } : null,
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
