import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildAccountScope, setAccountScope } from "@/components/utils/accountScope";
import Colors from "@/constants/colors";
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
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loginType, setLoginType] = useState<"INTERNAL" | "AGENCY">("INTERNAL");
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

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
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

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
        Alert.alert("Thông báo", res?.message || "Đăng nhập thất bại");
      }
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert("Lỗi", "Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  const isAgency = loginType === "AGENCY";
  const primaryColor = isAgency ? "#0284c7" : Colors.primary;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/beeland-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.welcomeText}>
            {isAgency ? "Đăng nhập Đại lý" : "Đăng nhập Nội bộ"}
          </Text>
          <Text style={styles.subText}>
            Vui lòng nhập thông tin để tiếp tục
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mã công ty</Text>
            <TextInput
              style={[styles.input, isAgency && { borderColor: "#bae6fd" }]}
              placeholder="Nhập mã công ty"
              placeholderTextColor={Colors.textLight}
              value={companyCode}
              onChangeText={setCompanyCode}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tài khoản</Text>
            <TextInput
              style={[styles.input, isAgency && { borderColor: "#bae6fd" }]}
              placeholder="Nhập tài khoản"
              placeholderTextColor={Colors.textLight}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  isAgency && { borderColor: "#bae6fd" },
                ]}
                placeholder="Nhập mật khẩu"
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <TouchableOpacity
              style={styles.rememberContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <Ionicons
                name={rememberMe ? "checkbox" : "square-outline"}
                size={20}
                color={rememberMe ? primaryColor : Colors.textSecondary}
              />
              <Text style={styles.rememberText}>Nhớ mật khẩu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push("/forgot-password")}
            >
              <Text style={[styles.forgotPasswordText, { color: primaryColor }]}>
                Quên mật khẩu?
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              { backgroundColor: primaryColor },
              loading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={[styles.registerLink, { color: primaryColor }]}>
                Đăng ký
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>HOẶC</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* <View style={styles.switchWrapper}>
            <View style={styles.switchContainer}>
              <TouchableOpacity
                style={[
                  styles.switchTab,
                  !isAgency && { backgroundColor: Colors.primary },
                ]}
                onPress={() => setLoginType("INTERNAL")}
              >
                <Text
                  style={[
                    styles.switchText,
                    !isAgency && styles.switchTextActive,
                  ]}
                >
                  Nội bộ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchTab,
                  isAgency && { backgroundColor: "#0284c7" },
                ]}
                onPress={() => setLoginType("AGENCY")}
              >
                <Text
                  style={[
                    styles.switchText,
                    isAgency && styles.switchTextActive,
                  ]}
                >
                  Đại lý
                </Text>
              </TouchableOpacity>
            </View>
          </View> */}
          <View style={styles.roleRow}>
            {(
              [
                {
                  key: "INTERNAL",
                  label: "Nội bộ",
                  icon: "business-outline",
                  color: Colors.primary,
                },
                {
                  key: "AGENCY",
                  label: "Đại lý",
                  icon: "people-outline",
                  color: "#0284c7",
                },
              ] as const
            ).map((item) => {
              const active = loginType === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.8}
                  onPress={() => setLoginType(item.key)}
                  style={[
                    styles.roleCard,
                    active && {
                      borderColor: item.color,
                      backgroundColor: item.color + "14", // nền nhạt ~8%
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.roleIconWrap,
                      { backgroundColor: active ? item.color : "#f1f5f9" },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? Colors.white : Colors.textSecondary}
                    />
                  </View>

                  <Text
                    style={[
                      styles.roleText,
                      active && { color: item.color, fontWeight: "700" },
                    ]}
                  >
                    {item.label}
                  </Text>

                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={item.color}
                      style={styles.roleCheck}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoContainer: { alignItems: "center", marginBottom: 24 },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 16 },
  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 6,
  },
  subText: { fontSize: 15, color: Colors.textSecondary },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 18,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    width: 60, // độ rộng cố định để chữ luôn ở giữa
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  switchWrapper: { width: "100%", alignItems: "center" },
  switchContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 3,
    width: "70%",
  },
  switchTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  switchText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  switchTextActive: { color: Colors.white },
  formContainer: { width: "100%" },
  inputContainer: { marginBottom: 18 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  passwordWrapper: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 50 },
  eyeButton: { position: "absolute", right: 16 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  rememberContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  rememberText: { fontSize: 14, color: Colors.textSecondary },
  forgotPassword: {},
  forgotPasswordText: { fontSize: 14, fontWeight: "500" },
  loginButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { fontSize: 16, fontWeight: "700", color: Colors.white },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  registerText: { fontSize: 14, color: Colors.textSecondary },
  registerLink: { fontSize: 14, fontWeight: "600" },
  roleRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  roleCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  roleText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  roleCheck: {
    position: "absolute",
    top: 6,
    right: 6,
  },
});
