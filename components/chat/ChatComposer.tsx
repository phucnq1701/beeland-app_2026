import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { AtSign, Camera, Check, FileText, FileUp, ImageIcon, Paperclip, Pencil, Reply, SendHorizontal, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, BottomSheet, IconButton, SheetOption, Text, useFontsLoaded, useToast } from "@/components/ui";
import { applyMention, CHAT_FILES_MAX, CHAT_TEXT_MAX, chatFileError, chatFileMime, isImageMime, mentionIds, mentionQuery } from "@/lib/chat";
import { foldVietnamese } from "@/lib/format";
import { colors, elevation, fontStyleFor, MAX_FONT_SCALE, radius, space } from "@/theme";

import type { PickedChatFile } from "./useChat";

type Props = {
  /** Trả lỗi (tiếng Việt) nếu không gửi được; null = đã gửi / đang chờ trong danh sách. `mentions` = id người được @nhắc. */
  onSend: (text: string, files: PickedChatFile[], mentions: string[]) => Promise<string | null>;
  disabled?: boolean;
  /** Đang trả lời tin này (thanh "Đang trả lời …" phía trên, bấm X để bỏ). */
  replyTo?: { name: string | null; text: string | null } | null;
  onCancelReply?: () => void;
  /** Đang sửa tin của mình: ô nhập điền sẵn nội dung cũ, nút gửi = lưu. */
  editing?: { id: string; text: string } | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (id: string, text: string) => Promise<string | null>;
  /** Thành viên để @nhắc (nhóm / hội thoại có ≥ 2 NV khác). */
  members?: { id: string; ten: string; anh?: string | null }[];
  /** Mình đang gõ → báo "đang gõ" cho người khác. */
  onTyping?: () => void;
};

const MAX_INPUT_H = 132;

/**
 * Ô soạn dính đáy: nút đính kèm (chụp ảnh / thư viện / tệp – mở sau khi sheet đóng hẳn, như app/request/form.tsx) · ô nhập
 * viên thuốc nền xám nhạt tự giãn · nút gửi tròn cam. Tệp chờ gửi là hàng thẻ nhỏ phía trên (bỏ từng tệp).
 */
export function ChatComposer({ onSend, disabled, replyTo, onCancelReply, editing, onCancelEdit, onSubmitEdit, members = [], onTyping }: Props) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFontsLoaded();
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedChatFile[]>([]);
  const [sheet, setSheet] = useState(false);
  const [focused, setFocused] = useState(false);
  const pendingPick = useRef<"camera" | "library" | "file" | null>(null);
  const input = useRef<TextInput>(null);
  const [caret, setCaret] = useState(0);
  const picked = useRef<{ id: string; ten: string }[]>([]);
  const savedDraft = useRef<string | null>(null);

  // Bắt đầu sửa: giữ bản nháp đang gõ, điền nội dung tin cũ; thoát sửa: trả bản nháp.
  useEffect(() => {
    if (editing) {
      savedDraft.current = text;
      setText(editing.text);
      setTimeout(() => input.current?.focus(), 50);
    } else if (savedDraft.current !== null) {
      setText(savedDraft.current);
      savedDraft.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);
  useEffect(() => {
    if (replyTo) setTimeout(() => input.current?.focus(), 50);
  }, [replyTo]);

  const q = members.length ? mentionQuery(text.slice(0, caret || text.length)) : null;
  const suggestions = q === null ? [] : members.filter((m) => foldVietnamese(m.ten).includes(foldVietnamese(q))).slice(0, 5);
  const pickMention = (m: { id: string; ten: string }) => {
    setText((t) => applyMention(t, m.ten));
    if (!picked.current.some((x) => x.id === m.id)) picked.current.push({ id: m.id, ten: m.ten });
  };

  const canSend = !disabled && (editing ? text.trim().length > 0 : text.trim().length > 0 || files.length > 0);

  const add = (picked: PickedChatFile[]) => {
    const ok: PickedChatFile[] = [];
    for (const f of picked) {
      const err = chatFileError({ name: f.name, size: f.size, mime: f.mime });
      if (err) toast.show({ type: "error", message: `${f.name}: ${err}` });
      else ok.push({ ...f, mime: chatFileMime(f.name, f.mime) });
    }
    setFiles((cur) => {
      const next = [...cur, ...ok];
      if (next.length > CHAT_FILES_MAX) toast.show({ type: "info", message: `Tối đa ${CHAT_FILES_MAX} tệp mỗi tin` });
      return next.slice(0, CHAT_FILES_MAX);
    });
  };

  const runPick = async (kind: "camera" | "library" | "file") => {
    try {
      if (kind === "file") {
        const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
        if (r.canceled) return;
        add(r.assets.map((a) => ({ uri: a.uri, name: a.name, mime: a.mimeType, size: a.size ?? null })));
        return;
      }
      if (kind === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.show({ type: "error", message: "Cần cấp quyền camera để chụp ảnh" });
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        // iOS: chuyển HEIC sang JPEG để web / app khách hiển thị được
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const r = kind === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: CHAT_FILES_MAX });
      if (r.canceled) return;
      add(r.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName || `anh-${Date.now()}-${i}.jpg`,
        mime: a.mimeType || "image/jpeg",
        size: a.fileSize ?? null,
      })));
    } catch {
      toast.show({ type: "error", message: "Không chọn được tệp" });
    }
  };

  const submit = async () => {
    if (!canSend) return;
    if (text.length > CHAT_TEXT_MAX) return toast.show({ type: "error", message: `Tin nhắn tối đa ${CHAT_TEXT_MAX} ký tự` });
    if (editing) {
      const err = await onSubmitEdit?.(editing.id, text.trim());
      if (err) return toast.show({ type: "error", message: err });
      savedDraft.current = savedDraft.current ?? "";
      onCancelEdit?.();
      return;
    }
    const t = text;
    const f = files;
    const ids = mentionIds(t, picked.current);
    setText("");
    setFiles([]);
    picked.current = [];
    const err = await onSend(t, f, ids);
    if (err) toast.show({ type: "error", message: err });
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      {suggestions.length ? (
        <View style={styles.mentions} accessibilityLabel="Gợi ý nhắc tên">
          {suggestions.map((m) => (
            <Pressable key={m.id} onPress={() => pickMention(m)} accessibilityRole="button" accessibilityLabel={`Nhắc ${m.ten}`}
              style={({ pressed }) => [styles.mentionRow, pressed && styles.mentionPressed]}>
              <Avatar name={m.ten} uri={m.anh} size={32} round />
              <Text variant="body" numberOfLines={1} style={styles.flex}>{m.ten}</Text>
              <AtSign size={16} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {editing || replyTo ? (
        <View style={styles.context}>
          {editing ? <Pencil size={16} color={colors.primary} /> : <Reply size={16} color={colors.primary} />}
          <View style={styles.flex}>
            <Text variant="label" color="primary">
              {editing ? "Đang sửa tin nhắn" : `Đang trả lời ${replyTo?.name ?? "tin nhắn"}`}
            </Text>
            {!editing ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {replyTo?.text || "Tệp đính kèm"}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => (editing ? onCancelEdit?.() : onCancelReply?.())}
            accessibilityRole="button"
            accessibilityLabel={editing ? "Huỷ sửa" : "Bỏ trả lời"}
            style={styles.contextClose}
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {files.length && !editing ? (
        <View style={styles.files} accessibilityLabel={`${files.length} tệp chờ gửi`}>
          {files.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={styles.fileChip}>
              {isImageMime(f.mime) ? (
                <Image source={{ uri: f.uri }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbDoc]}>
                  <FileText size={16} color={colors.primary} />
                </View>
              )}
              <Text variant="label" numberOfLines={1} style={styles.fileName}>
                {f.name}
              </Text>
              <Pressable
                onPress={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Bỏ tệp ${f.name}`}
                hitSlop={8}
                style={styles.remove}
              >
                <X size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <IconButton icon={Paperclip} accessibilityLabel="Đính kèm ảnh hoặc tệp" onPress={() => setSheet(true)} disabled={disabled || !!editing} />
        <View style={[styles.field, focused && styles.fieldFocused]}>
          <TextInput
            value={text}
            ref={input}
            onChangeText={(v) => {
              setText(v);
              if (v.trim()) onTyping?.();
            }}
            onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)}
            placeholder={disabled ? "Tham gia để trả lời" : "Nhập tin nhắn…"}
            placeholderTextColor={colors.textTertiary}
            editable={!disabled}
            multiline
            maxLength={CHAT_TEXT_MAX}
            accessibilityLabel="Nội dung tin nhắn"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[styles.input, fontStyleFor("regular", fontsLoaded)]}
          />
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Lưu tin nhắn đã sửa" : "Gửi tin nhắn"}
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && canSend && styles.sendPressed]}
        >
          {editing ? <Check size={20} color={colors.onPrimary} strokeWidth={2.6} /> : <SendHorizontal size={20} color={colors.onPrimary} strokeWidth={2.2} />}
        </Pressable>
      </View>

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onClosed={() => {
          const k = pendingPick.current;
          pendingPick.current = null;
          if (k) void runPick(k);
        }}
        title="Gửi ảnh hoặc tệp"
      >
        <SheetOption icon={Camera} label="Chụp ảnh" onPress={() => { pendingPick.current = "camera"; setSheet(false); }} />
        <SheetOption icon={ImageIcon} label="Chọn ảnh từ thư viện" onPress={() => { pendingPick.current = "library"; setSheet(false); }} />
        <SheetOption icon={FileUp} label="Chọn tệp (PDF, Word, Excel…)" onPress={() => { pendingPick.current = "file"; setSheet(false); }} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.x3,
    borderTopRightRadius: radius.x3,
    paddingTop: space.md,
    paddingHorizontal: space.md,
    gap: space.sm,
    ...elevation.raised,
  },
  files: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  mentions: { borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, paddingVertical: space.xs },
  mentionRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44, paddingHorizontal: space.md },
  mentionPressed: { backgroundColor: colors.border },
  context: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySubtle,
  },
  contextClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  fileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    maxWidth: 180,
    paddingLeft: space.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  thumb: { width: 36, height: 36, borderRadius: radius.md },
  thumbDoc: { backgroundColor: colors.primarySubtle, alignItems: "center", justifyContent: "center" },
  fileName: { flexShrink: 1 },
  remove: { width: 32, height: 36, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  field: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: space.lg,
  },
  fieldFocused: { backgroundColor: colors.surface, borderColor: colors.primary },
  input: {
    maxHeight: MAX_INPUT_H,
    paddingTop: Platform.OS === "ios" ? space.sm + 2 : space.sm,
    paddingBottom: Platform.OS === "ios" ? space.sm + 2 : space.sm,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendPressed: { backgroundColor: colors.primaryPressed },
  sendDisabled: { opacity: 0.45 },
});
