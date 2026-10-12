import { Stack, useRouter } from "expo-router";
import { UsersRound } from "lucide-react-native";
import React, { useRef } from "react";

import { ContactPicker } from "@/components/chat/ContactPicker";
import { useChatSession } from "@/components/chat/useChat";
import { AppHeader, ErrorState, IconButton, Screen, SkeletonList, useToast } from "@/components/ui";
import type { ChatContact } from "@/lib/chat";
import { ChatService } from "@/sevicesSupabase/ChatService";

/**
 * Nhắn tin mới: chọn một đồng nghiệp trong danh bạ chat → `fn_chat_direct_open` (lấy hoặc tạo hội thoại 1-1) → mở chat.
 * Web: components/Chat/ContactPicker.tsx + ChatService.directOpen.
 */
export default function NewChatScreen() {
  const router = useRouter();
  const toast = useToast();
  const session = useChatSession();
  const opening = useRef(false);

  const open = async (c: ChatContact) => {
    if (opening.current) return;
    opening.current = true;
    try {
      const d = await ChatService.directOpen(c.employee_id);
      router.replace({ pathname: "/chat/[id]", params: { id: d.conversation.id } });
    } catch (e) {
      toast.show({ type: "error", message: e instanceof Error ? e.message : "Không mở được cuộc trò chuyện" });
    } finally {
      opening.current = false;
    }
  };

  const header = (
    <AppHeader
      variant="soft"
      title="Nhắn tin mới"
      actions={<IconButton icon={UsersRound} variant="soft" accessibilityLabel="Tạo nhóm" onPress={() => router.replace("/chat/create-group")} />}
    />
  );

  return (
    <Screen header={header} scroll={false} padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      {session.me ? (
        <ContactPicker me={session.me} onToggle={(c) => void open(c)} />
      ) : session.error ? (
        <ErrorState description={session.error} onRetry={session.retry} />
      ) : (
        <SkeletonList count={6} />
      )}
    </Screen>
  );
}
