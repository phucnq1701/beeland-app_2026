import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, LogIn, RotateCcw, Smartphone, Users } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { ChatComposer } from "@/components/chat/ChatComposer";
import { MessageRow } from "@/components/chat/MessageRow";
import { useChatThread } from "@/components/chat/useChat";
import { AppHeader, Button, ErrorState, IconButton, Screen, Skeleton, Text, confirm, useToast } from "@/components/ui";
import { canJoinCustomer, chatRows, detailTitle, NGUON_LABEL, type ChatRow } from "@/lib/chat";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { colors, radius, space } from "@/theme";

/**
 * Một cuộc trò chuyện (BeeChat khách / nội bộ / đại lý) – cùng RPC web (fn_chat_conversation_get / messages / send / join /
 * customer_status). Hội thoại khách mình chưa là thành viên: chỉ xem + nút "Tham gia" (admin, hoặc kênh app – web
 * pages/customers/quan-ly/beechat/index.tsx). Thành viên hội thoại khách: Đóng / Mở lại ngay trên header.
 */
export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useChatThread(String(id));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const d = t.detail;
  const me = t.me;
  const c = d?.conversation;
  const isMember = !!d?.me;
  const customer = c?.loai === "customer";
  const joinable = !!me && !!c && !isMember && canJoinCustomer(me, c);

  const names = useMemo(() => new Map((d?.members ?? []).map((m) => [m.employee_id, m.ho_ten])), [d?.members]);
  const nameOf = useCallback(
    (eid: string) => (eid === me?.employee_id ? "Bạn" : names.get(eid) ?? "Nhân viên"),
    [me?.employee_id, names],
  );
  // FlatList đảo ngược: dòng mới nhất ở đầu mảng.
  const rows = useMemo(() => (me ? chatRows(t.messages, me.employee_id, t.readAt).reverse() : []), [t.messages, t.readAt, me]);

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.show({ type: "error", message: e instanceof Error ? e.message : "Thao tác thất bại" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const join = () => run(async () => {
    t.setDetail(await ChatService.join(String(id)));
    toast.show({ type: "success", message: "Đã tham gia cuộc trò chuyện" });
  });

  const toggleStatus = async () => {
    if (!c) return;
    const closing = c.trang_thai !== "closed";
    if (closing && !(await confirm({ title: "Đóng hội thoại?", message: "Khách nhắn lại thì hội thoại tự mở lại.", confirmText: "Đóng hội thoại" }))) return;
    await run(async () => {
      t.setDetail(await ChatService.customerStatus(String(id), closing ? "closed" : "open"));
      toast.show({ type: "success", message: closing ? "Đã đóng hội thoại" : "Đã mở lại hội thoại" });
    });
  };

  const kenh = c?.kenh ?? d?.contact?.nguon ?? "";
  const subtitle = !c
    ? undefined
    : customer
      ? [NGUON_LABEL[kenh] ?? kenh, c.trang_thai === "closed" ? "Đã đóng" : "Đang mở"].filter(Boolean).join(" · ")
      : c.loai === "group"
        ? `${d?.members.length ?? 0} thành viên`
        : undefined;

  const header = (
    <AppHeader
      variant="soft"
      title={d && me ? detailTitle(d, me.employee_id) : "Tin nhắn"}
      subtitle={subtitle}
      actions={
        c ? (
          <View style={styles.actions}>
            {customer && isMember ? (
              <IconButton
                icon={c.trang_thai === "closed" ? RotateCcw : CheckCircle2}
                variant="soft"
                accessibilityLabel={c.trang_thai === "closed" ? "Mở lại hội thoại" : "Đóng hội thoại"}
                onPress={() => void toggleStatus()}
                disabled={busy}
              />
            ) : null}
            {c.loai !== "direct" ? (
              <IconButton
                icon={Users}
                variant="soft"
                accessibilityLabel={customer ? "Thông tin khách và nhân viên xử lý" : "Thành viên nhóm"}
                onPress={() => router.push({ pathname: "/chat/manage-members/[groupId]", params: { groupId: String(id) } })}
              />
            ) : null}
          </View>
        ) : null
      }
    />
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => (
      <MessageRow
        row={item}
        showNames={c?.loai !== "direct"}
        nameOf={nameOf}
        onRetry={(mid) => void t.retry(mid).then((err) => err && toast.show({ type: "error", message: err }))}
        onDiscard={t.discard}
      />
    ),
    [c?.loai, nameOf, t, toast],
  );

  let footer: React.ReactNode = null;
  if (d && me) {
    if (isMember) footer = <ChatComposer onSend={t.send} />;
    else if (joinable) {
      footer = (
        <View style={styles.joinBar}>
          <Text variant="caption" color="textSecondary" align="center">
            {kenh === "app" ? "Khách nhắn từ app khách hàng. Tham gia để trả lời." : "Bạn đang xem hội thoại chưa tham gia."}
          </Text>
          <Button title="Tham gia để trả lời" icon={LogIn} onPress={() => void join()} loading={busy} fullWidth />
        </View>
      );
    } else {
      footer = (
        <View style={styles.joinBar}>
          <Text variant="caption" color="textSecondary" align="center">
            Bạn không còn trong cuộc trò chuyện này.
          </Text>
        </View>
      );
    }
  }

  return (
    <Screen header={header} footer={footer} scroll={false} padded={false} keyboardAware>
      <Stack.Screen options={{ headerShown: false }} />
      {t.loading ? (
        <View style={styles.skeleton}>
          <Skeleton width="62%" height={56} radius={radius.xl} />
          <Skeleton width="48%" height={44} radius={radius.xl} style={styles.skelMine} />
          <Skeleton width="70%" height={64} radius={radius.xl} />
        </View>
      ) : t.error && !d ? (
        <ErrorState description={t.error} onRetry={() => void t.reload()} />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          onEndReached={() => void t.loadOlder()}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
          ListFooterComponent={
            t.loadingOlder ? (
              <ActivityIndicator color={colors.primary} style={styles.older} />
            ) : customer && !t.hasMore && kenh === "app" ? (
              <View style={styles.channelNote}>
                <Smartphone size={14} color={colors.success} />
                <Text variant="label" color="textSecondary">
                  Khách nhắn từ app khách hàng
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingVertical: space.md },
  skeleton: { gap: space.md, padding: space.lg },
  skelMine: { alignSelf: "flex-end" },
  older: { marginVertical: space.md },
  channelNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, marginTop: space.sm },
  joinBar: {
    gap: space.sm,
    padding: space.lg,
    paddingBottom: space.x3,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.x3,
    borderTopRightRadius: radius.x3,
  },
});
