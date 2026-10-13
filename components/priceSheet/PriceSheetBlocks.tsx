import React from "react";
import { StyleSheet, View } from "react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { KeyValueRow, MoneyText, Text } from "@/components/ui";
import { formatDate, formatVND } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";

const pct = (n: any) => {
  const v = Number(n) || 0;
  return `${Number(v.toFixed(2))}%`;
};

/** Thẻ navy đầu phiếu: tổng giá trị HĐMB sau CK, giá niêm yết, chiết khấu */
export function PriceHero({
  total,
  listed,
  discount,
  discountPercent,
  children,
}: {
  total: number | null | undefined;
  listed: number | null | undefined;
  discount: number | null | undefined;
  discountPercent?: number | null;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.hero}>
      {children}
      <Text variant="caption" color={colors.showcase.textMuted}>
        Tổng giá trị HĐMB (gồm VAT, KPBT)
      </Text>
      <MoneyText value={Number(total) || 0} variant="title" color={colors.showcase.text} style={styles.heroValue} />
      <View style={styles.row2}>
        <View style={styles.flex}>
          <Text variant="caption" color={colors.showcase.textMuted}>
            Giá niêm yết
          </Text>
          <MoneyText value={Number(listed) || 0} variant="subhead" color={colors.showcase.text} />
        </View>
        <View style={[styles.flex, styles.right]}>
          <Text variant="caption" color={colors.showcase.textMuted}>
            Chiết khấu{discountPercent ? ` (${pct(discountPercent)})` : ""}
          </Text>
          <MoneyText value={Number(discount) || 0} variant="subhead" color={colors.successSubtle} />
        </View>
      </View>
    </View>
  );
}

/** Khối tiêu đề + thẻ trắng các dòng nhãn – giá trị (bỏ dòng rỗng) */
export function InfoCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!visible.length) return null;
  return (
    <>
      <HomeSectionHeader title={title} />
      <View style={styles.card}>
        <View style={styles.rows}>
          {visible.map(([label, v], i) => (
            <KeyValueRow key={label} label={label} value={v} last={i === visible.length - 1} />
          ))}
        </View>
      </View>
    </>
  );
}

export function money(v: any): string | null {
  return v === null || v === undefined || v === "" ? null : formatVND(Number(v) || 0);
}

/** Bảng chiết khấu đã áp (tên, tỷ lệ, số tiền) */
export function DiscountList({ items }: { items: { name: string; rate?: number | null; amount?: number | null }[] }) {
  return (
    <>
      <HomeSectionHeader title="Chiết khấu" />
      <View style={styles.card}>
        {items.length === 0 ? (
          <Text variant="caption" color="textSecondary" style={styles.empty}>
            Không áp dụng chiết khấu.
          </Text>
        ) : (
          items.map((d, i) => (
            <View key={`${d.name}-${i}`} style={[styles.line, i < items.length - 1 ? styles.divider : null]}>
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={2}>
                  {d.name || `Chiết khấu ${i + 1}`}
                </Text>
                {d.rate ? (
                  <Text variant="caption" color="textSecondary">
                    {pct(d.rate)}
                  </Text>
                ) : null}
              </View>
              <MoneyText value={Number(d.amount) || 0} variant="subhead" color="success" />
            </View>
          ))
        )}
      </View>
    </>
  );
}

export type ScheduleItem = {
  name: string;
  ratio?: number | null;
  dueDate?: string | null;
  base?: number | null;
  vat?: number | null;
  maintenance?: number | null;
  total?: number | null;
};

/** Lịch thanh toán (đủ số đồng – quy tắc bảng tiền) */
export function ScheduleList({ items, emptyText }: { items: ScheduleItem[]; emptyText?: string }) {
  const sum = items.reduce((s, r) => s + (Number(r.total) || 0), 0);
  return (
    <>
      <HomeSectionHeader title="Lịch thanh toán" />
      <View style={styles.card}>
        {items.length === 0 ? (
          <Text variant="caption" color="textSecondary" style={styles.empty}>
            {emptyText || "Chưa có lịch thanh toán."}
          </Text>
        ) : (
          <>
            {items.map((r, i) => (
              <View key={`${r.name}-${i}`} style={[styles.item, styles.divider]}>
                <View style={styles.line0}>
                  <Text variant="subhead" style={styles.flex} numberOfLines={1}>
                    {r.name}
                    {r.ratio ? ` · ${pct(r.ratio)}` : ""}
                  </Text>
                  <MoneyText value={Number(r.total) || 0} variant="subhead" />
                </View>
                <Text variant="caption" color="textSecondary">
                  {r.dueDate ? `Hạn ${formatDate(r.dueDate)}` : "Hạn tính từ ngày ký"}
                  {r.vat ? ` · VAT ${formatVND(r.vat)}` : ""}
                  {r.maintenance ? ` · KPBT ${formatVND(r.maintenance)}` : ""}
                </Text>
              </View>
            ))}
            <View style={[styles.item, styles.line0]}>
              <Text variant="subhead" style={styles.flex}>
                Tổng cộng
              </Text>
              <MoneyText value={sum} variant="subhead" weight="bold" />
            </View>
          </>
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
  row2: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  rows: { paddingHorizontal: space.lg + 2 },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg + 2, paddingVertical: space.md },
  line0: { flexDirection: "row", alignItems: "center", gap: space.md },
  item: { paddingHorizontal: space.lg + 2, paddingVertical: space.md, gap: 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { padding: space.lg },
});
