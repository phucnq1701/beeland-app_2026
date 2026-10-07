import React from "react";
import { StyleSheet, View } from "react-native";
import { Lock } from "lucide-react-native";

import { Text } from "@/components/ui";
import { colors, radius, space } from "@/theme";

/**
 * Ô chỉ đọc cho nội dung KHÁCH gửi (yêu cầu từ app / web khách hàng): cùng khung với ô nhập `soft`
 * nhưng có biểu tượng khoá, không bấm được – giữ nguyên những gì khách gửi.
 */
export function LockedValue({ label, value, placeholder = "—" }: { label: string; value: string; placeholder?: string }) {
  return (
    <View style={styles.container} accessible accessibilityLabel={`${label}: ${value || placeholder}, khách gửi, không sửa được`}>
      <Text variant="caption" weight="semibold">
        {label}
      </Text>
      <View style={styles.box}>
        <Text variant="body" color={value ? "text" : "textTertiary"} style={styles.value}>
          {value || placeholder}
        </Text>
        <Lock size={16} color={colors.textTertiary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs + 2 },
  box: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  value: { flex: 1 },
});
