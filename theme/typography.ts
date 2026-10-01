/**
 * Kiểu chữ (spec 4.3). React Native không tự chọn file font theo `fontWeight`
 * với font tuỳ chỉnh, nên mỗi weight là một fontFamily riêng. Tên phải khớp
 * khoá truyền vào `useFonts` trong app/_layout.tsx.
 */
export const fonts = {
  regular: 'BeVietnamPro-Regular',
  medium: 'BeVietnamPro-Medium',
  semibold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-Bold',
} as const;

export type FontWeightName = keyof typeof fonts;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subhead'
  | 'body'
  | 'caption'
  | 'label';

export type TypeStyle = {
  weight: FontWeightName;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

export const typography: Record<TextVariant, TypeStyle> = {
  display: { weight: 'bold', fontSize: 28, lineHeight: 36 },
  title: { weight: 'bold', fontSize: 22, lineHeight: 28 },
  heading: { weight: 'semibold', fontSize: 17, lineHeight: 24 },
  subhead: { weight: 'semibold', fontSize: 15, lineHeight: 22 },
  body: { weight: 'regular', fontSize: 15, lineHeight: 22 },
  // 14/20 theo phản hồi thử nghiệm (13 hơi nhỏ khi đọc ngoài trời).
  caption: { weight: 'regular', fontSize: 14, lineHeight: 20 },
  // Cỡ nhỏ nhất được phép dùng trong app.
  label: { weight: 'semibold', fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
};

const FONT_WEIGHT_VALUE: Record<FontWeightName, '400' | '500' | '600' | '700'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/**
 * Font đã nạp → dùng file font của weight đó. Chưa nạp được (lỗi asset, hết 3 giây chờ)
 * → dùng font hệ thống với fontWeight để tiêu đề/nút vẫn giữ độ đậm.
 */
export function fontStyleFor(
  weight: FontWeightName,
  fontsLoaded: boolean
): { fontFamily: string } | { fontWeight: '400' | '500' | '600' | '700' } {
  return fontsLoaded ? { fontFamily: fonts[weight] } : { fontWeight: FONT_WEIGHT_VALUE[weight] };
}

/** Giới hạn phóng chữ theo cài đặt hệ thống để không vỡ bố cục. */
export const MAX_FONT_SCALE = 1.3;
