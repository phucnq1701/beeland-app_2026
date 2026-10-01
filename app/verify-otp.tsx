import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader, Button, Screen, Text, useFontsLoaded, useToast } from "@/components/ui";
import { hapticError } from "@/lib/haptics";
import { MAX_FONT_SCALE, colors, fontStyleFor, radius, space, typography } from "@/theme";
import { AuthService } from "@/sevices/AuthService";

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 60;

/** Quên mật khẩu – bước 2: nhập OTP 6 số (API và luồng giữ nguyên). */
export default function VerifyOtpScreen() {
  const router = useRouter();
  const toast = useToast();
  const { companyCode, email } = useLocalSearchParams<{ companyCode: string; email: string }>();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [countdown, setCountdown] = useState(RESEND_TIMEOUT);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const fontsLoaded = useFontsLoaded();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const digits = text.replace(/\D/g, "");
      // Dán cả mã 6 số vào một ô
      if (digits.length > 1) {
        const next = Array(OTP_LENGTH)
          .fill("")
          .map((_, i) => digits[i] ?? "");
        setOtp(next);
        inputRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
        return;
      }
      const newOtp = [...otp];
      newOtp[index] = digits;
      setOtp(newOtp);
      if (digits && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
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
    if (!isValid || busy.current) return;
    busy.current = true;
    try {
      setLoading(true);
      const otpCode = otp.join("");
      const res = await AuthService.verifyOTP({ TenCTDKVT: companyCode, Email: email, OTP: otpCode });
      if (res?.status === 200) {
        router.push({ pathname: "/reset-password", params: { companyCode, email, otp: otpCode } });
      } else {
        hapticError();
        toast.show({ type: "error", message: res?.message || "OTP không đúng" });
      }
    } catch (error) {
      console.log(error);
      hapticError();
      toast.show({ type: "error", message: "Không kết nối được máy chủ" });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || busy.current) return;
    busy.current = true;
    try {
      setLoading(true);
      const res = await AuthService.forgotPassword({ TenCTDKVT: companyCode, Email: email });
      if (res?.status === 200) {
        toast.show({ type: "success", message: "Đã gửi mã OTP mới" });
        setCountdown(RESEND_TIMEOUT);
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } else {
        hapticError();
        toast.show({ type: "error", message: res?.message || "Không gửi lại OTP được" });
      }
    } catch (error) {
      console.log(error);
      hapticError();
      toast.show({ type: "error", message: "Không kết nối được máy chủ" });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen keyboardAware header={<AppHeader title="Nhập mã OTP" />}>
        <Text variant="body" color="textSecondary">
          Mã 6 số đã được gửi tới {email || "email của bạn"}.
        </Text>
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputRefs.current[i] = r;
              }}
              value={digit}
              onChangeText={(t) => handleOtpChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={i === 0 ? OTP_LENGTH : 1}
              accessibilityLabel={`Số thứ ${i + 1} của mã OTP`}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.otpBox, fontStyleFor("semibold", fontsLoaded), digit ? styles.otpFilled : null]}
              selectTextOnFocus
            />
          ))}
        </View>
        <Button title="Xác nhận" size="lg" loading={loading} disabled={!isValid} onPress={() => void handleVerify()} />
        <Button
          title={countdown > 0 ? `Gửi lại mã sau ${countdown}s` : "Gửi lại mã OTP"}
          variant="ghost"
          disabled={countdown > 0}
          onPress={() => void handleResend()}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: space.sm, marginVertical: space.md },
  otpBox: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: typography.title.fontSize,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  otpFilled: { borderColor: colors.primary, borderWidth: 2 },
});
