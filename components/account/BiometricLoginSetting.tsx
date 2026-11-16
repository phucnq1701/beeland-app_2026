import React, { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import { Eye, EyeOff, Fingerprint, ScanFace } from "lucide-react-native";

import { Button, Card, ListItem, Text, TextField, useToast } from "@/components/ui";
import {
  BiometricError,
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricAccount,
  getBiometricSupport,
  loadLastLogin,
  type BiometricSupport,
} from "@/lib/biometric";
import { maskUsername, sameAccount, type LoginAccount } from "@/lib/biometricLogin";
import { hapticError } from "@/lib/haptics";
import { AuthApi } from "@/services/AuthApi";
import { colors, radius, space } from "@/theme";

type Props = {
  /** Bọc dòng (vd. đường kẻ phân cách) – không render gì khi máy không hỗ trợ. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Dòng "Đăng nhập bằng Face ID / vân tay" trong Tài khoản > Cài đặt (docs/auth.md).
 * Bật: nhập mật khẩu → kiểm tra với máy chủ → quét sinh trắc học → lưu Keychain / Keystore. Tắt: xoá ngay.
 */
export function BiometricLoginSetting({ style }: Props) {
  const toast = useToast();
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [account, setAccount] = useState<LoginAccount | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const [s, current, bio] = await Promise.all([getBiometricSupport(), loadLastLogin(), getBiometricAccount()]);
        if (!active) return;
        setSupport(s);
        setAccount(current);
        setEnabled(!!current && !!bio && sameAccount(current, bio));
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!support || !account) return null;
  const label = support.label;

  const close = () => {
    if (busy.current) return;
    setAsking(false);
    setPassword("");
    setError(null);
  };

  const onToggle = async (next: boolean) => {
    if (busy.current) return;
    if (next) {
      setPassword("");
      setError(null);
      setShowPassword(false);
      setAsking(true);
      return;
    }
    busy.current = true;
    try {
      await disableBiometricLogin();
      setEnabled(false);
      toast.show({ type: "success", message: `Đã tắt đăng nhập bằng ${label}` });
    } finally {
      busy.current = false;
    }
  };

  const submit = async () => {
    if (!password) {
      setError("Vui lòng nhập mật khẩu");
      hapticError();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      let verified;
      try {
        verified = await AuthApi.verifyPassword(account, password);
      } catch {
        hapticError();
        toast.show({ type: "error", message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." });
        return;
      }
      if (!verified.ok) {
        hapticError();
        setError(verified.message);
        return;
      }
      try {
        await enableBiometricLogin({ ...account, password }, support);
      } catch (e) {
        if (e instanceof BiometricError && e.kind === "cancel") return;
        hapticError();
        toast.show({ type: "error", message: `Chưa bật được ${label}. Vui lòng thử lại.` });
        return;
      }
      setEnabled(true);
      setAsking(false);
      setPassword("");
      toast.show({ type: "success", message: `Đã bật đăng nhập bằng ${label}` });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const Icon = support.kind === "face" ? ScanFace : Fingerprint;

  return (
    <View style={style}>
      <ListItem
        leading={
          <View style={styles.rowIcon}>
            <Icon size={20} color={colors.brand} strokeWidth={2} />
          </View>
        }
        title={`Đăng nhập bằng ${label}`}
        subtitle={enabled ? maskUsername(account.username) : "Đang tắt"}
        trailing={
          <Switch
            value={enabled}
            onValueChange={(v) => void onToggle(v)}
            accessibilityLabel={`Đăng nhập bằng ${label}`}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
            thumbColor={colors.surface}
          />
        }
      />

      <Modal visible={asking} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Đóng" />
            <Card style={styles.card}>
              <Text variant="heading" accessibilityRole="header">
                Bật đăng nhập bằng {label}
              </Text>
              <Text variant="body" color="textSecondary">
                Nhập mật khẩu tài khoản {maskUsername(account.username)} để xác nhận. Mật khẩu chỉ được lưu trong bộ
                bảo mật của máy và chỉ mở được bằng {label}.
              </Text>
              <TextField
                variant="soft"
                label="Mật khẩu"
                placeholder="Nhập mật khẩu"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                error={error}
                suffix={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={12}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={colors.textSecondary} />
                    ) : (
                      <Eye size={20} color={colors.textSecondary} />
                    )}
                  </Pressable>
                }
              />
              <View style={styles.actions}>
                <Button title="Huỷ" variant="secondary" onPress={close} disabled={saving} style={styles.action} />
                <Button title="Bật" loading={saving} onPress={() => void submit()} style={styles.action} />
              </View>
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.backdrop,
  },
  card: { gap: space.md, borderWidth: 0, borderRadius: radius.xxl },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  action: { flex: 1, borderRadius: radius.full },
});
