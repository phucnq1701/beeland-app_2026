import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from "lucide-react-native";
import Colors from "@/constants/colors";
import { AuthService } from "./sevices/AuthService";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { companyCode, email, otp } = useLocalSearchParams<{
    companyCode: string;
    email: string;
    otp: string;
  }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 6;
  const hasMatch = password.length > 0 && password === confirmPassword;
  const isValid = hasMinLength && hasMatch;

  const handleReset = async () => {
    if (!isValid) return;

    try {
      setLoading(true);

      const payload = {
        TenCTDK: companyCode,
        Password: password,
        PasswordRe: confirmPassword,
        MaNV: Number(otp),
      };

      console.log("Reset payload:", payload);

      const res = await AuthService.resetPassword(payload);

      console.log("Reset response:", res);

      Alert.alert(
        "Thành công",
        "Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại.",
        [
          {
            text: "Đăng nhập",
            onPress: () => {
              router.dismissAll();
              router.replace("/login");
            },
          },
        ]
      );
    } catch (error: any) {
      console.log(error);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message || "Không thể đặt lại mật khẩu"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Lock size={32} color={Colors.accent.blue} />
            </View>

            <Text style={styles.title}>Đặt lại mật khẩu</Text>

            <Text style={styles.subtitle}>
              Tạo mật khẩu mới cho tài khoản của bạn
            </Text>
          </View>

          <View style={styles.formContainer}>
            {/* PASSWORD */}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mật khẩu mới</Text>

              <View style={styles.inputWrapper}>
                <Lock
                  size={20}
                  color={Colors.textLight}
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu mới"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />

                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.textLight} />
                  ) : (
                    <Eye size={20} color={Colors.textLight} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* CONFIRM PASSWORD */}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Xác nhận mật khẩu</Text>

              <View style={styles.inputWrapper}>
                <Lock
                  size={20}
                  color={Colors.textLight}
                  style={styles.inputIcon}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor={Colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.textLight} />
                  ) : (
                    <Eye size={20} color={Colors.textLight} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* RULES */}

            <View style={styles.rulesContainer}>
              <View style={styles.ruleRow}>
                <CheckCircle
                  size={16}
                  color={hasMinLength ? Colors.success : Colors.textLight}
                />

                <Text
                  style={[
                    styles.ruleText,
                    hasMinLength && styles.ruleTextValid,
                  ]}
                >
                  Tối thiểu 6 ký tự
                </Text>
              </View>

              <View style={styles.ruleRow}>
                <CheckCircle
                  size={16}
                  color={hasMatch ? Colors.success : Colors.textLight}
                />

                <Text
                  style={[
                    styles.ruleText,
                    hasMatch && styles.ruleTextValid,
                  ]}
                >
                  Mật khẩu xác nhận trùng khớp
                </Text>
              </View>
            </View>

            {/* BUTTON */}

            <TouchableOpacity
              style={[
                styles.resetButton,
                (!isValid || loading) && styles.resetButtonDisabled,
              ]}
              onPress={handleReset}
              disabled={!isValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.resetButtonText}>
                  Đặt lại mật khẩu
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  headerSection: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 40,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.featureBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
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

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
  },

  eyeButton: {
    padding: 4,
  },

  rulesContainer: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 28,
  },

  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  ruleText: {
    fontSize: 14,
    color: Colors.textLight,
  },

  ruleTextValid: {
    color: Colors.success,
  },

  resetButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  resetButtonDisabled: {
    opacity: 0.5,
  },

  resetButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
});