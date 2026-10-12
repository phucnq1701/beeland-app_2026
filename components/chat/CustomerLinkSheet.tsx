import { UserRound } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { BottomSheet, SearchBar, Text, useToast } from "@/components/ui";
import type { ChatConversationDetail } from "@/lib/chat";
import { maskPhone } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ChatService } from "@/sevicesSupabase/ChatService";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { colors, radius, space } from "@/theme";

type Row = { id: string; ten: string; sub: string };

type Props = {
  visible: boolean;
  conversationId: string;
  /** `goi_y_khach_hang` của fn_chat_conversation_get (≤ 5 hồ sơ khớp SĐT / email). */
  suggestions: { id: string; ten_kh: string; dien_thoai: string | null; email: string | null }[];
  initialQuery: string;
  onClose: () => void;
  onLinked: (d: ChatConversationDetail) => void;
};

/**
 * Gắn hội thoại khách với hồ sơ khách hàng (web beechat/LinkCustomerModal.tsx): gợi ý khớp SĐT / email trước, tìm theo
 * tên / SĐT / mã (CustomerService.getCustomers – cùng nguồn màn Khách hàng) → `fn_chat_customer_link` (server kiểm cùng công ty).
 */
export function CustomerLinkSheet({ visible, conversationId, suggestions, initialQuery, onClose, onLinked }: Props) {
  const toast = useToast();
  const [q, setQ] = useState(initialQuery);
  const dq = useDebouncedValue(q, 300);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (visible) setQ(initialQuery);
  }, [visible, initialQuery]);

  useEffect(() => {
    if (!visible || !dq.trim()) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoading(true);
    CustomerService.getCustomers({ search: dq.trim(), limit: 20 })
      .then((res: any) => {
        if (!alive) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setRows(list.filter((r: any) => r?.id).map((r: any) => ({
          id: String(r.id),
          ten: r.tenKH || r.ten_kh || "Khách hàng",
          sub: [r.ma_so_kh, maskPhone(r.diDong || "")].filter(Boolean).join(" · "),
        })));
      })
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dq, visible]);

  const link = async (r: Row) => {
    if (busy.current) return;
    busy.current = true;
    try {
      onLinked(await ChatService.customerLink(conversationId, r.id));
    } catch (e) {
      toast.show({ type: "error", message: e instanceof Error ? e.message : "Không gắn được khách hàng" });
    } finally {
      busy.current = false;
    }
  };

  const suggested: Row[] = suggestions.map((s) => ({
    id: s.id,
    ten: s.ten_kh,
    sub: [maskPhone(s.dien_thoai || ""), s.email].filter(Boolean).join(" · "),
  }));

  const item = (r: Row) => (
    <Pressable key={r.id} onPress={() => void link(r)} accessibilityRole="button" accessibilityLabel={`Gắn ${r.ten}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <UserRound size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="subhead" numberOfLines={1}>{r.ten}</Text>
        {r.sub ? <Text variant="caption" color="textSecondary" numberOfLines={1}>{r.sub}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Gắn hồ sơ khách hàng" maxHeightRatio={0.85}>
      <View style={styles.body}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Tên, SĐT, mã khách hàng…" variant="soft" />
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {suggested.length ? (
            <>
              <Text variant="label" color="textTertiary" style={styles.head}>GỢI Ý KHỚP SĐT / EMAIL</Text>
              {suggested.map(item)}
            </>
          ) : null}
          {dq.trim() ? <Text variant="label" color="textTertiary" style={styles.head}>KẾT QUẢ TÌM</Text> : null}
          {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : rows.map(item)}
          {!loading && dq.trim() && rows.length === 0 ? (
            <Text variant="caption" color="textSecondary" style={styles.head}>Không tìm thấy khách hàng</Text>
          ) : null}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  list: { maxHeight: 420 },
  head: { marginTop: space.sm, marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.sm, borderRadius: radius.lg },
  pressed: { backgroundColor: colors.surfaceMuted },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySubtle },
  flex: { flex: 1, minWidth: 0 },
  loading: { marginVertical: space.lg },
});
