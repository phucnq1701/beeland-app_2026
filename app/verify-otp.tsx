import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import Colors from "@/constants/colors";
import { AuthService } from "@/sevices/AuthService";

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 60;

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { companyCode, email } = useLocalSearchParams<{
    companyCode: string;
    email: string;
  }>();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [countdown, setCountdown] = useState(RESEND_TIMEOUT);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);

      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp]
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace" && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();

        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    },
    [otp]
  );

  const isValid = otp.every((digit) => digit.length === 1);

  const handleVerify = async () => {
    if (!isValid) return;

    try {
      setLoading(true);

      const otpCode = otp.join("");

      const res = await AuthService.verifyOTP({
        TenCTDKVT: companyCode,
        Email: email,
        OTP: otpCode,
      });

      console.log("Verify OTP:", res);

      if (res?.status === 200) {
        router.push({
          pathname: "/reset-password",
          params: {
            companyCode,
            email,
            otp: otpCode,
          },
        });
      } else {
        Alert.alert("Lỗi", res?.message || "OTP không đúng");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Lỗi", "Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    try {
      setLoading(true);

      const res = await AuthService.forgotPassword({
        TenCTDKVT: companyCode,
        Email: email,
      });

      console.log("Resend OTP:", res);

      if (res?.status === 200) {
        Alert.alert("Thông báo", "OTP mới đã được gửi");

        setCountdown(RESEND_TIMEOUT);
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert("Lỗi", res?.message || "Không gửi lại OTP được");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Lỗi", "Không kết nối được server");
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={32} color={Colors.accent.green} />
            </View>

            <Text style={styles.title}>Xác thực OTP</Text>

            <Text style={styles.subtitle}>
              Mã xác thực đã được gửi đến{"\n"}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                ]}
                value={digit}
                onChangeText={(text) =>
                  handleOtpChange(text.replace(/[^0-9]/g, ""), index)
                }
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          <View style={styles.resendContainer}>
            <Text style={styles.resendLabel}>Chưa nhận được mã?</Text>

            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || loading}
            >
              <Text
                style={[
                  styles.resendText,
                  countdown > 0 && styles.resendTextDisabled,
                ]}
              >
                {countdown > 0
                  ? `Gửi lại (${countdown}s)`
                  : "Gửi lại mã"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!isValid || loading) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Xác nhận</Text>
            )}
          </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.featureGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    textAlign: 'center' as const,
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.featureOrange,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 32,
  },
  resendLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  resendTextDisabled: {
    color: Colors.textLight,
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
