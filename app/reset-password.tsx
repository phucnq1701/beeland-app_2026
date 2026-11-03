import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Circle, Eye, EyeOff } from "lucide-react-native";

import { AppHeader, Button, Screen, Text, TextField, useToast } from "@/components/ui";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { MAX_PASSWORD, MIN_PASSWORD, resetErrorMessage } from "@/lib/staffResetPassword";
import { colors, space } from "@/theme";
import { StaffResetPasswordService } from "@/sevicesSupabase/StaffResetPasswordService";

/**
 * Quên mật khẩu – bước 3: đặt mật khẩu mới bằng token một lần (`staff-reset-password` {action:"reset"}, hạn 15 phút).
 * Máy chủ thu hồi mọi phiên đăng nhập của tài khoản → về màn đăng nhập.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { resetToken } = useLocalSearchParams<{ resetToken: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const hasMinLength = password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
  const hasMatch = password.length > 0 && password === confirmPassword;
  const isValid = hasMinLength && hasMatch;

  const handleReset = async () => {
    if (!isValid || submitting.current) return;
    submitting.current = true;
    try {
      setLoading(true);
      await StaffResetPasswordService.reset(resetToken ?? "", password);
      hapticSuccess();
      toast.show({ type: "success", message: "Đã đặt lại mật khẩu. Vui lòng đăng nhập lại." });
      router.dismissAll();
      router.replace("/login");
    } catch (error) {
      hapticError();
      toast.show({ type: "error", message: resetErrorMessage(error, "Không thể đặt lại mật khẩu") });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const eye = (
    <Pressable accessibilityRole="button" accessibilityLabel={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onPress={() => setShow(!show)} hitSlop={12}>
      {show ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen keyboardAware header={<AppHeader title="Đặt lại mật khẩu" />}>
        <TextField label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" textContentType="newPassword" suffix={eye} required />
        <TextField
          label="Nhập lại mật khẩu"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          textContentType="newPassword"
          error={confirmPassword && !hasMatch ? "Mật khẩu nhập lại không khớp" : null}
          required
        />
        <View style={styles.rules}>
          <Rule ok={hasMinLength} text={`Ít nhất ${MIN_PASSWORD} ký tự`} />
          <Rule ok={hasMatch} text="Hai mật khẩu trùng nhau" />
        </View>
        <Button title="Đặt lại mật khẩu" size="lg" loading={loading} disabled={!isValid} onPress={() => void handleReset()} />
      </Screen>
    </>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  const Icon = ok ? CheckCircle2 : Circle;
  return (
    <View style={styles.rule}>
      <Icon size={18} color={ok ? colors.success : colors.textTertiary} />
      <Text variant="caption" color={ok ? "success" : "textSecondary"}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: space.xs },
  rule: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
