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
import { Eye, EyeOff, Square, SquareCheck } from "lucide-react-native";

import { buildAccountScope, setAccountScope } from "@/components/utils/accountScope";
import { Button, Screen, SegmentedControl, Text, TextField, useToast } from "@/components/ui";
import { hapticError } from "@/lib/haptics";
import { colors, elevation, radius, space } from "@/theme";
import {
  cacheCloudProfile,
  PROFILE_KEY,
} from "@/sevicesSupabase/CloudProfileService";
import { AuthSupabaseService } from "@/sevicesSupabase/AuthService";
import {
  persistTenantFromJwt,
  decodeJwtPayload,
  isJwtExpired,
  findJwtInObject,
  looksLikeJwt,
  getSessionStatus,
} from "@/sevicesSupabase/cloudTenant";

/**
 * Đăng nhập (nội bộ / đại lý). Luồng đăng nhập (lưu phiên, tenant, nhớ mật khẩu) giữ nguyên;
 * chỉ đổi giao diện và cách báo lỗi (lỗi nhập → dưới form; lỗi đăng nhập/mạng → toast;
 * lỗi cấu hình tài khoản nghiêm trọng → Alert như cũ).
 */
export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();

  const [loginType, setLoginType] = useState<"INTERNAL" | "AGENCY">("INTERNAL");
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const loadCredentials = async () => {
      const saved = await AsyncStorage.getItem("@remember_login");
      if (saved) {
        const { companyCode, username, password, loginType, rememberMe } = JSON.parse(saved);
        setCompanyCode(companyCode || "");
        setUsername(username || "");
        setPassword(password || "");
        setLoginType(loginType || "INTERNAL");
        setRememberMe(rememberMe || false);
      }
    };
    loadCredentials();
  }, []);

  const handleLogin = async () => {
    if (!companyCode || !username || !password) {
      setFormError("Vui lòng nhập đủ mã công ty, tài khoản và mật khẩu");
      hapticError();
      return;
    }

    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      setLoading(true);

      const payload = {
        action: "login",
        maCTDK: companyCode.trim(),
        email: username.trim(),
        password: password,
        typeAccount: loginType === "AGENCY" ? "AGENCY" : "SYSTEM",
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
          await AsyncStorage.setItem("tenCTDKVT", companyCode.trim());
          await AsyncStorage.setItem(
            "@type_account",
            loginType === "AGENCY" ? "AGENCY" : "SYSTEM"
          );
          await setAccountScope(
            buildAccountScope(
              loginType === "AGENCY" ? "AGENCY" : "SYSTEM",
              companyCode,
              username
            )
          );
          
          if (rememberMe) {
            await AsyncStorage.setItem("@remember_login", JSON.stringify({
              companyCode, username, password, loginType, rememberMe
            }));
          } else {
            await AsyncStorage.removeItem("@remember_login");
          }

          await persistTenantFromJwt(
            supabaseJwt || "",
            companyCode.trim(),
            res
          );
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
              return;
            }
          } catch {}
          router.replace("/(tabs)/home");
        } else {
          console.log("[Login] WARN response 200 nhưng không có token/jwt nào");
          Alert.alert(
            "Thông báo",
            "Máy chủ không trả phiên đăng nhập (thiếu token). Vui lòng thử lại hoặc liên hệ quản trị."
          );
        }
      } else {
        hapticError();
        toast.show({ type: "error", message: res?.message || "Đăng nhập thất bại" });
      }
    } catch (error) {
      console.log("Login error:", error);
      hapticError();
      toast.show({ type: "error", message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const isAgency = loginType === "AGENCY";
  const Check = rememberMe ? SquareCheck : Square;

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
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.remember}
              hitSlop={8}
            >
              <Check size={20} color={rememberMe ? colors.primary : colors.textSecondary} />
              <Text variant="body">Nhớ mật khẩu</Text>
            </Pressable>
            <Button title="Quên mật khẩu?" variant="ghost" onPress={() => router.push("/forgot-password")} />
          </View>

          <Button title="Đăng nhập" size="lg" loading={loading} onPress={() => void handleLogin()} style={styles.pill} />
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: -space.xs },
  remember: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
});
