import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, FileText, FileUp, ImageIcon, Paperclip, SendHorizontal, X } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet, IconButton, SheetOption, Text, useFontsLoaded, useToast } from "@/components/ui";
import { CHAT_FILES_MAX, CHAT_TEXT_MAX, chatFileError, chatFileMime, isImageMime } from "@/lib/chat";
import { colors, elevation, fontStyleFor, MAX_FONT_SCALE, radius, space } from "@/theme";

import type { PickedChatFile } from "./useChat";

type Props = {
  /** Trả lỗi (tiếng Việt) nếu không gửi được; null = đã gửi / đang chờ trong danh sách. */
  onSend: (text: string, files: PickedChatFile[]) => Promise<string | null>;
  disabled?: boolean;
};

const MAX_INPUT_H = 132;

/**
 * Ô soạn dính đáy: nút đính kèm (chụp ảnh / thư viện / tệp – mở sau khi sheet đóng hẳn, như app/request/form.tsx) · ô nhập
 * viên thuốc nền xám nhạt tự giãn · nút gửi tròn cam. Tệp chờ gửi là hàng thẻ nhỏ phía trên (bỏ từng tệp).
 */
export function ChatComposer({ onSend, disabled }: Props) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useFontsLoaded();
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedChatFile[]>([]);
  const [sheet, setSheet] = useState(false);
  const [focused, setFocused] = useState(false);
  const pendingPick = useRef<"camera" | "library" | "file" | null>(null);

  const canSend = !disabled && (text.trim().length > 0 || files.length > 0);

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
    const t = text;
    const f = files;
    setText("");
    setFiles([]);
    const err = await onSend(t, f);
    if (err) toast.show({ type: "error", message: err });
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      {files.length ? (
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
        <IconButton icon={Paperclip} accessibilityLabel="Đính kèm ảnh hoặc tệp" onPress={() => setSheet(true)} disabled={disabled} />
        <View style={[styles.field, focused && styles.fieldFocused]}>
          <TextInput
            value={text}
            onChangeText={setText}
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
          accessibilityLabel="Gửi tin nhắn"
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && canSend && styles.sendPressed]}
        >
          <SendHorizontal size={20} color={colors.onPrimary} strokeWidth={2.2} />
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
