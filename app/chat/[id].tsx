import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { CheckCircle2, Copy, LogIn, Pencil, Reply, RotateCcw, Smartphone, Undo2, Users } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { useActiveChat } from "@/components/chat/ChatNotifier";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MessageRow } from "@/components/chat/MessageRow";
import { useChatThread, useChatTyping } from "@/components/chat/useChat";
import { AppHeader, BottomSheet, Button, ErrorState, IconButton, Screen, SheetOption, Skeleton, Text, confirm, useToast } from "@/components/ui";
import { canJoinCustomer, canModifyMessage, chatRows, detailTitle, NGUON_LABEL, type ChatMessage, type ChatRow } from "@/lib/chat";
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
  useActiveChat(id ? String(id) : null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const pendingAction = useRef<null | (() => void)>(null);

  const d = t.detail;
  const me = t.me;
  const c = d?.conversation;
  const isMember = !!d?.me;
  const customer = c?.loai === "customer";
  const joinable = !!me && !!c && !isMember && canJoinCustomer(me, c);
  const typing = useChatTyping(String(id), me?.employee_id, customer ? d?.contact?.channel_key : null, !!d && isMember);
  const typingNames = typing.typingIds.map((w) => (w === "visitor" ? "Khách" : d?.members.find((m) => m.employee_id === w)?.ho_ten ?? "Ai đó"));
  const mentionable = useMemo(
    () => (c && c.loai !== "direct" ? (d?.members ?? []).filter((m) => m.employee_id !== me?.employee_id).map((m) => ({ id: m.employee_id, ten: m.ho_ten, anh: m.anh })) : []),
    [c, d?.members, me?.employee_id],
  );

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
            <IconButton
              icon={Users}
              variant="soft"
              accessibilityLabel={customer ? "Thông tin khách và nhân viên xử lý" : c.loai === "group" ? "Thành viên nhóm" : "Thông tin cuộc trò chuyện"}
              onPress={() => router.push({ pathname: "/chat/manage-members/[groupId]", params: { groupId: String(id) } })}
            />
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
        meId={me?.employee_id ?? ""}
        customer={c?.loai === "customer"}
        onRetry={(mid) => void t.retry(mid).then((err) => err && toast.show({ type: "error", message: err }))}
        onDiscard={t.discard}
        onLongPress={isMember ? setActionMsg : undefined}
      />
    ),
    [c?.loai, isMember, me?.employee_id, nameOf, t, toast],
  );

  // Thao tác trên tin (nhấn giữ) – như menu web MessageItem: Trả lời · Sao chép · Sửa · Thu hồi (tin của mình ≤ 24 giờ).
  const mod = actionMsg && me ? canModifyMessage(actionMsg, me.employee_id) : { edit: false, recall: false };
  const doAction = (fn: () => void) => {
    pendingAction.current = fn;
    setActionMsg(null);
  };
  const recallMsg = async (m: ChatMessage) => {
    if (!(await confirm({ title: "Thu hồi tin nhắn?", message: "Mọi người trong cuộc trò chuyện sẽ thấy tin đã được thu hồi.", confirmText: "Thu hồi", destructive: true }))) return;
    await run(async () => {
      await t.recall(m.id);
      toast.show({ type: "success", message: "Đã thu hồi tin nhắn" });
    });
  };

  let footer: React.ReactNode = null;
  if (d && me) {
    if (isMember) {
      footer = (
        <View>
          {typingNames.length ? (
            <Text variant="label" color="textTertiary" style={styles.typing} accessibilityLiveRegion="polite">
              {typingNames.join(", ")} đang gõ…
            </Text>
          ) : null}
          <ChatComposer
            onSend={(text, files, mentions) => {
              const r = replyTo;
              setReplyTo(null);
              return t.send(text, files, { replyTo: r, mentions });
            }}
            replyTo={replyTo ? { name: replyTo.sender?.ten ?? (replyTo.sender_type === "contact" ? "Khách hàng" : null), text: replyTo.noi_dung } : null}
            onCancelReply={() => setReplyTo(null)}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onSubmitEdit={async (mid, text) => {
              try {
                await t.edit(mid, text);
                return null;
              } catch (e) {
                return e instanceof Error ? e.message : "Không sửa được tin nhắn";
              }
            }}
            members={mentionable}
            onTyping={typing.ping}
          />
        </View>
      );
    }
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
        <>
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
        <BottomSheet
          visible={!!actionMsg}
          onClose={() => setActionMsg(null)}
          onClosed={() => {
            const fn = pendingAction.current;
            pendingAction.current = null;
            fn?.();
          }}
          title="Tin nhắn"
        >
          {actionMsg && !actionMsg.recalled_at ? (
            <SheetOption icon={Reply} label="Trả lời" onPress={() => { const m = actionMsg; doAction(() => { setEditing(null); setReplyTo(m); }); }} />
          ) : null}
          {actionMsg?.noi_dung && !actionMsg.recalled_at ? (
            <SheetOption icon={Copy} label="Sao chép" onPress={() => {
              const text = actionMsg.noi_dung ?? "";
              doAction(() => void Clipboard.setStringAsync(text).then(() => toast.show({ type: "success", message: "Đã sao chép" })));
            }} />
          ) : null}
          {mod.edit ? (
            <SheetOption icon={Pencil} label="Sửa" onPress={() => { const m = actionMsg!; doAction(() => { setReplyTo(null); setEditing({ id: m.id, text: m.noi_dung ?? "" }); }); }} />
          ) : null}
          {mod.recall ? (
            <SheetOption icon={Undo2} label="Thu hồi" destructive onPress={() => { const m = actionMsg!; doAction(() => void recallMsg(m)); }} />
          ) : null}
        </BottomSheet>
        </>
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
  typing: { paddingHorizontal: space.xl, paddingBottom: space.xs },
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
