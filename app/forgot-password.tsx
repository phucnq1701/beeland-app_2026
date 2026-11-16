import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyRound } from "lucide-react-native";

import { AppHeader, Button, Screen, Text, TextField, useToast } from "@/components/ui";
import { hapticError } from "@/lib/haptics";
import { resetErrorMessage } from "@/lib/staffResetPassword";
import { colors, radius, space } from "@/theme";
import { StaffResetPasswordService } from "@/sevicesSupabase/StaffResetPasswordService";

/**
 * Quên mật khẩu – bước 1: gửi mã OTP tới email đăng ký của tài khoản (nhân viên nội bộ + đại lý).
 * API `fn_nv_app_quen_mat_khau` {action:"request"} – máy chủ trả cùng một dạng dù tài khoản có email hay không.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ companyCode?: string; account?: string }>();
  const [companyCode, setCompanyCode] = useState(params.companyCode ?? "");
  const [account, setAccount] = useState(params.account ?? "");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const isValid = companyCode.trim().length > 0 && account.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting.current) return;
    submitting.current = true;
    try {
      setLoading(true);
      const res = await StaffResetPasswordService.request(companyCode, account);
      router.push({
        pathname: "/verify-otp",
        params: { companyCode: companyCode.trim(), account: account.trim(), otpId: res.otpId, resendAfter: String(res.resendAfter ?? 60) },
      });
    } catch (error) {
      hapticError();
      toast.show({ type: "error", message: resetErrorMessage(error, "Không gửi được mã xác thực") });
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
            Nhập mã công ty và tài khoản đăng nhập. Mã xác thực sẽ được gửi tới email đăng ký của tài khoản.
          </Text>
        </View>
        <TextField label="Mã công ty" placeholder="Nhập mã công ty" value={companyCode} onChangeText={setCompanyCode} autoCapitalize="none" required />
        <TextField
          label="Tài khoản đăng nhập"
          placeholder="Tài khoản dùng để đăng nhập"
          value={account}
          onChangeText={setAccount}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={() => void handleSubmit()}
          required
        />
        <Button title="Gửi mã xác thực" size="lg" loading={loading} disabled={!isValid} onPress={() => void handleSubmit()} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: "center", gap: space.md, paddingVertical: space.lg },
  icon: { width: 64, height: 64, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySubtle },
  center: { textAlign: "center" },
});
