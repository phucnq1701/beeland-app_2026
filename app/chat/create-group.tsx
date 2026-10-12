import { Stack, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ContactPicker } from "@/components/chat/ContactPicker";
import { useChatSession } from "@/components/chat/useChat";
import {
  AppHeader, BottomActionBar, Button, ErrorState, Screen, SkeletonList, Text, TextField, useToast,
} from "@/components/ui";
import type { ChatContact } from "@/lib/chat";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { space } from "@/theme";

const NAME_MAX = 100;

/**
 * Tạo nhóm: tên + chọn ≥ 2 người → `fn_chat_group_create` (server áp luật một sàn / cờ chat đại lý, trả lỗi tiếng Việt).
 * Web: components/Chat/NewGroupModal.tsx.
 */
export default function CreateGroupScreen() {
  const router = useRouter();
  const toast = useToast();
  const session = useChatSession();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [picked, setPicked] = useState<Map<string, ChatContact>>(new Map());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const toggle = (c: ChatContact) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(c.employee_id)) next.delete(c.employee_id);
      else next.set(c.employee_id, c);
      return next;
    });

  const create = async () => {
    const ten = name.trim();
    if (!ten) return setNameError("Nhập tên nhóm");
    if (picked.size < 2) return toast.show({ type: "info", message: "Chọn ít nhất 2 người để tạo nhóm" });
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const d = await ChatService.groupCreate(ten, [...picked.keys()]);
      toast.show({ type: "success", message: "Đã tạo nhóm" });
      router.replace({ pathname: "/chat/[id]", params: { id: d.conversation.id } });
    } catch (e) {
      toast.show({ type: "error", message: e instanceof Error ? e.message : "Không tạo được nhóm" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const selectedNames = [...picked.values()].map((c) => c.ho_ten).join(", ");

  return (
    <Screen
      header={<AppHeader variant="soft" title="Tạo nhóm" />}
      footer={
        <BottomActionBar>
          <Button title={picked.size ? `Tạo nhóm (${picked.size + 1} người)` : "Tạo nhóm"} onPress={() => void create()} loading={busy} fullWidth />
        </BottomActionBar>
      }
      scroll={false}
      padded={false}
      keyboardAware
    >
      <Stack.Screen options={{ headerShown: false }} />
      {session.me ? (
        <ContactPicker
          me={session.me}
          selected={new Set(picked.keys())}
          onToggle={toggle}
          header={
            <View style={styles.head}>
              <TextField
                label="Tên nhóm"
                value={name}
                onChangeText={(v) => {
                  setName(v.slice(0, NAME_MAX));
                  if (nameError) setNameError(undefined);
                }}
                placeholder="Ví dụ: Dự án A – Kinh doanh"
                error={nameError}
                variant="soft"
              />
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {picked.size ? `Đã chọn: ${selectedNames}` : "Chọn ít nhất 2 người"}
              </Text>
            </View>
          }
        />
      ) : session.error ? (
        <ErrorState description={session.error} onRetry={session.retry} />
      ) : (
        <SkeletonList count={6} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm },
});
