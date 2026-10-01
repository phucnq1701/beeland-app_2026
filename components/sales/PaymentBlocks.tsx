import React from "react";
import { StyleSheet, View } from "react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { Badge, MoneyText, Text } from "@/components/ui";
import { formatDate, formatVND } from "@/lib/format";
import { ScheduleRow } from "@/lib/paymentMath";
import { colors, elevation, radius, space } from "@/theme";
import { Receipt } from "@/sevicesSupabase/PaymentProgressService";


/**
 * Tổng quan tiền của một phiếu (card navy): giá trị, đã thu, còn lại (+ tiền cọc nếu có).
 * `children` đặt ở đầu card (tên khách, trạng thái).
 */
export function MoneySummary({
  value,
  paid,
  deposit,
  children,
}: {
  value: number | null | undefined;
  paid: number | null | undefined;
  deposit?: number | null;
  children?: React.ReactNode;
}) {
  const v = Number(value) || 0;
  const p = Number(paid) || 0;
  const ratio = v > 0 ? Math.min(1, p / v) : 0;
  return (
    <View style={styles.hero}>
      {children}
      <Text variant="caption" color={colors.showcase.textMuted}>
        Giá trị hợp đồng
      </Text>
      <MoneyText value={v} variant="title" color={colors.showcase.text} style={styles.heroValue} />
      <View style={styles.bar} accessibilityLabel={`Đã thu ${Math.round(ratio * 100)}%`}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.row2}>
        <View style={styles.flex}>
          <Text variant="caption" color={colors.showcase.textMuted}>
            Đã thu
          </Text>
          <MoneyText value={p} variant="subhead" color={colors.successSubtle} />
        </View>
        <View style={[styles.flex, styles.right]}>
          <Text variant="caption" color={colors.showcase.textMuted}>
            Còn lại
          </Text>
          <MoneyText value={Math.max(v - p, 0)} variant="subhead" color={colors.showcase.text} />
        </View>
      </View>
      {deposit != null ? (
        <View style={styles.depositRow}>
          <Text variant="caption" color={colors.showcase.textMuted} style={styles.flex}>
            Tiền cọc
          </Text>
          <MoneyText value={deposit} variant="subhead" color={colors.showcase.text} />
        </View>
      ) : null}
    </View>
  );
}

/** Lịch thanh toán từng đợt – số liệu lấy nguyên từ máy chủ (PaymentProgressService.getSchedule). */
export function PaymentSchedule({ rows, error }: { rows: ScheduleRow[]; error?: boolean }) {
  return (
    <>
      <HomeSectionHeader title="Lịch thanh toán" />
      <View style={styles.card}>
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
                  <Badge label={owed > 0 ? "Còn nợ" : "Đã đủ"} tone={owed > 0 ? "warning" : "success"} />
                </View>
                <Text variant="caption" color="textSecondary">
                  {r.NgayTT ? `Hạn ${formatDate(r.NgayTT)}` : "Chưa có hạn"}
                  {r.DienGiai ? ` · ${r.DienGiai}` : ""}
                </Text>
                {/* Từng dòng nhãn – số (3 cột ngang làm số đầy đủ bị xuống dòng) */}
                <View style={styles.amounts}>
                  <Amount label="Phải thu" value={r.PhaiThu} />
                  <Amount label="Đã thu" value={r.DaThu} paid />
                  <Amount label="Còn lại" value={r.ConLai} emphasize />
                  {r.PhaiThuPBT ? (
                    <View style={styles.pbt}>
                      <Amount label="Phí bảo trì" value={r.PhaiThuPBT} />
                      <Amount label="Đã thu PBT" value={r.DaThuPBT} paid />
                      <Amount label="Còn PBT" value={r.ConNoPBT} emphasize />
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );
}

/** Một dòng tiền: nhãn trái, số phải. `emphasize` = dòng còn lại (đậm, cam khi còn nợ); `paid` = xanh khi > 0. */
function Amount({ label, value, emphasize, paid }: { label: string; value: number; emphasize?: boolean; paid?: boolean }) {
  const color = emphasize ? (value > 0 ? "warning" : "success") : paid && value > 0 ? "success" : "text";
  return (
    <View style={styles.amountRow}>
      <Text variant="caption" color="textSecondary" weight={emphasize ? "semibold" : undefined} style={styles.flex}>
        {label}
      </Text>
      {/* Bảng tiền: hiện đủ số đồng, không rút gọn */}
      <MoneyText value={value} variant={emphasize ? "subhead" : "caption"} color={color} />
    </View>
  );
}

/** Phiếu thu của phiếu – số tiền là phần thuộc phiếu này (như tab Phiếu thu web). */
export function ReceiptList({ rows, total, error }: { rows: Receipt[]; total: number; error?: boolean }) {
  return (
    <>
      <HomeSectionHeader title={`Phiếu thu${rows.length ? ` · ${formatVND(total)}` : ""}`} />
      <View style={styles.card}>
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  right: { alignItems: "flex-end" },
  hero: {
    gap: space.xs,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    borderRadius: radius.x3,
    backgroundColor: colors.showcase.bg,
    ...elevation.soft,
  },
  heroValue: { fontSize: 26, lineHeight: 34 },
  bar: { height: 8, borderRadius: radius.full, backgroundColor: colors.showcase.surface, overflow: "hidden", marginVertical: space.sm },
  fill: { height: "100%", backgroundColor: colors.success },
  row2: { flexDirection: "row", gap: space.md },
  depositRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.showcase.surface,
  },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  amounts: {
    gap: space.xs + 2,
    marginTop: space.sm + 2,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  pbt: {
    gap: space.xs + 2,
    marginTop: space.xs + 2,
    paddingTop: space.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  item: { paddingHorizontal: space.lg + 2, paddingVertical: space.lg, gap: 2 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { padding: space.lg },
});
