import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Eye, EyeOff, Fingerprint, ScanFace } from "lucide-react-native";

import { buildAccountScope, setAccountScope } from "@/components/utils/accountScope";
import { Button, confirm, Screen, SegmentedControl, Text, TextField, useToast } from "@/components/ui";
import {
  BiometricError,
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricAccount,
  getBiometricSupport,
  loadLastLogin,
  markBiometricDeclined,
  readBiometricCredential,
  saveLastLogin,
  wasBiometricDeclined,
  type BiometricSupport,
} from "@/lib/biometric";
import { maskUsername, sameAccount, type LoginAccount } from "@/lib/biometricLogin";
import { hapticError } from "@/lib/haptics";
import { colors, elevation, radius, space } from "@/theme";
import {
  cacheCloudProfile,
  PROFILE_KEY,
} from "@/sevicesSupabase/CloudProfileService";
import { chatAuthChanged } from "@/components/chat/chatPush";
import { resetChatSession } from "@/components/chat/useChat";
import { AuthSupabaseService } from "@/sevicesSupabase/AuthService";
import {
  persistTenantFromJwt,
  decodeJwtPayload,
  isJwtExpired,
  findJwtInObject,
  looksLikeJwt,
  getSessionStatus,
} from "@/sevicesSupabase/cloudTenant";

type SignInResult = { status: "ok" } | { status: "rejected"; message: string } | { status: "network" } | { status: "blocked" };

const NETWORK_ERROR = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Đăng nhập (nội bộ / đại lý) bằng mật khẩu hoặc Face ID / vân tay (`lib/biometric.ts`, docs/auth.md).
 * Không lưu mật khẩu: chỉ điền sẵn tài khoản gần nhất; mật khẩu cho Face ID nằm trong Keychain / Keystore.
 * Lỗi nhập → dưới form; lỗi đăng nhập/mạng → toast; lỗi cấu hình tài khoản nghiêm trọng → Alert.
 */
export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();

  const [loginType, setLoginType] = useState<"INTERNAL" | "AGENCY">("INTERNAL");
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<BiometricSupport | null>(null);
  const [biometricAccount, setBiometricAccount] = useState<LoginAccount | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [last, support, account] = await Promise.all([loadLastLogin(), getBiometricSupport(), getBiometricAccount()]);
      if (!active) return;
      if (last) {
        setLoginType(last.loginType);
        setCompanyCode(last.companyCode);
        setUsername(last.username);
      }
      setBiometric(support);
      setBiometricAccount(support ? account : null);
    })();
    return () => {
      active = false;
    };
  }, []);

  /** Gọi cloud-auth và lưu phiên; chưa chuyển màn. "blocked" = đã báo Alert (tài khoản thiếu cấu hình). */
  const signIn = async (account: LoginAccount, pwd: string): Promise<SignInResult> => {
    try {
      const payload = {
        action: "login",
        maCTDK: account.companyCode,
        email: account.username,
        password: pwd,
        typeAccount: account.loginType === "AGENCY" ? "AGENCY" : "SYSTEM",
      };

      const res = await AuthSupabaseService.login(payload);
      console.log("[Login] cloud-auth response keys:", Object.keys(res || {}));
      if (res?.status === 200) {
        const dataObj =
          (res as any)?.data && typeof (res as any).data === "object"
            ? (res as any).data
            : {};
        const token =
          (res as any)?.acessToken ??
          (res as any)?.accessToken ??
          (res as any)?.token ??
          dataObj?.acessToken ??
          dataObj?.accessToken ??
          dataObj?.token ??
          "";
        let supabaseJwt =
          (res as any)?.jwt ??
          (res as any)?.cloud_jwt ??
          (res as any)?.supabase_jwt ??
          (res as any)?.cloudJwt ??
          dataObj?.jwt ??
          dataObj?.cloud_jwt ??
          dataObj?.supabase_jwt ??
          dataObj?.cloudJwt ??
          dataObj?.access_token ??
          "";
        try {
          if (!supabaseJwt || !looksLikeJwt(supabaseJwt)) {
            const scanned = findJwtInObject(res);
            if (scanned) {
              console.log("[Login] tìm thấy JWT bằng quét đệ quy response");
              supabaseJwt = scanned;
            }
          }
          const p = decodeJwtPayload(supabaseJwt || "");
          console.log(
            `[Login] jwt exp=${p?.exp} now=${Math.floor(
              Date.now() / 1000
            )} expired=${isJwtExpired(supabaseJwt || "")} company_id=${
              p?.company_id || p?.ma_ctdk
            } company_code=${p?.company_code} role=${p?.role}`
          );
        } catch {}

        if (token || supabaseJwt) {
          await AsyncStorage.multiRemove([
            PROFILE_KEY,
            "@token",
            "@supabase_jwt",
            "@company_id",
            "@tenant_id",
            "@cloud_company_id",
            "@employee_id",
            "@user_company_id",
            "@branch_id",
            "@ma_nv",
            "@type_account",
            "maCTDK_UUID",
            "@home_features_config",
          ]);
          if (token) {
            await AsyncStorage.setItem("@token", token);
          }
          if (supabaseJwt) {
            await AsyncStorage.setItem("@supabase_jwt", supabaseJwt);
          } else {
            await AsyncStorage.removeItem("@supabase_jwt");
          }
          await AsyncStorage.setItem(
            "maCTDK",
            String(dataObj?.maCTDK ?? (res as any)?.maCTDK ?? "")
          );
          await AsyncStorage.setItem("tenCTDKVT", account.companyCode);
          await AsyncStorage.setItem("@type_account", payload.typeAccount);
          await setAccountScope(buildAccountScope(payload.typeAccount, account.companyCode, account.username));
          await saveLastLogin(account);

          await persistTenantFromJwt(supabaseJwt || "", account.companyCode, res);
          await cacheCloudProfile(res, supabaseJwt || "");
          try {
            const st = await getSessionStatus();
            console.log(
              `[Login] session sau khi lưu: ok=${st.ok} reason=${st.reason} tenant=${st.tenantId} hasJwt=${st.hasJwt} expired=${st.jwtExpired}`
            );
            if (!st.ok) {
              Alert.alert(
                "Thông báo",
                "Đăng nhập thành công nhưng thiếu thông tin công ty (tenant). Vui lòng liên hệ quản trị để kiểm tra tài khoản."
              );
              return { status: "blocked" };
            }
          } catch {}
          return { status: "ok" };
        }
        console.log("[Login] WARN response 200 nhưng không có token/jwt nào");
        Alert.alert(
          "Thông báo",
          "Máy chủ không trả phiên đăng nhập (thiếu token). Vui lòng thử lại hoặc liên hệ quản trị."
        );
        return { status: "blocked" };
      }
      // cloud-auth trả HTTP 200 kèm { status: 401, message } khi sai tài khoản / mật khẩu.
      return { status: "rejected", message: res?.message || "Đăng nhập thất bại" };
    } catch (error) {
      console.log("Login error:", error);
      return { status: "network" };
    }
  };

  /** Phiên mới → bỏ hồ sơ chat cũ, nối lại kênh tin nhắn + đăng ký push cho tài khoản này. */
  const enterApp = () => {
    resetChatSession();
    chatAuthChanged(true);
    router.replace("/(tabs)/home");
  };

  /**
   * Sau khi đăng nhập bằng mật khẩu: Face ID đang bật cho tài khoản khác → xoá (chỉ nhớ tài khoản gần nhất);
   * chưa bật cho tài khoản này và chưa từng chọn "Không" → hỏi bật.
   */
  const offerBiometric = async (account: LoginAccount, pwd: string) => {
    const current = await getBiometricAccount();
    if (current && sameAccount(current, account)) return;
    if (current) {
      await disableBiometricLogin();
      setBiometricAccount(null);
    }
    const support = biometric ?? (await getBiometricSupport());
    if (!support || (await wasBiometricDeclined(account))) return;
    const accepted = await confirm({
      title: `Đăng nhập bằng ${support.label}?`,
      message: `Lần sau chỉ cần quét ${support.label} để đăng nhập tài khoản ${maskUsername(account.username)}. Có thể tắt trong Tài khoản.`,
      confirmText: "Bật",
      cancelText: "Không",
    });
    if (!accepted) {
      await markBiometricDeclined(account);
      return;
    }
    try {
      await enableBiometricLogin({ ...account, password: pwd }, support);
      // Đăng nhập bị chặn sau đó (thiếu tenant…) thì vẫn ở màn này → hiện nút Face ID ngay.
      setBiometric(support);
      setBiometricAccount(account);
      toast.show({ type: "success", message: `Đã bật đăng nhập bằng ${support.label}` });
    } catch (error) {
      if (error instanceof BiometricError && error.kind === "cancel") return;
      toast.show({ type: "error", message: `Chưa bật được ${support.label}. Có thể bật lại trong Tài khoản.` });
    }
  };

  const handleLogin = async () => {
    if (!companyCode || !username || !password) {
      setFormError("Vui lòng nhập đủ mã công ty, tài khoản và mật khẩu");
      hapticError();
      return;
    }

    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    setLoading(true);
    const account: LoginAccount = { loginType, companyCode: companyCode.trim(), username: username.trim() };
    try {
      const result = await signIn(account, password);
      if (result.status === "ok") {
        await offerBiometric(account, password);
        enterApp();
      } else if (result.status === "rejected") {
        hapticError();
        toast.show({ type: "error", message: result.message });
      } else if (result.status === "network") {
        hapticError();
        toast.show({ type: "error", message: NETWORK_ERROR });
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  /** Quét sinh trắc học → đọc mật khẩu trong Keychain / Keystore → đăng nhập như bằng mật khẩu. */
  const handleBiometricLogin = async () => {
    if (!biometric || submitting.current) return;
    const label = biometric.label;
    submitting.current = true;
    setBiometricLoading(true);
    const turnOff = async () => {
      await disableBiometricLogin();
      setBiometricAccount(null);
    };
    try {
      let credential;
      try {
        credential = await readBiometricCredential();
      } catch (error) {
        const kind = error instanceof BiometricError ? error.kind : "other";
        if (kind === "cancel") return;
        hapticError();
        toast.show({
          type: "error",
          message:
            kind === "lockout"
              ? `${capitalize(label)} đang tạm khoá do quét sai nhiều lần. Vui lòng đăng nhập bằng mật khẩu.`
              : `Không xác thực được ${label}. Vui lòng thử lại hoặc nhập mật khẩu.`,
        });
        return;
      }
      if (!credential) {
        // Vân tay / khuôn mặt trên máy đã thay đổi → hệ điều hành huỷ khoá.
        await turnOff();
        hapticError();
        toast.show({
          type: "error",
          message: `${capitalize(label)} trên máy đã thay đổi. Vui lòng đăng nhập bằng mật khẩu rồi bật lại.`,
        });
        return;
      }
      setLoginType(credential.loginType);
      setCompanyCode(credential.companyCode);
      setUsername(credential.username);
      setPassword("");
      setFormError(null);
      const result = await signIn(credential, credential.password);
      if (result.status === "ok") {
        enterApp();
      } else if (result.status === "rejected") {
        // Thường do đã đổi mật khẩu trên web → mật khẩu đã lưu không còn đúng.
        await turnOff();
        hapticError();
        toast.show({
          type: "error",
          message: `${result.message}. Đã tắt đăng nhập bằng ${label}, vui lòng nhập mật khẩu.`,
        });
      } else if (result.status === "network") {
        hapticError();
        toast.show({ type: "error", message: NETWORK_ERROR });
      }
    } finally {
      submitting.current = false;
      setBiometricLoading(false);
    }
  };

  const isAgency = loginType === "AGENCY";
  const BiometricIcon = biometric?.kind === "face" ? ScanFace : Fingerprint;

  // ── Không để bàn phím che ô đang nhập ────────────────────────────────────
  // KeyboardAvoidingView (iOS) / adjustResize (Android) thu vùng cuộn lại phía trên bàn phím;
  // sau khi bàn phím hiện thì cuộn ô đang focus lên gần đầu vùng nhìn thấy.
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef(0);
  const fieldY = useRef<Record<string, number>>({});
  const focused = useRef<string | null>(null);
  const keyboardShown = useRef(false);

  const scrollToFocused = useCallback(() => {
    const key = focused.current;
    if (!key || fieldY.current[key] == null) return;
    const y = cardY.current + fieldY.current[key] - space.xl;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const show = Keyboard.addListener(showEvt, () => {
      keyboardShown.current = true;
      // Chờ KeyboardAvoidingView co lại rồi mới cuộn
      setTimeout(scrollToFocused, Platform.OS === "ios" ? 280 : 50);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardShown.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollToFocused]);

  const fieldProps = (key: string) => ({
    onLayout: (e: LayoutChangeEvent) => {
      fieldY.current[key] = e.nativeEvent.layout.y;
    },
    onFocus: () => {
      focused.current = key;
      // Bàn phím đã mở sẵn (chuyển từ ô này sang ô khác) → không có sự kiện show mới
      if (keyboardShown.current) setTimeout(scrollToFocused, 50);
    },
  });

  const company = fieldProps("company");
  const user = fieldProps("user");
  const pass = fieldProps("pass");
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  return (
    <Screen keyboardAware scroll={false} padded={false}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image source={require("@/assets/images/beeland-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text variant="title" accessibilityRole="header" style={styles.title}>
            {isAgency ? "Đăng nhập Đại lý" : "Đăng nhập Nội bộ"}
          </Text>
          <Text variant="caption" color="textSecondary">
            Vui lòng nhập thông tin để tiếp tục
          </Text>
        </View>

        <View
          style={styles.card}
          onLayout={(e) => {
            cardY.current = e.nativeEvent.layout.y;
          }}
        >
          <SegmentedControl
            variant="accent"
            value={loginType}
            options={[
              { value: "INTERNAL", label: "Nội bộ" },
              { value: "AGENCY", label: "Đại lý" },
            ]}
            onChange={setLoginType}
          />

          <View onLayout={company.onLayout}>
            <TextField
              variant="soft"
              label="Mã công ty"
              placeholder="Nhập mã công ty"
              value={companyCode}
              onChangeText={(t) => {
                setCompanyCode(t);
                setFormError(null);
              }}
              onFocus={company.onFocus}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => usernameRef.current?.focus()}
              required
            />
          </View>
          <View onLayout={user.onLayout}>
            <TextField
              ref={usernameRef}
              variant="soft"
              label="Tài khoản"
              placeholder="Nhập tài khoản"
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                setFormError(null);
              }}
              onFocus={user.onFocus}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              required
            />
          </View>
          <View onLayout={pass.onLayout}>
            <TextField
              ref={passwordRef}
              variant="soft"
              label="Mật khẩu"
              placeholder="Nhập mật khẩu"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setFormError(null);
              }}
              onFocus={pass.onFocus}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleLogin()}
              error={formError}
              required
              suffix={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={12}
                >
                  {showPassword ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
                </Pressable>
              }
            />
          </View>

          <View style={styles.row}>
            <Button title="Quên mật khẩu?" variant="ghost" onPress={() => router.push("/forgot-password")} />
          </View>

          <Button title="Đăng nhập" size="lg" loading={loading} onPress={() => void handleLogin()} style={styles.pill} />

          {biometric && biometricAccount ? (
            <View style={styles.biometric}>
              <Button
                title={`Đăng nhập bằng ${biometric.label}`}
                variant="secondary"
                size="lg"
                icon={BiometricIcon}
                loading={biometricLoading}
                onPress={() => void handleBiometricLogin()}
                style={styles.pill}
              />
              <Text variant="caption" color="textSecondary" align="center" numberOfLines={1}>
                {biometricAccount.loginType === "AGENCY" ? "Đại lý" : "Nội bộ"} · {biometricAccount.companyCode} ·{" "}
                {maskUsername(biometricAccount.username)}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Khoảng trống dưới đủ để cuộn ô cuối lên trên bàn phím
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xxl * 2 },
  brand: { alignItems: "center", gap: space.xs, paddingBottom: space.xl },
  logo: { width: 76, height: 76, marginBottom: space.md },
  title: { fontSize: 24, lineHeight: 32 },
  card: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.x3,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  pill: { borderRadius: radius.full },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: -space.xs },
  biometric: { gap: space.sm },
});
