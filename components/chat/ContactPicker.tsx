import { Check, SearchX, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Avatar, EmptyState, ErrorState, SearchBar, SegmentedControl, SkeletonList, Text } from "@/components/ui";
import type { ChatContact, ChatMe } from "@/lib/chat";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { colors, elevation, radius, space } from "@/theme";

type Tab = "noi_bo" | "dai_ly";

type Props = {
  me: ChatMe;
  /** Chọn nhiều (tạo nhóm / thêm người) – hiện ô tích; không có → bấm là chọn ngay. */
  selected?: Set<string>;
  onToggle: (c: ChatContact) => void;
  /** Người đã có trong hội thoại – ẩn khỏi danh sách. */
  excludeIds?: string[];
  header?: React.ReactNode;
  bottomInset?: number;
};

/**
 * Danh bạ chat (`fn_chat_danh_ba` – server đã áp luật ai được chat với ai, spec chat 2.2): tab Nội bộ / Đại lý (tab Đại lý
 * chỉ hiện với NV đại lý hoặc NV nội bộ có cờ chat đại lý), tìm theo tên (debounce 300ms). Nguồn web: components/Chat/ContactPicker.tsx.
 */
export function ContactPicker({ me, selected, onToggle, excludeIds, header, bottomInset = 0 }: Props) {
  const showDaiLy = me.is_dai_ly || me.is_chat_dai_ly;
  const [tab, setTab] = useState<Tab>(me.is_dai_ly ? "dai_ly" : "noi_bo");
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<ChatContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Khoá chuỗi ổn định (mảng truyền vào đổi danh tính mỗi lần render).
  const excludeKey = (excludeIds ?? []).join(",");

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    ChatService.danhBa(tab, dq.trim() || undefined)
      .then((r) => {
        const skip = new Set(excludeKey ? excludeKey.split(",") : []);
        if (alive) setRows((r ?? []).filter((c) => c.employee_id !== me.employee_id && !skip.has(c.employee_id)));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Không tải được danh bạ"));
    return () => {
      alive = false;
    };
  }, [tab, dq, me.employee_id, excludeKey, nonce]);

  const top = (
    <View style={styles.top}>
      {header}
      <SearchBar value={q} onChangeText={setQ} placeholder="Tìm nhân viên…" variant="soft" />
      {showDaiLy ? (
        <SegmentedControl
          value={tab}
          variant="soft"
          options={[{ value: "noi_bo", label: "Nội bộ" }, { value: "dai_ly", label: "Đại lý" }]}
          onChange={setTab}
        />
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={rows ?? []}
      keyExtractor={(c) => c.employee_id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.list, { paddingBottom: space.xxl + bottomInset }]}
      ListHeaderComponent={top}
      ListEmptyComponent={
        error ? (
          <ErrorState description={error} onRetry={() => setNonce((n) => n + 1)} />
        ) : rows === null ? (
          <SkeletonList count={5} />
        ) : (
          <EmptyState icon={dq ? SearchX : Users} title={dq ? "Không tìm thấy nhân viên" : "Chưa có ai để nhắn tin"} />
        )
      }
      renderItem={({ item: c }) => {
        const on = !!selected?.has(c.employee_id);
        const sub = [c.chuc_vu, c.phong_ban, c.ten_san].filter(Boolean).join(" · ");
        return (
          <Pressable
            onPress={() => onToggle(c)}
            accessibilityRole={selected ? "checkbox" : "button"}
            accessibilityState={selected ? { checked: on } : undefined}
            accessibilityLabel={[c.ho_ten, sub].filter(Boolean).join(", ")}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Avatar name={c.ho_ten} uri={c.anh} size={44} round />
            <View style={styles.texts}>
              <Text variant="subhead" numberOfLines={1}>
                {c.ho_ten}
              </Text>
              {sub ? (
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {sub}
                </Text>
              ) : null}
            </View>
            {selected ? (
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={16} color={colors.onPrimary} strokeWidth={3} /> : null}</View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl, gap: space.sm },
  top: { gap: space.md, marginBottom: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  pressed: { opacity: 0.85 },
  texts: { flex: 1, minWidth: 0 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
