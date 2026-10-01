import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { KeyRound } from "lucide-react-native";

import { AppHeader, Button, Screen, Text, TextField, useToast } from "@/components/ui";
import { hapticError } from "@/lib/haptics";
import { colors, radius, space } from "@/theme";
import { AuthService } from "@/sevices/AuthService";

/** Quên mật khẩu – bước 1: gửi OTP về email (API giữ nguyên). */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const [companyCode, setCompanyCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const isValid = companyCode.trim().length > 0 && email.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting.current) return;
    submitting.current = true;
    try {
      setLoading(true);
      const res = await AuthService.forgotPassword({ TenCTDKVT: companyCode.trim(), Email: email.trim() });
      if (res?.status === 200) {
        toast.show({ type: "success", message: "Đã gửi mã OTP về email" });
        router.push({ pathname: "/verify-otp", params: { companyCode, email } });
      } else {
        hapticError();
        toast.show({ type: "error", message: res?.message || "Không gửi được OTP" });
      }
    } catch (error) {
      console.log(error);
      hapticError();
      toast.show({ type: "error", message: "Không kết nối được máy chủ" });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen keyboardAware header={<AppHeader title="Quên mật khẩu" />}>
        <View style={styles.intro}>
          <View style={styles.icon}>
            <KeyRound size={28} color={colors.primary} />
          </View>
          <Text variant="body" color="textSecondary" style={styles.center}>
            Nhập mã công ty và email đăng ký. Chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.
          </Text>
        </View>
        <TextField label="Mã công ty" placeholder="Nhập mã công ty" value={companyCode} onChangeText={setCompanyCode} autoCapitalize="none" required />
        <TextField
          label="Email"
          placeholder="example@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => void handleSubmit()}
          required
        />
        <Button title="Gửi mã OTP" size="lg" loading={loading} disabled={!isValid} onPress={() => void handleSubmit()} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: "center", gap: space.md, paddingVertical: space.lg },
  icon: { width: 64, height: 64, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySubtle },
  center: { textAlign: "center" },
});
