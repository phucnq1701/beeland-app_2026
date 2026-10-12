import { BellOff, Pin, Smartphone, Users } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar, Text } from "@/components/ui";
import { conversationTitle, KENH_LABEL, listTimeLabel, previewText, type ChatInboxItem } from "@/lib/chat";
import { colors, elevation, radius, space } from "@/theme";

type Props = { item: ChatInboxItem; onPress: (id: string) => void };

/**
 * Một hội thoại trong hộp thư (card trắng bo `xxl`, kiểu bo tròn mềm của app): avatar (nhóm = icon), tên + chip kênh khách
 * (App xanh lá như web BeeChat, Web/Zalo/Facebook xám), xem trước, giờ; chưa đọc = tên đậm + chấm cam; hội thoại khách
 * chưa tham gia ghi "Chưa tham gia". Nguồn: web components/Chat/ConversationItem.tsx.
 */
export const ConversationRow = memo(function ConversationRow({ item, onPress }: Props) {
  const c = item.conversation;
  const title = conversationTitle(item);
  const unread = item.unread > 0;
  const customer = c.loai === "customer";
  const kenh = c.kenh ?? item.contact?.nguon ?? "";
  const staff = item.thanh_vien && item.thanh_vien.tong > 0
    ? item.thanh_vien.ten.join(", ") + (item.thanh_vien.tong > item.thanh_vien.ten.length ? ` +${item.thanh_vien.tong - item.thanh_vien.ten.length}` : "")
    : null;
  const flag = customer ? (!item.la_thanh_vien ? "Chưa tham gia" : c.trang_thai === "closed" ? "Đã đóng" : null) : null;
  const photo = c.loai === "direct" ? item.doi_dien?.anh : c.anh_dai_dien;
  const label = [title, customer && kenh ? `kênh ${KENH_LABEL[kenh] ?? kenh}` : null, unread ? `${item.unread} tin chưa đọc` : null]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={() => onPress(c.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        {c.loai === "group" ? (
          <View style={styles.groupAvatar}>
            <Users size={22} color={colors.primary} />
          </View>
        ) : (
          <Avatar name={title} uri={photo} size={44} round />
        )}
        {customer && kenh === "app" ? (
          <View style={styles.appBadge} accessibilityElementsHidden>
            <Smartphone size={10} color={colors.onPrimary} strokeWidth={2.6} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text variant="subhead" weight={unread ? "bold" : "semibold"} numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {customer && kenh ? (
            <View style={[styles.chip, kenh === "app" ? styles.chipApp : styles.chipOther]}>
              <Text variant="label" color={kenh === "app" ? colors.onSuccessSubtle : colors.textSecondary}>
                {KENH_LABEL[kenh] ?? kenh}
              </Text>
            </View>
          ) : null}
          {item.pinned ? <Pin size={13} color={colors.textTertiary} /> : null}
          <Text variant="label" color="textTertiary" numeric style={styles.time}>
            {listTimeLabel(c.last_message_at)}
          </Text>
        </View>
        <View style={styles.bottom}>
          <Text variant="caption" color={unread ? "text" : "textSecondary"} weight={unread ? "medium" : undefined} numberOfLines={1} style={styles.flex}>
            {previewText(c.last_message_preview)}
          </Text>
          {item.muted ? <BellOff size={14} color={colors.textTertiary} /> : unread ? <View style={styles.dot} /> : null}
        </View>
        {flag || staff ? (
          <Text variant="label" color={flag === "Chưa tham gia" ? colors.warning : "textTertiary"} numberOfLines={1}>
            {[flag, staff].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  pressed: { opacity: 0.85 },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  appBadge: {
    position: "absolute",
    left: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: "row", alignItems: "center", gap: space.xs + 2 },
  title: { flexShrink: 1 },
  chip: { paddingHorizontal: space.sm, paddingVertical: 1, borderRadius: radius.full },
  chipApp: { backgroundColor: colors.successSubtle },
  chipOther: { backgroundColor: colors.surfaceMuted },
  time: { marginLeft: "auto" },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
