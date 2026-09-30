import { Alert, Platform } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Nút xác nhận hiển thị kiểu phá huỷ (đỏ trên iOS). */
  destructive?: boolean;
};

/**
 * Hỏi xác nhận trước thao tác phá huỷ (xoá, huỷ) – spec 4.5.
 * Trả về true khi người dùng đồng ý. Trên web, Alert nhiều nút không hoạt động
 * nên dùng window.confirm.
 */
export function confirm({
  title,
  message,
  confirmText = 'Đồng ý',
  cancelText = 'Không',
  destructive,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(text));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
