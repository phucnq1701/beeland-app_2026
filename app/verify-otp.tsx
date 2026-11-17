import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader, Button, Screen, Text, useFontsLoaded, useToast } from "@/components/ui";
import { hapticError } from "@/lib/haptics";
import { OTP_LENGTH, resetErrorMessage, retryAfterOf } from "@/lib/staffResetPassword";
import { MAX_FONT_SCALE, colors, fontStyleFor, radius, space } from "@/theme";
import { StaffResetPasswordService } from "@/services/StaffResetPasswordService";

const RESEND_TIMEOUT = 60;

/**
 * Quên mật khẩu – bước 2: nhập mã 6 số đã gửi qua email (`staff-reset-password` {action:"verify"}) → token đặt lại một lần.
 * Sai 5 lần máy chủ huỷ mã → gửi lại mã mới.
 */
export default function VerifyOtpScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ companyCode: string; account: string; otpId: string; resendAfter?: string }>();
  const [otpId, setOtpId] = useState(params.otpId ?? "");
  // Một ô nhập ẩn giữ cả mã, 6 ô chỉ hiển thị → gõ nhanh / dán / tự điền mã từ email không mất số.
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(Number(params.resendAfter) > 0 ? Number(params.resendAfter) : RESEND_TIMEOUT);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const inputRef = useRef<TextInput | null>(null);
  const fontsLoaded = useFontsLoaded();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const isValid = code.length === OTP_LENGTH;
  const onChangeCode = (t: string) => setCode(t.replace(/\D/g, "").slice(0, OTP_LENGTH));
  const clearCode = () => {
    setCode("");
    inputRef.current?.focus();
  };

  const handleVerify = async () => {
    if (!isValid || busy.current) return;
    busy.current = true;
    try {
      setLoading(true);
      const res = await StaffResetPasswordService.verify(otpId, code);
      // replace: mã đã dùng, quay lại bước này không còn ý nghĩa
      router.replace({ pathname: "/reset-password", params: { resetToken: res.resetToken } });
    } catch (error) {
      hapticError();
      toast.show({ type: "error", message: resetErrorMessage(error, "Mã xác thực không đúng") });
      clearCode();
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
      const res = await StaffResetPasswordService.request(params.companyCode ?? "", params.account ?? "");
      setOtpId(res.otpId);
      toast.show({ type: "success", message: "Đã gửi lại mã xác thực" });
      setCountdown(res.resendAfter > 0 ? res.resendAfter : RESEND_TIMEOUT);
      clearCode();
    } catch (error) {
      hapticError();
      const wait = retryAfterOf(error);
      if (wait) setCountdown(wait);
      toast.show({ type: "error", message: resetErrorMessage(error, "Không gửi lại được mã") });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen keyboardAware header={<AppHeader title="Nhập mã xác thực" />}>
        <Text variant="body" color="textSecondary">
          Nếu tài khoản {params.account ? `"${params.account}" ` : ""}có email đăng ký, mã 6 số đã được gửi tới email đó. Mã có hiệu lực 10 phút.
        </Text>
        <Pressable
          accessibilityRole="none"
          onPress={() => inputRef.current?.focus()}
          style={styles.otpRow}
        >
          {Array.from({ length: OTP_LENGTH }, (_, i) => {
            const digit = code[i] ?? "";
            const active = i === Math.min(code.length, OTP_LENGTH - 1);
            return (
              <View key={i} style={[styles.otpBox, digit ? styles.otpFilled : active ? styles.otpActive : null]}>
                <Text variant="title" style={fontStyleFor("semibold", fontsLoaded)} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {digit}
                </Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChangeCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
            accessibilityLabel="Mã xác thực 6 số"
            onSubmitEditing={() => void handleVerify()}
            style={styles.hiddenInput}
          />
        </Pressable>
        <Button title="Xác nhận" size="lg" loading={loading} disabled={!isValid} onPress={() => void handleVerify()} />
        <Button
          title={countdown > 0 ? `Gửi lại mã sau ${countdown}s` : "Gửi lại mã"}
          variant="ghost"
          disabled={countdown > 0}
          onPress={() => void handleResend()}
        />
        <Text variant="caption" color="textTertiary" style={styles.help}>
          Không nhận được email? Kiểm tra thư rác, hoặc liên hệ quản trị viên để được đặt lại mật khẩu.
        </Text>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  otpFilled: { borderColor: colors.primary, borderWidth: 2 },
  otpActive: { borderColor: colors.primary },
  // Phủ cả hàng, trong suốt: chạm vào hàng ô là mở bàn phím
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0.011, color: colors.surface },
  help: { textAlign: "center" },
});
