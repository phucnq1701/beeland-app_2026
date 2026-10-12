import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { BellOff, ClipboardList, Link2, LogOut, Mail, Phone, Pin, Plus, Smartphone, Unlink, UserPlus, UserRound, UserX, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";

import { ContactPicker } from "@/components/chat/ContactPicker";
import { CustomerLinkSheet } from "@/components/chat/CustomerLinkSheet";
import { loadChatMe } from "@/components/chat/useChat";
import {
  AppHeader, Avatar, BottomActionBar, Button, Card, ErrorState, Screen, SkeletonDetail, Text, confirm, useFontsLoaded, useToast,
} from "@/components/ui";
import { addTag, CHAT_TAG_LEN, CHAT_TAGS_MAX, detailTitle, NGUON_LABEL, type ChatContact, type ChatConversationDetail, type ChatMe, type ChatMember } from "@/lib/chat";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { colors, elevation, fontStyleFor, MAX_FONT_SCALE, radius, space } from "@/theme";

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
  const [linking, setLinking] = useState(false);
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const fontsLoaded = useFontsLoaded();

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

  const setPref = (patch: { pinned?: boolean; muted?: boolean }) => run(async () => {
    setD(await ChatService.pref(id, patch));
  });
  const saveTags = (tags: string[]) => run(async () => {
    setD(await ChatService.customerTags(id, tags));
  });
  const commitTag = () => {
    const v = tagDraft ?? "";
    setTagDraft(null);
    const next = addTag(c?.tags ?? [], v);
    if (next) void saveTags(next);
  };
  const unlink = async () => {
    if (!(await confirm({ title: "Bỏ gắn hồ sơ khách hàng?", confirmText: "Bỏ gắn", destructive: true }))) return;
    await run(async () => {
      setD(await ChatService.customerLink(id, null));
      toast.show({ type: "success", message: "Đã bỏ gắn hồ sơ khách hàng" });
    });
  };
  const requestInfo = () => run(async () => {
    await ChatService.requestInfo(id);
    toast.show({ type: "success", message: "Đã gửi yêu cầu khách để lại thông tin" });
  });

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
              <View style={styles.linkRow}>
                <View style={styles.flex}>
                  <InfoRow icon={<UserRound size={18} color={colors.textSecondary} />} label="Hồ sơ khách hàng"
                    value={[ct.customer.ten_kh, ct.customer.ma_so_kh].filter(Boolean).join(" · ")}
                    onPress={() => router.push({ pathname: "/customer/[id]", params: { id: ct.customer!.id } })} />
                </View>
                {isMember && kenh !== "app" ? (
                  <Pressable onPress={() => void unlink()} accessibilityRole="button" accessibilityLabel="Bỏ gắn hồ sơ khách hàng" style={styles.iconBtn}>
                    <Unlink size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            ) : isMember ? (
              <Button title="Gắn hồ sơ khách hàng" icon={Link2} variant="secondary" onPress={() => setLinking(true)} fullWidth />
            ) : (
              <Text variant="caption" color="textTertiary">Chưa gắn hồ sơ khách hàng</Text>
            )}
            {ct.dien_thoai ? <InfoRow icon={<Phone size={18} color={colors.textSecondary} />} label="Điện thoại" value={ct.dien_thoai} /> : null}
            {ct.email ? <InfoRow icon={<Mail size={18} color={colors.textSecondary} />} label="Email" value={ct.email} /> : null}
            {isMember && !ct.dien_thoai && !ct.email ? (
              <Button title="Xin thông tin liên hệ của khách" icon={ClipboardList} variant="ghost" onPress={() => void requestInfo()} loading={busy} fullWidth />
            ) : null}
          </Card>
        ) : null}

        {customer && c ? (
          <>
            <View style={styles.sectionHead}>
              <Text variant="heading">Nhãn</Text>
            </View>
            <Card style={styles.card}>
              <View style={styles.tags}>
                {(c.tags ?? []).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text variant="caption" numberOfLines={1} style={styles.tagText}>{tag}</Text>
                    {isMember ? (
                      <Pressable onPress={() => void saveTags(c.tags.filter((x) => x !== tag))} accessibilityRole="button" accessibilityLabel={`Bỏ nhãn ${tag}`} hitSlop={8} style={styles.tagX}>
                        <X size={12} color={colors.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {!c.tags?.length && !isMember ? <Text variant="caption" color="textTertiary">Chưa có nhãn</Text> : null}
                {isMember && (c.tags?.length ?? 0) < CHAT_TAGS_MAX ? (
                  tagDraft !== null ? (
                    <TextInput
                      autoFocus
                      value={tagDraft}
                      onChangeText={setTagDraft}
                      onSubmitEditing={commitTag}
                      onBlur={commitTag}
                      maxLength={CHAT_TAG_LEN}
                      placeholder="Tên nhãn"
                      placeholderTextColor={colors.textTertiary}
                      accessibilityLabel="Tên nhãn mới"
                      returnKeyType="done"
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[styles.tagInput, fontStyleFor("regular", fontsLoaded)]}
                    />
                  ) : (
                    <Pressable onPress={() => setTagDraft("")} accessibilityRole="button" accessibilityLabel="Thêm nhãn" style={[styles.tag, styles.tagAdd]}>
                      <Plus size={14} color={colors.primary} />
                      <Text variant="caption" color="primary">Thêm nhãn</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            </Card>
          </>
        ) : null}

        {isMember && d.me ? (
          <Card style={styles.card}>
            <ToggleRow icon={<Pin size={18} color={colors.textSecondary} />} label="Ghim cuộc trò chuyện" value={d.me.pinned} disabled={busy} onChange={(v) => void setPref({ pinned: v })} />
            <ToggleRow icon={<BellOff size={18} color={colors.textSecondary} />} label="Tắt thông báo" value={d.me.muted} disabled={busy} onChange={(v) => void setPref({ muted: v })} />
          </Card>
        ) : null}


        {c?.loai !== "direct" ? (
        <>
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
        </>
        ) : null}
        {canManage && c?.loai !== "direct" ? (
          <Button title={customer ? "Thêm nhân viên xử lý" : "Thêm thành viên"} icon={UserPlus} variant="secondary" onPress={() => setAdding(true)} fullWidth />
        ) : null}
        {isMember && c?.loai !== "direct" ? (
          <Button title="Rời cuộc trò chuyện" icon={LogOut} variant="ghost" onPress={() => void leave()} loading={busy} fullWidth />
        ) : null}
      </ScrollView>
      {customer ? (
        <CustomerLinkSheet
          visible={linking}
          conversationId={id}
          suggestions={d.goi_y_khach_hang ?? []}
          initialQuery={ct?.dien_thoai ?? ct?.ho_ten ?? ""}
          onClose={() => setLinking(false)}
          onLinked={(next) => {
            setLinking(false);
            setD(next);
            toast.show({ type: "success", message: "Đã gắn hồ sơ khách hàng" });
          }}
        />
      ) : null}
    </Screen>
  );
}

function ToggleRow({ icon, label, value, disabled, onChange }: { icon: React.ReactNode; label: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.info}>
      {icon}
      <Text variant="body" style={styles.flex}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
        thumbColor={colors.surface}
      />
    </View>
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
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
  tag: { flexDirection: "row", alignItems: "center", gap: space.xs, height: 32, paddingLeft: space.md, paddingRight: space.sm, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, maxWidth: "100%" },
  tagText: { flexShrink: 1 },
  tagX: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  tagAdd: { backgroundColor: colors.primarySubtle, paddingRight: space.md },
  tagInput: { minWidth: 140, height: 36, paddingHorizontal: space.md, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary, color: colors.text, fontSize: 14 },
});
