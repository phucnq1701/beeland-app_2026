import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Rung phản hồi – chỉ dùng cho: tạo booking thành công, nhận thanh toán, lỗi (spec 4.4).
 * Web không hỗ trợ → bỏ qua. Mọi lỗi đều bị nuốt: rung không được làm hỏng luồng chính.
 */
function run(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}

export function hapticSuccess(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticError(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export function hapticLight(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
