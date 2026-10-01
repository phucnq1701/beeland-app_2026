import React from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";

import { AppHeader, Button, Screen, Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

/**
 * Đăng ký tài khoản: màn cũ KHÔNG gọi máy chủ mà vẫn báo "Đăng ký thành công" (dữ liệu giả).
 * Tài khoản do quản trị cấp trên hệ thống → màn này chỉ hướng dẫn; lối vào từ màn Đăng nhập đã ẩn.
 */
export default function RegisterScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen header={<AppHeader title="Đăng ký tài khoản" />}>
        <View style={styles.box}>
          <View style={styles.icon}>
            <UserPlus size={28} color={colors.primary} />
          </View>
          <Text variant="heading" style={styles.center}>
            Tài khoản do quản trị cấp
          </Text>
          <Text variant="body" color="textSecondary" style={styles.center}>
            Vui lòng liên hệ quản trị viên công ty để được tạo tài khoản đăng nhập (nội bộ hoặc đại lý).
          </Text>
        </View>
        <Button title="Về đăng nhập" size="lg" onPress={() => router.back()} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
  icon: { width: 64, height: 64, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySubtle },
  center: { textAlign: "center" },
});
