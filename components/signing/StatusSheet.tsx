import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { Badge, BottomSheet, Button, Text, TextField } from "@/components/ui";
import { STATUS_OPTIONS, type SigningState } from "@/lib/signing";
import { colors, radius, space } from "@/theme";

/** Cập nhật trạng thái lịch ký + ghi chú – như web SigningStatusModal. */
export function StatusSheet({
  visible,
  initialState,
  initialNote,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initialState: SigningState;
  initialNote: string;
  onClose: () => void;
  /** Ném lỗi để giữ sheet mở */
  onSubmit: (state: SigningState, note: string) => Promise<void>;
}) {
  const [state, setState] = useState<SigningState>(initialState);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setState(initialState);
    setNote(initialNote);
  }, [visible, initialState, initialNote]);

  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await onSubmit(state, note.trim());
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Cập nhật trạng thái">
      <View style={styles.body}>
        {STATUS_OPTIONS.map((o) => {
          const active = o.value === state;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setState(o.value)}
              style={[styles.option, active ? styles.optionActive : null]}
            >
              <Badge label={o.label} tone={o.tone} />
              <View style={styles.flex} />
              {active ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
        <TextField
          variant="soft"
          label="Ghi chú"
          placeholder="Lý do từ chối, thời gian dời lịch…"
          value={note}
          onChangeText={setNote}
          multiline
          style={styles.note}
        />
        <Text variant="caption" color="textTertiary">
          Lịch bị từ chối không còn giữ chỗ trong ca.
        </Text>
        <Button title="Cập nhật" size="lg" loading={saving} onPress={() => void submit()} style={styles.pill} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.md },
  flex: { flex: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  note: { minHeight: 72, textAlignVertical: "top", paddingTop: space.sm },
  pill: { borderRadius: radius.full },
});
