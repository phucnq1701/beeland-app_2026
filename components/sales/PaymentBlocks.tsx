import React from "react";
import { StyleSheet, View } from "react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { Badge, MoneyText, Text } from "@/components/ui";
import { formatDate, formatVND } from "@/lib/format";
import { ScheduleRow } from "@/lib/paymentMath";
import { colors, elevation, radius, space } from "@/theme";
import { Receipt } from "@/services/PaymentProgressService";


/**
 * Tổng quan tiền của một phiếu (card navy): giá trị, đã thu, còn lại (+ tiền cọc nếu có).
 * `children` đặt ở đầu card (tên khách, trạng thái).
 */
export function MoneySummary({
  value,
  paid,
  deposit,
  focus = "contract",
  children,
}: {
  value: number | null | undefined;
  paid: number | null | undefined;
  deposit?: number | null;
  /** "deposit" (màn Đặt cọc): số chính = tiền cọc, Đã nộp / Còn phải nộp theo tiền cọc, giá căn chỉ để tham khảo */
  focus?: "contract" | "deposit";
  children?: React.ReactNode;
}) {
  if (focus === "deposit") {
    const d = Number(deposit) || 0;
    const p = Number(paid) || 0;
    const r = d > 0 ? Math.min(1, Math.max(0, p / d)) : 0;
    return (
      <View style={styles.hero}>
        {children}
        <Text variant="caption" color={colors.showcase.textMuted}>
          Tiền cọc
        </Text>
        <MoneyText value={d} variant="title" color={colors.showcase.text} style={styles.heroValue} />
        <View style={styles.bar} accessibilityLabel={`Đã nộp ${Math.round(r * 100)}% tiền cọc`}>
          <View style={[styles.fill, { width: `${r * 100}%` }]} />
        </View>
        <View style={styles.row2}>
          <View style={styles.flex}>
            <Text variant="caption" color={colors.showcase.textMuted}>
              Đã nộp
            </Text>
            <MoneyText value={p} variant="subhead" color={colors.successSubtle} />
          </View>
          <View style={[styles.flex, styles.right]}>
            <Text variant="caption" color={colors.showcase.textMuted}>
              Còn phải nộp
            </Text>
            <MoneyText value={Math.max(d - p, 0)} variant="subhead" color={colors.showcase.text} />
          </View>
        </View>
        {value != null ? (
          <View style={styles.depositRow}>
            <Text variant="caption" color={colors.showcase.textMuted} style={styles.flex}>
              Giá căn (gồm VAT)
            </Text>
            <MoneyText value={Number(value) || 0} variant="subhead" color={colors.showcase.text} />
          </View>
        ) : null}
      </View>
    );
  }
  const v = Number(value) || 0;
  const p = Number(paid) || 0;
  const ratio = v > 0 ? Math.min(1, Math.max(0, p / v)) : 0;
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

/** Hạn đã qua (trước hôm nay) */
function isPastDue(d: unknown): boolean {
  if (!d) return false;
  const t = new Date(String(d));
  if (Number.isNaN(t.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t.getTime() < today.getTime();
}

/**
 * Lịch thanh toán từng đợt – số liệu lấy nguyên từ máy chủ (PaymentProgressService.getSchedule).
 * Mỗi đợt 1 khối gọn: tên + số phải thu; dòng dưới: hạn (đỏ "Quá hạn" khi qua hạn còn nợ, + đã thu nếu thu dở) và Đã đủ / Còn X.
 */
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
            const owed = r.ConLai;
            const owedPbt = r.ConNoPBT;
            const late = owed + owedPbt > 0 && isPastDue(r.NgayTT);
            const partial = owed > 0 && r.DaThu > 0;
            return (
              <View key={`${r.DotTT}-${i}`} style={[styles.item, i < rows.length - 1 ? styles.divider : null]}>
                <View style={styles.itemHead}>
                  <Text variant="subhead" style={styles.flex} numberOfLines={2}>
                    {r.DotTTText || `Đợt ${r.DotTT}`}
                    {r.TyLeTT ? ` · ${r.TyLeTT}%` : ""}
                  </Text>
                  <MoneyText value={r.PhaiThu} variant="subhead" />
                </View>
                <View style={styles.itemHead}>
                  <Text variant="caption" color={late ? "danger" : "textSecondary"} style={styles.flex} numberOfLines={2}>
                    {r.NgayTT ? `${late ? "Quá hạn" : "Hạn"} ${formatDate(r.NgayTT)}` : "Chưa có hạn"}
                    {partial ? ` · đã thu ${formatVND(r.DaThu)}` : ""}
                  </Text>
                  {owed > 0 ? (
                    <Text variant="caption" weight="semibold" color={late ? "danger" : "warning"}>
                      Còn {formatVND(owed)}
                    </Text>
                  ) : (
                    <Badge label="Đã đủ" tone="success" />
                  )}
                </View>
                {r.PhaiThuPBT ? (
                  <View style={styles.itemHead}>
                    <Text variant="caption" color="textSecondary" style={styles.flex}>
                      Phí bảo trì {formatVND(r.PhaiThuPBT)}
                    </Text>
                    <Text variant="caption" weight="semibold" color={owedPbt > 0 ? (late ? "danger" : "warning") : "success"}>
                      {owedPbt > 0 ? `Còn ${formatVND(owedPbt)}` : "Đã đủ"}
                    </Text>
                  </View>
                ) : null}
                {r.DienGiai ? (
                  <Text variant="caption" color="textTertiary" numberOfLines={2}>
                    {r.DienGiai}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </>
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
  item: { paddingHorizontal: space.lg + 2, paddingVertical: space.md + 2, gap: space.xs },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { padding: space.lg },
});
