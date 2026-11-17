import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { ACCOUNT_SCOPE_KEY } from "@/components/utils/accountScope";
import {
  accountFromScope,
  accountKey,
  addDeclined,
  biometricLabel,
  classifyBiometricError,
  legacyRememberedAccount,
  parseAccount,
  parseCredential,
  parseDeclined,
  pickBiometricKind,
  type BiometricCredential,
  type BiometricErrorKind,
  type BiometricKind,
  type LoginAccount,
} from "@/lib/biometricLogin";

/**
 * Đăng nhập bằng Face ID / vân tay: mật khẩu chỉ nằm trong Keychain / Keystore, đọc ra phải quét sinh trắc học
 * (iOS `biometryCurrentSet`, Android `BIOMETRIC_STRONG` – không mở bằng mật mã máy). Thêm / xoá vân tay, khuôn mặt
 * trên máy → hệ điều hành huỷ khoá, đọc ra `null`. Luồng: `docs/auth.md`.
 */

const CREDENTIAL_KEY = "beeland.biometricLogin";
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: "Xác thực để đăng nhập BeeLand",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};
/** Tài khoản đã bật Face ID (không có mật khẩu) – biết có hiện nút hay không mà không phải quét. */
const BIOMETRIC_ACCOUNT_KEY = "@biometric_account";
const DECLINED_KEY = "@biometric_declined";
/** Tài khoản đăng nhập gần nhất (không có mật khẩu) – điền sẵn màn Đăng nhập. */
const LAST_LOGIN_KEY = "@last_login";
/** "Nhớ mật khẩu" của bản ≤ 10.6 – lưu cả mật khẩu dạng chữ, đã bỏ. */
const LEGACY_REMEMBER_KEY = "@remember_login";

const isIOS = Platform.OS === "ios";

export class BiometricError extends Error {
  constructor(readonly kind: BiometricErrorKind, message: string) {
    super(message);
  }
}

function toBiometricError(error: unknown): BiometricError {
  if (error instanceof BiometricError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new BiometricError(classifyBiometricError(message), message);
}

export type BiometricSupport = { kind: BiometricKind; label: string };

/** null = không dùng được (web, máy không có / chưa cài sinh trắc học, Android chỉ có loại yếu). */
export async function getBiometricSupport(): Promise<BiometricSupport | null> {
  if (Platform.OS === "web") return null;
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hardware || !enrolled || !SecureStore.canUseBiometricAuthentication()) return null;
    const kind = pickBiometricKind(await LocalAuthentication.supportedAuthenticationTypesAsync(), isIOS);
    return kind ? { kind, label: biometricLabel(kind, isIOS) } : null;
  } catch {
    return null;
  }
}

export async function getBiometricAccount(): Promise<LoginAccount | null> {
  try {
    return parseAccount(await AsyncStorage.getItem(BIOMETRIC_ACCOUNT_KEY));
  } catch {
    return null;
  }
}

/**
 * Lưu mật khẩu vào Keychain / Keystore. Android: ghi đã bật hộp quét. iOS ghi không hỏi → quét trước để người dùng
 * xác nhận. Lỗi (huỷ, quét sai…) → ném `BiometricError`, không lưu gì.
 */
export async function enableBiometricLogin(credential: BiometricCredential, support: BiometricSupport): Promise<void> {
  if (isIOS) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Bật đăng nhập bằng ${support.label}`,
      cancelLabel: "Huỷ",
      disableDeviceFallback: true,
    });
    if (!result.success) throw new BiometricError(classifyBiometricError(result.error), result.error);
  }
  try {
    await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(credential), SECURE_OPTIONS);
  } catch (error) {
    throw toBiometricError(error);
  }
  const account: LoginAccount = {
    loginType: credential.loginType,
    companyCode: credential.companyCode,
    username: credential.username,
  };
  await AsyncStorage.setItem(BIOMETRIC_ACCOUNT_KEY, JSON.stringify(account));
  const declined = parseDeclined(await AsyncStorage.getItem(DECLINED_KEY)).filter((k) => k !== accountKey(account));
  await AsyncStorage.setItem(DECLINED_KEY, JSON.stringify(declined));
}

/**
 * Bật hộp quét rồi đọc thông tin đăng nhập. `null` = khoá đã bị huỷ (đổi vân tay / khuôn mặt) hoặc dữ liệu hỏng.
 * Huỷ / quét sai → ném `BiometricError`.
 */
export async function readBiometricCredential(): Promise<BiometricCredential | null> {
  try {
    return parseCredential(await SecureStore.getItemAsync(CREDENTIAL_KEY, SECURE_OPTIONS));
  } catch (error) {
    throw toBiometricError(error);
  }
}

export async function disableBiometricLogin(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIAL_KEY, SECURE_OPTIONS).catch(() => undefined);
  await AsyncStorage.removeItem(BIOMETRIC_ACCOUNT_KEY).catch(() => undefined);
}

export async function wasBiometricDeclined(account: LoginAccount): Promise<boolean> {
  try {
    return parseDeclined(await AsyncStorage.getItem(DECLINED_KEY)).includes(accountKey(account));
  } catch {
    return false;
  }
}

export async function markBiometricDeclined(account: LoginAccount): Promise<void> {
  try {
    const list = parseDeclined(await AsyncStorage.getItem(DECLINED_KEY));
    await AsyncStorage.setItem(DECLINED_KEY, JSON.stringify(addDeclined(list, accountKey(account))));
  } catch {
    // Không lưu được → lần sau hỏi lại, không chặn đăng nhập.
  }
}

export async function saveLastLogin(account: LoginAccount): Promise<void> {
  await AsyncStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(account)).catch(() => undefined);
}

/**
 * Tài khoản gần nhất. Máy lên từ bản cũ: đọc cả `@remember_login` (màn Đăng nhập có thể đọc trước khi
 * `purgeLegacyRememberedLogin` ở `_layout` chép xong), rồi dựng lại từ khoá phiên (`accountFromScope`).
 */
export async function loadLastLogin(): Promise<LoginAccount | null> {
  try {
    const [[, last], [, legacy], [, scope], [, company], [, type]] = await AsyncStorage.multiGet([
      LAST_LOGIN_KEY,
      LEGACY_REMEMBER_KEY,
      ACCOUNT_SCOPE_KEY,
      "tenCTDKVT",
      "@type_account",
    ]);
    return parseAccount(last) ?? legacyRememberedAccount(legacy) ?? accountFromScope(scope, company, type);
  } catch {
    return null;
  }
}

/** Bản cũ lưu mật khẩu dạng chữ trong `@remember_login` → giữ lại tài khoản để điền sẵn rồi xoá. Gọi khi mở app. */
export async function purgeLegacyRememberedLogin(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_REMEMBER_KEY);
    if (raw === null) return;
    const account = legacyRememberedAccount(raw);
    if (account && !(await AsyncStorage.getItem(LAST_LOGIN_KEY))) await saveLastLogin(account);
    await AsyncStorage.removeItem(LEGACY_REMEMBER_KEY);
  } catch {
    // Lần mở app sau thử lại.
  }
}
