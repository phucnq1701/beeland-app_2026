import { Platform, ViewStyle } from 'react-native';

import { colors } from './colors';

/** Lưới 4pt (spec 4.4). Lề màn 16, padding card 16, khoảng cách card 12. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3: 32,
  x4: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3: 28,
  full: 999,
} as const;

type ElevationLevel = 'soft' | 'raised' | 'overlay' | 'modal';

function shadow(y: number, blur: number, opacity: number, androidElevation: number): ViewStyle {
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: y },
        shadowOpacity: opacity,
        shadowRadius: blur / 2,
      },
      android: { elevation: androidElevation },
      web: {
        boxShadow: `0px ${y}px ${blur}px rgba(15, 23, 42, ${opacity})`,
      } as ViewStyle,
    }) ?? {}
  );
}

/** Card phẳng + viền, không bóng. Chỉ 3 mức bóng cho lớp nổi. */
export const elevation: Record<ElevationLevel, ViewStyle> = {
  /** Bóng rất nhẹ cho card bo tròn lớn (trang chủ). */
  soft: shadow(6, 24, 0.06, 2),
  raised: shadow(-4, 16, 0.06, 4),
  overlay: shadow(8, 24, 0.16, 8),
  modal: shadow(16, 40, 0.24, 16),
};

/** Thời lượng (ms). */
export const motion = {
  press: 100,
  enter: 200,
  exit: 150,
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Kích thước vùng chạm tối thiểu. */
export const MIN_TOUCH = 44;
