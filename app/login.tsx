import React, { useState } from "react";
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
import Colors from "@/constants/colors";
import { cacheCloudProfile, PROFILE_KEY } from "@/sevicesSupabase/CloudProfileService";
import { AuthSupabaseService } from "@/sevicesSupabase/AuthService";
import { persistTenantFromJwt } from "@/sevicesSupabase/cloudTenant";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!companyCode || !username || !password) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    try {
      setLoading(true);

      const res = await AuthSupabaseService.login(
        //   {
        //   TenCTDKVT: companyCode.trim(),
        //   Email: username.trim(),
        //   Password: password,
        // }
        {
          action: "login",
          maCTDK: companyCode.trim(),
          email: username.trim(),
          password: password,
          typeAccount: "SYSTEM",
        }
      );
      console.log("[Login] cloud-auth response keys:", Object.keys(res || {}));
      if (res?.status === 200) {
        const dataObj = (res as any)?.data && typeof (res as any).data === "object" ? (res as any).data : {};
        const token =
          (res as any)?.acessToken ??
          (res as any)?.accessToken ??
          (res as any)?.token ??
          dataObj?.acessToken ??
          dataObj?.accessToken ??
          dataObj?.token ??
          "";
        // Backend mới có thể trả jwt ở nhiều chỗ khác nhau — quét hết
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
          const {
            decodeJwtPayload,
            isJwtExpired,
            findJwtInObject,
            looksLikeJwt,
          } = await import("@/sevicesSupabase/cloudTenant");
          // Quét đệ quy phòng backend đổi tên key chứa JWT
          if (!supabaseJwt || !looksLikeJwt(supabaseJwt)) {
            const scanned = findJwtInObject(res);
            if (scanned) {
              console.log("[Login] tìm thấy JWT bằng quét đệ quy response");
              supabaseJwt = scanned;
            }
          }
          const p = decodeJwtPayload(supabaseJwt || "");
          console.log(
            `[Login] jwt exp=${p?.exp} now=${Math.floor(Date.now() / 1000)} expired=${isJwtExpired(supabaseJwt || "")} company_id=${p?.company_id || p?.ma_ctdk} company_code=${p?.company_code} role=${p?.role}`
          );
          if (!supabaseJwt) console.log("[Login] WARN không tìm thấy cloud_jwt trong response, kiểm tra keys ở trên");
          if (supabaseJwt && isJwtExpired(supabaseJwt)) console.log("[Login] WARN jwt vừa nhận đã expired, báo AI web kiểm tra expiresIn/secret");
        } catch {}

        // Lưu session khi có token HOẶC jwt (trước đây chỉ lưu khi có token
        // nên nhiều tài khoản vào được home nhưng mọi API Supabase đều rỗng).
        // Không bao giờ lưu chuỗi rỗng vào @supabase_jwt.
        if (token || supabaseJwt) {
          // Xoá sạch phiên cũ trước khi ghi mới để tránh kẹt token/tenant cũ
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
          ]);
          if (token) {
            await AsyncStorage.setItem("@token", token);
          }
          if (supabaseJwt) {
            await AsyncStorage.setItem("@supabase_jwt", supabaseJwt);
          } else {
            await AsyncStorage.removeItem("@supabase_jwt");
          }
          await AsyncStorage.setItem("maCTDK", String(dataObj?.maCTDK ?? (res as any)?.maCTDK ?? ""));
          await AsyncStorage.setItem("tenCTDKVT", companyCode.trim());
          await persistTenantFromJwt(supabaseJwt || "", companyCode.trim(), res);
          await cacheCloudProfile(res, supabaseJwt || "");
          try {
            const { getSessionStatus } = await import("@/sevicesSupabase/cloudTenant");
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/beeland-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.welcomeText}>Đăng nhập</Text>
          <Text style={styles.subText}>
            Vui lòng nhập thông tin để tiếp tục
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mã công ty</Text>

            <TextInput
              style={styles.input}
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
              style={styles.input}
              placeholder="Nhập tài khoản"
              placeholderTextColor={Colors.textLight}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mật khẩu</Text>

            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              placeholderTextColor={Colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
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
              <Text style={styles.registerLink}>Đăng ký</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },

  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 24,
  },

  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
  },

  subText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },

  formContainer: {
    width: "100%",
  },

  inputContainer: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
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

  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },

  forgotPasswordText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500",
  },

  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
});
