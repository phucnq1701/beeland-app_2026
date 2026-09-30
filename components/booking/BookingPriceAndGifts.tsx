import { Gift, Info } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { EmptyState, KeyValueRow, MoneyText, Text } from "@/components/ui";
import { formatArea, formatNumberVN, formatVND } from "@/lib/format";
import { colors, radius, space } from "@/theme";

const PRICE_ROWS: { key: string; label: string; unit?: string }[] = [
  { key: "area", label: "Diện tích thông thủy", unit: "m²" },
  { key: "unit_price_vat", label: "Đơn giá gồm VAT" },
  { key: "total_before_vat", label: "Tổng giá chưa VAT" },
  { key: "vat_amount", label: "Tiền VAT" },
  { key: "maintenance_amount", label: "Phí bảo trì" },
];
const LOW_RISE_ROWS: { key: string; label: string; unit?: string }[] = [
  { key: "land_unit_price", label: "Đơn giá đất" },
  { key: "land_total", label: "Tổng giá đất" },
  { key: "area_xd", label: "Diện tích xây dựng", unit: "m²" },
  { key: "construction_unit_price", label: "Đơn giá xây dựng" },
  { key: "total_after_vat", label: "Tổng giá sau VAT" },
];

/** Diện tích qua formatArea ("73,9 m²"); tiền dùng formatVND. */
function formatValue(value: unknown, unit?: string): string {
  return unit ? formatArea(value) : formatVND(value);
}

export function BookingPrice({
  priceData,
  priceListName,
  fromProduct,
}: {
  priceData: Record<string, any> | null;
  priceListName?: string | null;
  /** Chưa có dòng giá theo bảng giá → đang hiện giá từ sản phẩm. */
  fromProduct: boolean;
}) {
  const lowRise = LOW_RISE_ROWS.filter(
    (row) => priceData?.[row.key] != null && Number(priceData[row.key]) !== 0
  );
  const rows = [...PRICE_ROWS, ...lowRise];

  return (
    <View style={styles.gap}>
      {priceListName ? (
        <Text variant="caption" color="textSecondary">
          {priceListName}
        </Text>
      ) : null}
      {fromProduct ? (
        <View style={styles.notice}>
          <Info size={14} color={colors.onWarningSubtle} />
          <Text variant="caption" color="onWarningSubtle" style={styles.flex}>
            Chưa có dòng giá theo bảng giá đã chọn. Hiển thị giá từ sản phẩm.
          </Text>
        </View>
      ) : null}
      <View>
        {rows.map((row) => (
          <KeyValueRow key={row.key} label={row.label} value={formatValue(priceData?.[row.key], row.unit)} />
        ))}
      </View>
      <View style={styles.total}>
        <Text variant="subhead" color="onPrimarySubtle">
          Tổng giá gồm PBT
        </Text>
        <MoneyText value={priceData?.total_payment} variant="subhead" color="onPrimarySubtle" />
      </View>
    </View>
  );
}

export function BookingGifts({ promotions }: { promotions: any[] | null | undefined }) {
  if (!promotions?.length) {
    return <EmptyState icon={Gift} title="Chưa có quà tặng được chọn" />;
  }
  return (
    <View>
      {promotions.map((p: any, index: number) => (
        <View key={`${p.id ?? "gift"}-${index}`} style={[styles.gift, index > 0 ? styles.divider : null]}>
          <View style={styles.giftIcon}>
            <Gift size={18} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="subhead">{p.tenQuaTang || p.tenKhuyenMai || "Quà tặng"}</Text>
            {p.tenQuaTang && p.tenKhuyenMai ? (
              <Text variant="caption" color="textSecondary">
                {p.tenKhuyenMai}
              </Text>
            ) : null}
            <View style={styles.giftMeta}>
              <Text variant="caption" color="textSecondary">
                SL: {p.soLuong != null ? formatNumberVN(p.soLuong) : "—"}
              </Text>
              <MoneyText value={p.giaTri} variant="caption" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.sm },
  notice: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSubtle,
  },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  gift: { flexDirection: "row", gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  giftIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  giftMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
});
