import React, { memo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { MessageCircle, Phone } from "lucide-react-native";

import { Avatar, IconButton, StatusBadge, Text } from "@/components/ui";
import { maskPhone } from "@/lib/format";
import { colors, space } from "@/theme";

/** Gọi điện / mở Zalo theo số điện thoại (bỏ ký tự không phải số). */
export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`);
export const openZalo = (phone: string) => Linking.openURL(`https://zalo.me/${phone.replace(/[^0-9]/g, "")}`);

/**
 * Một dòng khách hàng: tên, mã · loại, SĐT đã che (như danh sách web), trạng thái; nút Gọi / Zalo.
 * Nhận dữ liệu đã chuẩn hoá bởi CustomerService.getCustomers (normalizeCustomerRow).
 */
function CustomerListItemBase({ item, onPress }: { item: any; onPress: (id: string) => void }) {
  const phone: string = item.diDong || item.dien_thoai || "";
  const isPersonal = item.isPersonal !== false;
  const name = item.tenKH || (isPersonal ? "Chưa có tên" : "Doanh nghiệp");
  const idLine = [item.ma_so_kh, isPersonal ? "Cá nhân" : "Doanh nghiệp"].filter(Boolean).join(" · ");
  const detail = phone ? maskPhone(phone) : item.cccd ? `CCCD ${item.cccd}` : item.taxCode ? `MST ${item.taxCode}` : "";

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Khách hàng ${name}`}
        onPress={() => onPress(String(item.id))}
        style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
      >
        <Avatar name={name} />
        <View style={styles.texts}>
          <Text variant="subhead" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {idLine}
          </Text>
          {detail ? (
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          {item.status ? (
            <View style={styles.badge}>
              <StatusBadge label={item.status} color={item.statusColor} />
            </View>
          ) : null}
        </View>
      </Pressable>
      {phone ? (
        <View style={styles.actions}>
          <IconButton icon={Phone} accessibilityLabel={`Gọi ${name}`} onPress={() => void callPhone(phone)} color={colors.success} />
          <IconButton icon={MessageCircle} accessibilityLabel={`Nhắn Zalo ${name}`} onPress={() => void openZalo(phone)} color={colors.info} />
        </View>
      ) : null}
    </View>
  );
}

export const CustomerListItem = memo(CustomerListItemBase);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingRight: space.sm },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.lg,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  texts: { flex: 1, gap: 2 },
  badge: { flexDirection: "row", marginTop: space.xs },
  actions: { flexDirection: "row" },
});
