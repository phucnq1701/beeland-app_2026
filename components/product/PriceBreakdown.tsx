import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { KeyValueRow, MoneyText, Text } from "@/components/ui";
import { formatArea, formatVND } from "@/lib/format";
import type { ActivePriceListItem } from "@/sevicesSupabase/PriceServices";
import { colors, radius, space } from "@/theme";

type Props = {
  /** Giá theo bảng giá đang hiệu lực; null → dùng giá trên sản phẩm. */
  activePrice: ActivePriceListItem | null;
  /** Dữ liệu sản phẩm (fallback). */
  data: any;
  loading: boolean;
};

/** Số tiền luôn hiển thị (null/sai → 0 như bản cũ khi có bảng giá). */
const money0 = (v: unknown) => formatVND(Number(v) || 0);

function Total({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.total}>
      <Text variant="subhead" color="onPrimarySubtle">
        {label}
      </Text>
      <MoneyText value={value} variant="subhead" color="onPrimarySubtle" />
    </View>
  );
}

/** Chi tiết giá sản phẩm: theo bảng giá nếu có, không thì theo dữ liệu sản phẩm. */
export function PriceBreakdown({ activePrice, data, loading }: Props) {
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="caption" color="textSecondary">
          Đang tải bảng giá...
        </Text>
      </View>
    );
  }

  if (activePrice) {
    const p: any = activePrice;
    return (
      <View style={styles.gap}>
        <View>
          <KeyValueRow label="Diện tích thông thủy" value={formatArea(Number(p.area) || 0)} />
          <KeyValueRow label="Đơn giá chưa VAT" value={money0(p.unit_price)} />
          <KeyValueRow label="Tổng giá chưa VAT" value={money0(p.total_before_vat)} />
          <KeyValueRow label="Tiền VAT" value={money0(p.vat_amount)} />
          <KeyValueRow label="Tổng giá gồm VAT" value={money0(p.total_after_vat)} />
          <KeyValueRow label="Phí bảo trì" value={money0(p.maintenance_amount)} />
          <KeyValueRow label="Tổng giá gồm PBT" value={money0(p.total_payment)} last />
        </View>
        <Total label="Tổng giá trị HĐMB" value={Number(p.contract_total_value) || 0} />
        <Text variant="caption" color="textSecondary">
          Ghi chú: {p.note || "—"}
        </Text>
      </View>
    );
  }

  // Chưa có bảng giá áp dụng → giá trên sản phẩm (giữ tương thích bản cũ)
  return (
    <View style={styles.gap}>
      <View>
        {Number(data?.DTThongThuy) > 0 ? (
          <KeyValueRow label="Diện tích thông thủy" value={formatArea(data?.DTThongThuy)} />
        ) : null}
        <KeyValueRow label="Tổng giá gồm VAT" value={formatVND(data?.TongGiaGomVAT)} />
        <KeyValueRow label="Tiền VAT" value={formatVND(data?.TienVAT)} />
        <KeyValueRow label="Phí bảo trì" value={formatVND(data?.PhiBaoTri)} last />
      </View>
      <Total label="Tổng giá trị HĐ" value={data?.TongGiaTriHDMB} />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
});
