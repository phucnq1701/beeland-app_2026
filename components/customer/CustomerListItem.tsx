import React, { memo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { LucideIcon, MessageCircle, Phone } from "lucide-react-native";

import { Avatar, StatusBadge, Text } from "@/components/ui";
import { maskPhone } from "@/lib/format";
import { colors, elevation, hitSlop, radius, space } from "@/theme";

/** Gọi điện / mở Zalo theo số điện thoại (bỏ ký tự không phải số). */
export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`);
export const openZalo = (phone: string) => Linking.openURL(`https://zalo.me/${phone.replace(/[^0-9]/g, "")}`);

/** Nút tròn nền nhạt theo màu hành động (Gọi xanh lá, Zalo xanh dương). */
function RoundAction({
  icon: Icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: bg }, pressed ? styles.actionPressed : null]}
    >
      <Icon size={18} color={color} strokeWidth={2.2} />
    </Pressable>
  );
}

/**
 * Card khách hàng: tên, mã · loại, SĐT đã che (như danh sách web); cột phải: trạng thái trên, nút Gọi / Zalo dưới.
 * Nhận dữ liệu đã chuẩn hoá bởi CustomerService.getCustomers (normalizeCustomerRow).
 */
function CustomerListItemBase({ item, onPress }: { item: any; onPress: (id: string) => void }) {
  const phone: string = item.diDong || item.dien_thoai || "";
  const isPersonal = item.isPersonal !== false;
  const name = item.tenKH || (isPersonal ? "Chưa có tên" : "Doanh nghiệp");
  const idLine = [item.ma_so_kh, isPersonal ? "Cá nhân" : "Doanh nghiệp"].filter(Boolean).join(" · ");
  const detail = phone ? maskPhone(phone) : item.cccd ? `CCCD ${item.cccd}` : item.taxCode ? `MST ${item.taxCode}` : "";

  return (
    // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Khách hàng ${name}`}
          onPress={() => onPress(String(item.id))}
          style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
        >
          <Avatar name={name} size={44} round />
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
          </View>
        </Pressable>
        {item.status || phone ? (
          // Cột phải: trạng thái trên, nút Gọi / Zalo dưới
          <View style={styles.trailing}>
            {item.status ? (
              <View style={styles.badge}>
                <StatusBadge label={item.status} color={item.statusColor} size="sm" />
              </View>
            ) : null}
            {phone ? (
              <View style={styles.actions}>
                <RoundAction
                  icon={Phone}
                  label={`Gọi ${name}`}
                  color={colors.success}
                  bg={colors.successSubtle}
                  onPress={() => void callPhone(phone)}
                />
                <RoundAction
                  icon={MessageCircle}
                  label={`Nhắn Zalo ${name}`}
                  color={colors.info}
                  bg={colors.infoSubtle}
                  onPress={() => void openZalo(phone)}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const CustomerListItem = memo(CustomerListItemBase);

const styles = StyleSheet.create({
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  // stretch: cột phải cao bằng khối chữ → trạng thái ngang dòng tên, nút ngang dòng cuối
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.xxl,
    overflow: "hidden",
    paddingRight: space.lg,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingLeft: space.lg,
    minHeight: 72,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  texts: { flex: 1, gap: 2 },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.sm,
    marginLeft: space.sm,
    paddingVertical: space.md + 2,
  },
  // Badge sm cao 18, dòng tên cao 22 → lùi 2 cho cùng tâm
  badge: { maxWidth: 140, marginTop: 2 },
  actions: { flexDirection: "row", gap: space.sm },
  action: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  actionPressed: { opacity: 0.6 },
});
