import { Stack, useRouter } from "expo-router";
import { MessageCirclePlus, MessagesSquare, SearchX, UsersRound } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { ConversationRow } from "@/components/chat/ConversationRow";
import { useChatInbox, useChatSession } from "@/components/chat/useChat";
import {
  AppHeader, EmptyState, ErrorState, IconButton, Screen, SearchBar, SegmentedControl, SkeletonList,
} from "@/components/ui";
import type { ChatKhu } from "@/lib/chat";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, space } from "@/theme";

/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

const KHU_LABEL: Record<"beechat" | "noi_bo" | "dai_ly", string> = { beechat: "Khách hàng", noi_bo: "Nội bộ", dai_ly: "Đại lý" };
const EMPTY_TEXT: Record<"beechat" | "noi_bo" | "dai_ly", string> = {
  beechat: "Tin nhắn khách gửi từ app khách hàng và widget website sẽ hiện ở đây.",
  noi_bo: "Bấm nút + để nhắn tin cho đồng nghiệp hoặc tạo nhóm.",
  dai_ly: "Trò chuyện với đại lý / sàn sẽ hiện ở đây.",
};

/**
 * Tin nhắn (cùng dữ liệu web: BeeChat khách hàng · Chat nội bộ · Chat đại lý – fn_chat_inbox theo `khu`).
 * Tab Đại lý chỉ hiện với NV nội bộ có cờ chat đại lý; NV đại lý chỉ có Đại lý (hội thoại có NV đại lý luôn mang san_id → khu
 * dai_ly; BeeChat khách chỉ cho nội bộ).
 * Hội thoại khách kênh app: mọi NV có quyền BeeChat đều thấy (server lọc), bấm vào để "Tham gia" rồi trả lời.
 */
export default function ChatInboxScreen({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const session = useChatSession();
  const me = session.me;
  const tabs = (me?.is_dai_ly ? ["dai_ly"] : me?.is_chat_dai_ly ? ["beechat", "noi_bo", "dai_ly"] : ["beechat", "noi_bo"]) as (
    "beechat" | "noi_bo" | "dai_ly"
  )[];
  const [picked, setPicked] = useState<"beechat" | "noi_bo" | "dai_ly" | null>(null);
  const khu: ChatKhu = picked && tabs.includes(picked) ? picked : tabs[0];
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const inbox = useChatInbox(khu, dq, !!me);

  const open = useCallback((id: string) => router.push({ pathname: "/chat/[id]", params: { id } }), [router]);

  const header = (
    <AppHeader
      variant="soft"
      title="Tin nhắn"
      hideBack={embedded}
      actions={
        <View style={styles.actions}>
          <IconButton icon={UsersRound} variant="soft" accessibilityLabel="Tạo nhóm" onPress={() => router.push("/chat/create-group")} />
          <IconButton icon={MessageCirclePlus} variant="soft" accessibilityLabel="Nhắn tin mới" onPress={() => router.push("/contacts")} />
        </View>
      }
    />
  );

  if (session.error && !me) {
    return (
      <Screen header={header} scroll={false} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState description={session.error} onRetry={session.retry} />
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false} padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={inbox.loading ? [] : inbox.items}
        keyExtractor={(it) => it.conversation.id}
        renderItem={({ item }) => <ConversationRow item={item} onPress={open} />}
        contentContainerStyle={[styles.list, embedded && { paddingBottom: TAB_BAR_SPACE + space.lg }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={inbox.refreshing} onRefresh={() => void inbox.refresh()} tintColor={colors.primary} />}
        onEndReached={() => void inbox.loadMore()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.top}>
            <SearchBar value={q} onChangeText={setQ} placeholder="Tìm tên, SĐT, email…" variant="soft" />
            {tabs.length > 1 ? (
              <SegmentedControl
                value={khu as "beechat" | "noi_bo" | "dai_ly"}
                variant="soft"
                options={tabs.map((t) => ({ value: t, label: KHU_LABEL[t] }))}
                onChange={setPicked}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !me || inbox.loading ? (
            <SkeletonList count={6} />
          ) : inbox.error ? (
            <ErrorState description={inbox.error} onRetry={() => void inbox.reload()} />
          ) : dq ? (
            <EmptyState icon={SearchX} title="Không tìm thấy cuộc trò chuyện" actionLabel="Xoá tìm kiếm" onAction={() => setQ("")} />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="Chưa có cuộc trò chuyện"
              description={EMPTY_TEXT[khu as "beechat" | "noi_bo" | "dai_ly"]}
            />
          )
        }
        ListFooterComponent={inbox.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.more} /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: space.sm },
  list: { paddingHorizontal: space.xl, paddingBottom: space.x4, gap: space.md },
  top: { gap: space.md, marginBottom: space.xs },
  more: { marginVertical: space.lg },
});
