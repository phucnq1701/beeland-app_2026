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
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

export const typography: Record<TextVariant, TypeStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 36 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  subhead: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  // Cỡ nhỏ nhất được phép dùng trong app.
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
};

/** Giới hạn phóng chữ theo cài đặt hệ thống để không vỡ bố cục. */
export const MAX_FONT_SCALE = 1.3;
