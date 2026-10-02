import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Building2, User } from "lucide-react-native";

import { BottomSheet, Button, SearchBar, Text } from "@/components/ui";
import { type Deposit } from "@/lib/signing";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, radius, space } from "@/theme";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { SigningService } from "@/sevicesSupabase/SigningService";

function Row({
  title,
  sub,
  onPress,
  selected,
}: {
  title: string;
  sub?: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected ? styles.rowActive : null, pressed ? styles.pressed : null]}
    >
      <Text variant="body" weight="semibold" numberOfLines={1}>
        {title}
      </Text>
      {sub ? (
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Status({ loading, empty, text }: { loading: boolean; empty: boolean; text: string }) {
  if (loading) return <ActivityIndicator style={styles.status} color={colors.primary} />;
  if (empty)
    return (
      <Text variant="caption" color="textSecondary" align="center" style={styles.status}>
        {text}
      </Text>
    );
  return null;
}

/** Chọn phiếu đặt cọc (fn_signing_deposit_search) – tìm theo số phiếu / khách hàng / mã căn. */
export function DepositPickerSheet({
  visible,
  projectId,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean;
  projectId: string | null;
  selectedId: string | null;
  onClose: () => void;
  onPick: (d: Deposit) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 400);
  const [list, setList] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const v = ++version.current;
    setLoading(true);
    SigningService.searchDeposits(debounced, projectId)
      .then((r) => v === version.current && setList(r))
      .catch(() => v === version.current && setList([]))
      .finally(() => v === version.current && setLoading(false));
  }, [visible, debounced, projectId]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Chọn phiếu đặt cọc">
      <View style={styles.body}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Số phiếu / khách hàng / mã căn" variant="soft" />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {list.map((d) => (
            <Row
              key={String(d.MaPGC)}
              title={`${d.SoPhieu || "—"}${d.MaCan ? ` · ${d.MaCan}` : ""}`}
              sub={[d.KhachHang, d.TenDA].filter(Boolean).join(" · ")}
              selected={d.MaPGC === selectedId}
              onPress={() => onPick(d)}
            />
          ))}
          <Status loading={loading} empty={!loading && !list.length} text="Không tìm thấy phiếu đặt cọc phù hợp." />
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

export type PickedCustomer = { id: string; name: string; phone: string; idNo: string; isPersonal: boolean };

/** Chọn khách hàng từ danh mục (tên / SĐT / CCCD); có nút thêm khách mới cá nhân / doanh nghiệp. */
export function CustomerPickerSheet({
  visible,
  title,
  excludeIds,
  onClose,
  onPick,
  onAddNew,
}: {
  visible: boolean;
  title: string;
  excludeIds: string[];
  onClose: () => void;
  onPick: (c: PickedCustomer) => void;
  onAddNew: (personal: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 350);
  const [list, setList] = useState<PickedCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const v = ++version.current;
    setLoading(true);
    CustomerService.getCustomers({ search: debounced.trim(), limit: 30 })
      .then((r: any) => {
        if (v !== version.current) return;
        setList(
          (r?.data ?? []).map((c: any) => ({
            id: String(c.id),
            name: c.tenKH || "—",
            phone: c.dien_thoai || "",
            idNo: c.cccd || c.ma_so_thue_ct || "",
            isPersonal: c.is_personal !== false,
          })),
        );
      })
      .catch(() => v === version.current && setList([]))
      .finally(() => v === version.current && setLoading(false));
  }, [visible, debounced]);

  const shown = list.filter((c) => !excludeIds.includes(c.id));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Tên / SĐT / CCCD" variant="soft" />
        <View style={styles.addRow}>
          <Button
            variant="secondary"
            icon={User}
            title="Thêm KH cá nhân"
            onPress={() => onAddNew(true)}
            style={styles.addBtn}
          />
          <Button
            variant="secondary"
            icon={Building2}
            title="Thêm doanh nghiệp"
            onPress={() => onAddNew(false)}
            style={styles.addBtn}
          />
        </View>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {shown.map((c) => (
            <Row
              key={c.id}
              title={c.name}
              sub={[c.isPersonal ? "Cá nhân" : "Doanh nghiệp", c.phone, c.idNo].filter(Boolean).join(" · ")}
              onPress={() => onPick(c)}
            />
          ))}
          <Status loading={loading} empty={!loading && !shown.length} text="Không tìm thấy khách hàng." />
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.md },
  list: { maxHeight: 420 },
  row: { paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.lg, gap: 2 },
  rowActive: { backgroundColor: colors.primarySubtle },
  pressed: { backgroundColor: colors.surfaceMuted },
  status: { paddingVertical: space.xl },
  addRow: { flexDirection: "row", gap: space.sm },
  addBtn: { flex: 1, borderRadius: radius.full },
});
