import { Platform, Share } from 'react-native';

/**
 * Chia sẻ nội dung chữ (thư mục, liên kết). Web: navigator.share nếu có. Người dùng huỷ → không coi là lỗi.
 * 'copied' = web không chia sẻ được nên đã chép link; 'failed' = lỗi thật (màn báo toast).
 */
export async function shareText(
  title: string,
  message: string,
  url?: string
): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        await nav.share({ title, text: message, url });
        return 'shared';
      }
      if (nav?.clipboard && url) {
        await nav.clipboard.writeText(url);
        return 'copied';
      }
      return 'failed';
    }
    await Share.share({ title, message: url ? `${message}\n${url}` : message, url });
    return 'shared';
  } catch (e: any) {
    return e?.message === 'User did not share' || e?.name === 'AbortError' ? 'shared' : 'failed';
  }
}
