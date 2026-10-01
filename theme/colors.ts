/**
 * Token màu của design system (spec 4.2). Đã kiểm tra tương phản WCAG AA
 * trong tests/theme-contrast.test.cjs.
 *
 * - Màn làm việc dùng các token gốc (bảng màu "Slate Pro").
 * - Màn giới thiệu dự án/căn hộ dùng nhóm `showcase` (navy + cam sáng).
 * - `primary` là màu nút chính DUY NHẤT của toàn app; `brand` chỉ để trang trí,
 *   không làm nền cho chữ (chữ trắng trên `brand` chỉ đạt 3.12:1).
 *
 * File này không được import gì để test nạp trực tiếp được.
 */
export const colors = {
  primary: '#C9501A',
  primaryPressed: '#A84314',
  onPrimary: '#FFFFFF',
  brand: '#E86F25',
  primarySubtle: '#FFF1E8',
  onPrimarySubtle: '#9A3412',

  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E4E7EC',
  borderStrong: '#CBD5E1',

  text: '#0F172A',
  textSecondary: '#475569',
  // Chỉ đặt trên nền trắng (4.76:1); trên `bg` chỉ đạt 4.44:1.
  textTertiary: '#64748B',

  inverse: '#1E293B',
  onInverse: '#FFFFFF',

  success: '#15803D',
  successSubtle: '#DCFCE7',
  onSuccessSubtle: '#166534',
  warning: '#B45309',
  warningSubtle: '#FEF3C7',
  onWarningSubtle: '#92400E',
  danger: '#B91C1C',
  dangerSubtle: '#FEE2E2',
  onDangerSubtle: '#991B1B',
  info: '#1D4ED8',
  infoSubtle: '#DBEAFE',
  onInfoSubtle: '#1E40AF',

  backdrop: 'rgba(15, 23, 42, 0.45)',
  /** Kính xanh xám (thanh tab nổi): lớp phủ xanh xám nhạt trên BlurView tint default, phần còn lại do blur. */
  frosted: 'rgba(90, 110, 148, 0.22)',
  /** Viền sáng mép kính. */
  frostedBorder: 'rgba(255, 255, 255, 0.45)',
  /** Viên tab đang chọn trên kính. */
  frostedActive: 'rgba(255, 255, 255, 0.6)',
  skeleton: '#EEF1F5',

  showcase: {
    bg: '#16233B',
    surface: '#243556',
    accent: '#F59E6B',
    paper: '#F7F5F2',
    text: '#FFFFFF',
    textMuted: '#CBD5E1',
    /** Gradient phủ ảnh (trong suốt → navy) để chữ trắng đọc được trên ảnh. */
    scrim: ['rgba(22, 35, 59, 0)', 'rgba(22, 35, 59, 0.55)', 'rgba(22, 35, 59, 0.92)'] as const,
    /** Nút kính mờ đặt trên ảnh (navy trong – đọc được cả trên ảnh sáng). */
    glass: 'rgba(22, 35, 59, 0.35)',
    glassBorder: 'rgba(255, 255, 255, 0.3)',
  },
} as const;

export type ColorToken = Exclude<keyof typeof colors, 'showcase'>;

export default colors;
