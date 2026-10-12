import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LogOut, Mail, Phone, Smartphone, UserPlus, UserRound, UserX } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ContactPicker } from "@/components/chat/ContactPicker";
import { loadChatMe } from "@/components/chat/useChat";
import {
  AppHeader, Avatar, BottomActionBar, Button, Card, ErrorState, Screen, SkeletonDetail, Text, confirm, useToast,
} from "@/components/ui";
import { detailTitle, NGUON_LABEL, type ChatContact, type ChatConversationDetail, type ChatMe, type ChatMember } from "@/lib/chat";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { colors, elevation, radius, space } from "@/theme";

const ROLE_LABEL: Record<string, string> = { owner: "Trưởng nhóm", admin: "Quản trị", member: "" };

/**
 * Thành viên / thông tin cuộc trò chuyện (nhóm hoặc khách). Quyền theo _chat_can (server kiểm lại):
 * nhóm – thêm / xoá người khi mình là owner/admin (không xoá owner); hội thoại khách – thành viên thêm được NV xử lý,
 * chỉ xoá người thêm tay (`nguon_them = thu_cong`); ai cũng rời được (owner rời → server chuyển owner).
 */
export default function ChatMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = String(groupId);
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState<ChatMe | null>(null);
  const [d, setD] = useState<ChatConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, detail] = await Promise.all([loadChatMe(), ChatService.conversationGet(id)]);
      setMe(m);
      setD(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thông tin");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

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

  const c = d?.conversation;
  const customer = c?.loai === "customer";
  const myRole = d?.me?.vai_tro ?? null;
  const isMember = !!d?.me;
  const canManage = isMember && (customer || myRole === "owner" || myRole === "admin");
  const canRemove = (m: ChatMember) =>
    canManage && m.employee_id !== me?.employee_id && (customer ? m.nguon_them === "thu_cong" : m.vai_tro !== "owner");

  const remove = async (m: ChatMember) => {
    if (!(await confirm({ title: `Xoá ${m.ho_ten} khỏi cuộc trò chuyện?`, confirmText: "Xoá", destructive: true }))) return;
    await run(async () => {
      setD(await ChatService.membersRemove(id, [m.employee_id]));
      toast.show({ type: "success", message: `Đã xoá ${m.ho_ten}` });
    });
  };

  const leave = async () => {
    if (!(await confirm({ title: "Rời cuộc trò chuyện?", message: "Bạn sẽ không nhận tin nhắn mới của cuộc trò chuyện này.", confirmText: "Rời", destructive: true }))) return;
    await run(async () => {
      await ChatService.leave(id);
      toast.show({ type: "success", message: "Đã rời cuộc trò chuyện" });
      router.dismissTo("/chat");
    });
  };

  const addPicked = () => run(async () => {
    setD(await ChatService.membersAdd(id, [...picked]));
    toast.show({ type: "success", message: `Đã thêm ${picked.size} người` });
    setPicked(new Set());
    setAdding(false);
  });

  const toggle = (ct: ChatContact) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(ct.employee_id)) next.delete(ct.employee_id);
      else next.add(ct.employee_id);
      return next;
    });

  if (adding && me && d) {
    return (
      <Screen
        header={<AppHeader variant="soft" title={customer ? "Thêm nhân viên xử lý" : "Thêm thành viên"} onBack={() => setAdding(false)} />}
        footer={
          <BottomActionBar>
            <Button title={picked.size ? `Thêm ${picked.size} người` : "Chọn người để thêm"} onPress={() => void addPicked()} disabled={!picked.size} loading={busy} fullWidth />
          </BottomActionBar>
        }
        scroll={false}
        padded={false}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ContactPicker me={me} selected={picked} onToggle={toggle} excludeIds={d.members.map((m) => m.employee_id)} />
      </Screen>
    );
  }

  const title = customer ? "Thông tin hội thoại" : "Thành viên nhóm";
  const header = <AppHeader variant="soft" title={title} subtitle={d && me ? detailTitle(d, me.employee_id) : undefined} />;
  if (error && !d) {
    return (
      <Screen header={header} scroll={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState description={error} onRetry={() => void load()} />
      </Screen>
    );
  }
  if (!d || !me) {
    return (
      <Screen header={header} scroll={false} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <SkeletonDetail />
      </Screen>
    );
  }

  const ct = d.contact;
  const kenh = c?.kenh ?? ct?.nguon ?? "";

  return (
    <Screen header={header} scroll={false} padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        {customer && ct ? (
          <Card style={styles.card}>
            <View style={styles.contactHead}>
              <Avatar name={ct.ho_ten || "Khách"} size={56} round />
              <View style={styles.flex}>
                <Text variant="heading" numberOfLines={2}>
                  {ct.ho_ten || "Khách vãng lai"}
                </Text>
                <View style={styles.kenhRow}>
                  {kenh === "app" ? <Smartphone size={14} color={colors.success} /> : null}
                  <Text variant="caption" color="textSecondary">
                    {NGUON_LABEL[kenh] ?? kenh}
                  </Text>
                </View>
              </View>
            </View>
            {ct.customer ? (
              <InfoRow icon={<UserRound size={18} color={colors.textSecondary} />} label="Hồ sơ khách hàng"
                value={[ct.customer.ten_kh, ct.customer.ma_so_kh].filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/customer/[id]", params: { id: ct.customer!.id } })} />
            ) : null}
            {ct.dien_thoai ? <InfoRow icon={<Phone size={18} color={colors.textSecondary} />} label="Điện thoại" value={ct.dien_thoai} /> : null}
            {ct.email ? <InfoRow icon={<Mail size={18} color={colors.textSecondary} />} label="Email" value={ct.email} /> : null}
          </Card>
        ) : null}

        <View style={styles.sectionHead}>
          <Text variant="heading">{customer ? "Nhân viên xử lý" : "Thành viên"}</Text>
          <Text variant="caption" color="textTertiary">
            {d.members.length}
          </Text>
        </View>
        <Card style={styles.list}>
          {d.members.length === 0 ? (
            <Text variant="caption" color="textSecondary">
              Chưa có nhân viên nào tham gia.
            </Text>
          ) : (
            d.members.map((m, i) => {
              const role = customer ? (m.nguon_them === "tiep_nhan" ? "Tiếp nhận" : "") : ROLE_LABEL[m.vai_tro];
              return (
                <View key={m.employee_id} style={[styles.member, i > 0 && styles.divider]}>
                  <Avatar name={m.ho_ten} uri={m.anh} size={40} round />
                  <View style={styles.flex}>
                    <Text variant="subhead" numberOfLines={1}>
                      {m.ho_ten}
                      {m.employee_id === me.employee_id ? <Text variant="caption" color="textTertiary"> · bạn</Text> : null}
                    </Text>
                    {role || m.is_dai_ly ? (
                      <Text variant="label" color="textTertiary">
                        {[role, m.is_dai_ly ? "Đại lý" : ""].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  {canRemove(m) ? (
                    <Pressable onPress={() => void remove(m)} accessibilityRole="button" accessibilityLabel={`Xoá ${m.ho_ten}`} style={styles.iconBtn}>
                      <UserX size={20} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>

        {canManage ? (
          <Button title={customer ? "Thêm nhân viên xử lý" : "Thêm thành viên"} icon={UserPlus} variant="secondary" onPress={() => setAdding(true)} fullWidth />
        ) : null}
        {isMember ? (
          <Button title="Rời cuộc trò chuyện" icon={LogOut} variant="ghost" onPress={() => void leave()} loading={busy} fullWidth />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value: string; onPress?: () => void }) {
  const body = (
    <View style={styles.info}>
      {icon}
      <View style={styles.flex}>
        <Text variant="label" color="textTertiary">
          {label}
        </Text>
        <Text variant="body" color={onPress ? "primary" : "text"} selectable={!onPress}>
          {value}
        </Text>
      </View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}: ${value}`}>
      {body}
    </Pressable>
  ) : body;
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md, paddingBottom: space.x4 },
  card: { gap: space.md, borderRadius: radius.xxl, ...elevation.soft },
  contactHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  kenhRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  info: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: space.sm },
  list: { borderRadius: radius.xxl, ...elevation.soft },
  member: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
