import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { AlertCircle, CheckCheck, Clock, Download, FileText, ImageOff } from "lucide-react-native";
import React, { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar, Skeleton, Text, useToast } from "@/components/ui";
import { formatFileSize, isImageMime, systemText, type ChatAttachment, type ChatRow } from "@/lib/chat";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { colors, elevation, radius, space } from "@/theme";

const IMAGE_W = 200;
const IMAGE_W_SMALL = 120;

async function openAttachment(a: ChatAttachment, onError: (m: string) => void) {
  if (a.id.startsWith("local-")) return onError("Tệp đang được gửi");
  try {
    await WebBrowser.openBrowserAsync(await ChatService.fileUrl(a.id));
  } catch (e) {
    onError(e instanceof Error ? e.message : "Không mở được tệp");
  }
}

function ChatImage({ a, small, onError }: { a: ChatAttachment; small: boolean; onError: (m: string) => void }) {
  const [uri, setUri] = useState<string | null>(a.local_uri ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (a.local_uri || a.id.startsWith("local-")) return;
    let alive = true;
    ChatService.fileUrl(a.id).then((u) => alive && setUri(u)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [a.id, a.local_uri]);
  const w = small ? IMAGE_W_SMALL : IMAGE_W;
  const ratio = a.rong && a.cao ? a.cao / a.rong : 0.75;
  const h = Math.round(Math.min(Math.max(w * ratio, w * 0.5), w * 1.4));
  return (
    <Pressable
      onPress={() => void openAttachment(a, onError)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Xem ảnh ${a.ten_tep}`}
      style={[styles.imageBox, { width: w, height: h }]}
    >
      {uri && !failed ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" onError={() => setFailed(true)} />
      ) : failed ? (
        <View style={styles.imageFallback}>
          <ImageOff size={22} color={colors.textTertiary} />
        </View>
      ) : (
        <Skeleton width={w} height={h} radius={radius.lg} />
      )}
    </Pressable>
  );
}

function ChatFile({ a, mine, onError }: { a: ChatAttachment; mine: boolean; onError: (m: string) => void }) {
  return (
    <Pressable
      onPress={() => void openAttachment(a, onError)}
      accessibilityRole="button"
      accessibilityLabel={`Mở tệp ${a.ten_tep}`}
      style={({ pressed }) => [styles.file, mine ? styles.fileMine : styles.fileOther, pressed && styles.pressed]}
    >
      <View style={styles.fileIcon}>
        <FileText size={18} color={colors.primary} />
      </View>
      <View style={styles.fileText}>
        <Text variant="caption" weight="medium" numberOfLines={1}>
          {a.ten_tep}
        </Text>
        {a.kich_thuoc ? (
          <Text variant="label" color="textTertiary">
            {formatFileSize(a.kich_thuoc)}
          </Text>
        ) : null}
      </View>
      <Download size={16} color={colors.primary} />
    </Pressable>
  );
}

type Props = {
  row: ChatRow;
  /** Hội thoại nhiều người (nhóm / khách) → hiện tên người gửi ở tin đầu cụm. */
  showNames: boolean;
  nameOf: (employeeId: string) => string;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
};

/**
 * Một dòng trong khung chat (kiểu Messenger theo token app): tin của mình bên phải nền cam `primary` chữ trắng; người khác
 * bên trái card trắng bóng nhẹ, avatar ở tin cuối cụm, tên ở tin đầu cụm (nhóm / hội thoại khách). Bo 20, góc phía người gửi
 * thu nhỏ giữa các tin cùng cụm. Tin hệ thống / vạch ngày: chữ nhỏ căn giữa.
 */
export const MessageRow = memo(function MessageRow({ row, showNames, nameOf, onRetry, onDiscard }: Props) {
  const toast = useToast();
  const onError = (message: string) => toast.show({ type: "error", message });

  if (row.type === "day") {
    return (
      <View style={styles.dayWrap}>
        <View style={styles.day}>
          <Text variant="label" color="textSecondary">
            {row.label}
          </Text>
        </View>
      </View>
    );
  }
  if (row.type === "system") {
    return (
      <Text variant="label" color="textTertiary" align="center" style={styles.system}>
        {systemText(row.message, nameOf)}
      </Text>
    );
  }

  const { message: m, mine, first, last, footer } = row;
  const recalled = !!m.recalled_at;
  const images = recalled ? [] : m.attachments.filter((a) => isImageMime(a.mime));
  const files = recalled ? [] : m.attachments.filter((a) => !isImageMime(a.mime));
  const text = recalled ? null : m.noi_dung;
  const customer = m.sender_type === "contact";
  const senderName = m.sender?.ten || (customer ? "Khách hàng" : "Nhân viên");
  const corner = mine
    ? { borderTopRightRadius: first ? radius.xl : radius.sm, borderBottomRightRadius: last ? radius.xl : radius.sm }
    : { borderTopLeftRadius: first ? radius.xl : radius.sm, borderBottomLeftRadius: last ? radius.xl : radius.sm };
  const failed = m.local_status === "failed";

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther, first ? styles.gapCluster : styles.gapTight]}>
      {!mine ? <View style={styles.avatarSlot}>{last ? <Avatar name={senderName} uri={m.sender?.anh} size={32} round /> : null}</View> : null}
      <View style={[styles.col, mine ? styles.colMine : styles.colOther]}>
        {!mine && first && showNames ? (
          <Text variant="label" color="textTertiary" numberOfLines={1} style={styles.sender}>
            {customer ? `${senderName} · Khách hàng` : senderName}
          </Text>
        ) : null}
        {recalled ? (
          <View style={[styles.bubble, styles.recalled, corner]}>
            <Text variant="caption" color="textTertiary" style={styles.italic}>
              Tin nhắn đã được thu hồi
            </Text>
          </View>
        ) : (
          <>
            {images.length ? (
              <View style={[styles.images, mine && styles.imagesMine]}>
                {images.map((a) => (
                  <ChatImage key={a.id} a={a} small={images.length > 1} onError={onError} />
                ))}
              </View>
            ) : null}
            {text || files.length ? (
              <View style={[styles.bubble, mine ? styles.mine : styles.other, corner, failed && styles.failed]}>
                {files.map((a) => (
                  <ChatFile key={a.id} a={a} mine={mine} onError={onError} />
                ))}
                {text ? (
                  <Text variant="body" color={mine ? colors.onPrimary : "text"} selectable>
                    {text}
                    {m.edited_at ? (
                      <Text variant="caption" color={mine ? colors.primarySubtle : "textTertiary"}>
                        {"  "}(đã sửa)
                      </Text>
                    ) : null}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        )}
        {failed ? (
          <View style={styles.failRow}>
            <AlertCircle size={14} color={colors.danger} />
            <Text variant="label" color={colors.danger}>
              Chưa gửi được
            </Text>
            <Pressable onPress={() => onRetry(m.id)} accessibilityRole="button" accessibilityLabel="Gửi lại tin nhắn" style={styles.action}>
              <Text variant="caption" weight="semibold" color="primary">
                Thử lại
              </Text>
            </Pressable>
            <Pressable onPress={() => onDiscard(m.id)} accessibilityRole="button" accessibilityLabel="Xoá tin nhắn chưa gửi" style={styles.action}>
              <Text variant="caption" weight="semibold" color="textSecondary">
                Xoá
              </Text>
            </Pressable>
          </View>
        ) : footer ? (
          <View style={[styles.footer, mine && styles.footerMine]}>
            {m.local_status === "sending" ? <Clock size={12} color={colors.textTertiary} /> : null}
            {footer.endsWith("Đã xem") ? <CheckCheck size={13} color={colors.primary} /> : null}
            <Text variant="label" color="textTertiary" numeric>
              {footer}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dayWrap: { alignItems: "center", marginTop: space.lg, marginBottom: space.xs },
  day: { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.xs },
  system: { marginTop: space.md, paddingHorizontal: space.x3 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  rowMine: { justifyContent: "flex-end", paddingLeft: space.x3 },
  rowOther: { justifyContent: "flex-start", paddingRight: space.x3 },
  gapCluster: { marginTop: space.md },
  gapTight: { marginTop: space.xs },
  avatarSlot: { width: 32, marginBottom: space.xl },
  col: { flexShrink: 1, gap: space.xs },
  colMine: { alignItems: "flex-end" },
  colOther: { alignItems: "flex-start" },
  sender: { paddingHorizontal: space.md },
  bubble: { borderRadius: radius.xl, paddingHorizontal: space.lg, paddingVertical: space.sm + 2, gap: space.sm, flexShrink: 1 },
  mine: { backgroundColor: colors.primary },
  other: { backgroundColor: colors.surface, ...elevation.soft },
  failed: { opacity: 0.75 },
  recalled: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  italic: { fontStyle: "italic" },
  images: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  imagesMine: { justifyContent: "flex-end" },
  imageBox: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceMuted },
  fill: { width: "100%", height: "100%" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  file: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48, padding: space.xs + 2, paddingRight: space.md, borderRadius: radius.lg, maxWidth: 280 },
  fileMine: { backgroundColor: colors.surface },
  fileOther: { backgroundColor: colors.surfaceMuted },
  fileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySubtle },
  fileText: { flexShrink: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  footer: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.xs },
  footerMine: { justifyContent: "flex-end" },
  failRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: space.sm, alignItems: "center", justifyContent: "center" },
});
