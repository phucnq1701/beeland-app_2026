import { Platform, Share } from 'react-native';

/**
 * Chia sẻ nội dung chữ (thư mục, liên kết). Web: navigator.share nếu có. Người dùng huỷ → không coi là lỗi.
 * Trả false khi chia sẻ lỗi thật (để màn báo toast).
 */
export async function shareText(title: string, message: string, url?: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) await nav.share({ title, text: message, url });
      else if (nav?.clipboard && url) await nav.clipboard.writeText(url);
      else return false;
      return true;
    }
    await Share.share({ title, message: url ? `${message}\n${url}` : message, url });
    return true;
  } catch (e: any) {
    return e?.message === 'User did not share' || e?.name === 'AbortError';
  }
}
