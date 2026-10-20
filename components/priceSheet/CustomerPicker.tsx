import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { UserX } from "lucide-react-native";

import { Avatar, IconButton, SearchBar, Text } from "@/components/ui";
import { maskPhone } from "@/lib/format";
import { customerFromRow, customerLabel, type SheetCustomer } from "@/lib/priceSheetPayload";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { colors, elevation, radius, space } from "@/theme";

/**
 * Chọn khách cho phiếu (không bắt buộc – web không bắt buộc khách ở phiếu tính giá).
 * Tìm khách qua `fn_customer_picker` (CustomerService.pickCustomers) như ô tìm khách của form web (từ khoá ≥ 2 ký tự);
 * tạo khách mới làm ở màn Khách hàng.
 */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: SheetCustomer | null;
  onChange: (c: SheetCustomer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    const q = debounced.trim();
    const v = ++version.current;
    if (!q) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    CustomerService.pickCustomers({ search: q, limit: 10 })
      .then((res: any) => {
        if (v === version.current) setRows(res?.data ?? []);
      })
      .catch(() => {
        if (v === version.current) setRows([]);
      })
      .finally(() => {
        if (v === version.current) setLoading(false);
      });
  }, [debounced]);

  if (value) {
    const { name, phone } = customerLabel(value);
    return (
      <View style={[styles.card, styles.selected]}>
        <Avatar name={name || "?"} size={44} round />
        <View style={styles.flex}>
          <Text variant="subhead" numberOfLines={1}>
            {name || "—"}
          </Text>
          <Text variant="caption" color="textSecondary">
            {[value.IsPersonal ? "Cá nhân" : "Doanh nghiệp", phone ? maskPhone(phone) : null].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <IconButton icon={UserX} accessibilityLabel="Bỏ chọn khách hàng" onPress={() => onChange(null)} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Tìm khách: tên, SĐT, CCCD…" variant="soft" />
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {rows.length ? (
        <View style={styles.card}>
          {rows.map((c, i) => {
            const picked = customerFromRow(c);
            const { name, phone } = customerLabel(picked);
            return (
              <Pressable
                key={`${c.id}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Chọn khách ${name}`}
                onPress={() => {
                  onChange(picked);
                  setQuery("");
                }}
                style={({ pressed }) => [styles.row, i < rows.length - 1 ? styles.divider : null, pressed ? styles.pressed : null]}
              >
                <Avatar name={name || "?"} size={40} round />
                <View style={styles.flex}>
                  <Text variant="subhead" numberOfLines={1}>
                    {name || "—"}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {[c.ma_so_kh, phone ? maskPhone(phone) : null].filter(Boolean).join(" · ") || " "}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : debounced.trim() && !loading ? (
        <Text variant="caption" color="textSecondary">
          {debounced.trim().length < 2 ? "Nhập ít nhất 2 ký tự để tìm khách." : "Không tìm thấy khách hàng."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  flex: { flex: 1 },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft, overflow: "hidden" },
  selected: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
});
