import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Định danh tài khoản đang đăng nhập (loginType:mã công ty:username).
 * Dùng để lưu cấu hình hiển thị riêng cho từng tài khoản trên cùng thiết bị.
 * Khóa này KHÔNG bị xóa khi đăng nhập lại, nên cấu hình của từng tài khoản được giữ nguyên.
 */
export const ACCOUNT_SCOPE_KEY = '@account_scope';

export function buildAccountScope(
  loginType: string,
  companyCode: string,
  username: string
): string {
  return [loginType, companyCode, username]
    .map((part) => String(part || '').trim().toLowerCase())
    .join(':');
}

export async function setAccountScope(scope: string): Promise<void> {
  await AsyncStorage.setItem(ACCOUNT_SCOPE_KEY, scope);
}

/** Trả về khóa lưu trữ gắn với tài khoản hiện tại, ví dụ `@home_features_config:system:abc:user@x.com`. */
export async function getScopedKey(baseKey: string): Promise<string> {
  try {
    const scope = await AsyncStorage.getItem(ACCOUNT_SCOPE_KEY);
    return scope ? `${baseKey}:${scope}` : baseKey;
  } catch {
    return baseKey;
  }
}
