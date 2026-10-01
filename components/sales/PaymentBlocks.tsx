import React from "react";
import { StyleSheet, View } from "react-native";

import { Card, KeyValueRow, MoneyText, SectionHeader, Text } from "@/components/ui";
import { formatDate, formatVND } from "@/lib/format";
import { ScheduleRow } from "@/lib/paymentMath";
import { colors, radius, space } from "@/theme";
import { Receipt } from "@/sevicesSupabase/PaymentProgressService";


/** Tổng quan tiền của một phiếu: giá trị, đã thu, còn lại (+ tiền cọc nếu có). */
export function MoneySummary({
  value,
  paid,
  deposit,
}: {
  value: number | null | undefined;
  paid: number | null | undefined;
  deposit?: number | null;
}) {
  const v = Number(value) || 0;
  const p = Number(paid) || 0;
  const ratio = v > 0 ? Math.min(1, p / v) : 0;
  return (
    <Card>
      <Text variant="caption" color="textSecondary">
        Giá trị hợp đồng
      </Text>
      <MoneyText value={v} variant="title" />
      <View style={styles.bar} accessibilityLabel={`Đã thu ${Math.round(ratio * 100)}%`}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.row2}>
        <View style={styles.flex}>
          <Text variant="caption" color="textSecondary">
            Đã thu
          </Text>
          <MoneyText value={p} variant="subhead" color="success" />
        </View>
        <View style={[styles.flex, styles.right]}>
          <Text variant="caption" color="textSecondary">
            Còn lại
          </Text>
          <MoneyText value={Math.max(v - p, 0)} variant="subhead" />
        </View>
      </View>
      {deposit != null ? <KeyValueRow label="Tiền cọc" value={formatVND(deposit)} last /> : null}
    </Card>
  );
}

/** Lịch thanh toán từng đợt – số liệu lấy nguyên từ máy chủ (PaymentProgressService.getSchedule). */
export function PaymentSchedule({ rows, error }: { rows: ScheduleRow[]; error?: boolean }) {
  return (
    <>
      <SectionHeader title="Lịch thanh toán" />
      <Card padding={0}>
        {rows.length === 0 ? (
          <Text variant="caption" color="textSecondary" style={styles.empty}>
            {error ? "Không tải được lịch thanh toán." : "Chưa có lịch thanh toán."}
          </Text>
        ) : (
          rows.map((r, i) => {
            const owed = r.ConLai + r.ConNoPBT;
            return (
              <View key={`${r.DotTT}-${i}`} style={[styles.item, i < rows.length - 1 ? styles.divider : null]}>
                <View style={styles.itemHead}>
                  <Text variant="subhead" style={styles.flex} numberOfLines={1}>
                    {r.DotTTText || `Đợt ${r.DotTT}`}
                    {r.TyLeTT ? ` · ${r.TyLeTT}%` : ""}
                  </Text>
                  <Text variant="caption" color={owed > 0 ? "warning" : "success"}>
                    {owed > 0 ? "Còn nợ" : "Đã đủ"}
                  </Text>
                </View>
                <Text variant="caption" color="textSecondary">
                  {r.NgayTT ? `Hạn ${formatDate(r.NgayTT)}` : "Chưa có hạn"}
                  {r.DienGiai ? ` · ${r.DienGiai}` : ""}
                </Text>
                <View style={styles.row3}>
                  <Amount label="Phải thu" value={r.PhaiThu} />
                  <Amount label="Đã thu" value={r.DaThu} />
                  <Amount label="Còn lại" value={r.ConLai} />
                </View>
                {r.PhaiThuPBT ? (
                  <View style={styles.row3}>
                    <Amount label="Phí bảo trì" value={r.PhaiThuPBT} />
                    <Amount label="Đã thu PBT" value={r.DaThuPBT} />
                    <Amount label="Còn PBT" value={r.ConNoPBT} />
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </Card>
    </>
  );
}

function Amount({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.flex}>
      <Text variant="label" color="textTertiary">
        {label}
      </Text>
      {/* Bảng tiền: hiện đủ số đồng, không rút gọn */}
      <MoneyText value={value} variant="caption" />
    </View>
  );
}

/** Phiếu thu của phiếu – số tiền là phần thuộc phiếu này (như tab Phiếu thu web). */
export function ReceiptList({ rows, total, error }: { rows: Receipt[]; total: number; error?: boolean }) {
  return (
    <>
      <SectionHeader title={`Phiếu thu${rows.length ? ` · ${formatVND(total)}` : ""}`} />
      <Card padding={0}>
        {error ? (
          <Text variant="caption" color="danger" style={styles.empty}>
            Không tải được phiếu thu. Kéo xuống để thử lại.
          </Text>
        ) : rows.length === 0 ? (
          <Text variant="caption" color="textSecondary" style={styles.empty}>
            Chưa có phiếu thu.
          </Text>
        ) : (
          rows.map((r, i) => (
            <View key={`${r.id}-${i}`} style={[styles.item, i < rows.length - 1 ? styles.divider : null]}>
              <View style={styles.itemHead}>
                <Text variant="subhead" style={styles.flex} numberOfLines={1}>
                  {r.soPhieu || "—"}
                </Text>
                <MoneyText value={r.soTien} variant="subhead" />
              </View>
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {[r.ngay ? formatDate(r.ngay) : null, r.hinhThuc, r.dienGiai].filter(Boolean).join(" · ")}
              </Text>
              {r.tongPhieu > r.soTien ? (
                <Text variant="label" color="textTertiary">
                  Cả phiếu {formatVND(r.tongPhieu)} – phần cho phiếu này {formatVND(r.soTien)}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  right: { alignItems: "flex-end" },
  bar: { height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, overflow: "hidden", marginVertical: space.sm },
  fill: { height: "100%", backgroundColor: colors.success },
  row2: { flexDirection: "row", gap: space.md, marginBottom: space.xs },
  row3: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  item: { padding: space.lg, gap: 2 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { padding: space.lg },
});
