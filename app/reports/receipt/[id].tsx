import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { AppHeader, Badge, ErrorState, KeyValueRow, MoneyText, Screen, SkeletonDetail, Text } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { VoucherDetail } from "@/lib/reportDetail";
import { colors, elevation, radius, space } from "@/theme";
import { ReportService } from "@/sevicesSupabase/ReportService";

/**
 * Chi tiết phiếu thu (mở từ báo cáo Thu tiền) – như web VoucherDetailDrawer:
 * thông tin phiếu + bảng dòng chi tiết (mã SP, đợt, loại thu, nguồn, ngày, tiền, diễn giải).
 */
export default function ReceiptDetailScreen() {
  const { id, soPhieu } = useLocalSearchParams<{ id: string; soPhieu?: string }>();
  const [data, setData] = useState<VoucherDetail | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const res = await ReportService.getVoucher(String(id));
        setData(res.data);
        setError(!!res.error || !res.data);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const header = <AppHeader variant="soft" title="Phiếu thu" subtitle={data?.soPhieu || soPhieu || undefined} />;

  if (loading) {
    return (
      <Screen header={header}>
        <SkeletonDetail />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen header={header}>
        <ErrorState
          description={error ? "Không tải được phiếu thu." : "Không tìm thấy phiếu thu."}
          onRetry={() => void load()}
        />
      </Screen>
    );
  }

  const info: [string, string | null][] = [
    ["Khách hàng", data.tenKH || null],
    ["Điện thoại", data.dienThoai || null],
    ["Người nộp", data.nguoiNop || null],
    ["Dự án", data.tenDA || null],
    ["Địa chỉ", data.diaChi || null],
    ["Chứng từ gốc", data.chungTuGoc || null],
    ["Diễn giải", data.dienGiai || null],
    ["Người nhập", data.nguoiNhap || null],
    ["Ngày nhập", data.ngayNhap ? formatDateTime(data.ngayNhap) : null],
  ];
  const rows = info.filter(([, v]) => v) as [string, string][];

  return (
    <Screen header={header} padded={false} refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.body}>
        {/* Card navy: số tiền thu + ngày + hình thức */}
        <View style={styles.hero}>
          <Text variant="caption" color={colors.showcase.textMuted}>
            Số tiền thu
          </Text>
          <MoneyText value={data.soTien} variant="title" color={colors.showcase.text} style={styles.heroValue} />
          <View style={styles.heroMeta}>
            <Text variant="caption" color={colors.showcase.textMuted} style={styles.flex} numberOfLines={1}>
              {[data.soPhieu, data.ngay ? formatDate(data.ngay) : null].filter(Boolean).join(" · ")}
            </Text>
            {data.hinhThuc ? <Badge label={data.hinhThuc} tone="success" /> : null}
          </View>
        </View>

        {rows.length ? (
          <>
            <HomeSectionHeader title="Thông tin" />
            <View style={[styles.card, styles.rows]}>
              {rows.map(([label, v], i) => (
                <KeyValueRow key={label} label={label} value={v} last={i === rows.length - 1} />
              ))}
            </View>
          </>
        ) : null}

        <HomeSectionHeader title={`Chi tiết thu${data.lines.length ? ` (${data.lines.length})` : ""}`} />
        <View style={styles.card}>
          {data.lines.length === 0 ? (
            <Text variant="caption" color="textSecondary" style={styles.empty}>
              Phiếu chưa có dòng chi tiết.
            </Text>
          ) : (
            data.lines.map((l, i) => (
              <View key={`${l.id}-${i}`} style={[styles.line, i < data.lines.length - 1 ? styles.divider : null]}>
                <View style={styles.lineHead}>
                  <Text variant="subhead" style={styles.flex} numberOfLines={1}>
                    {[l.kyHieu, l.dotTT].filter(Boolean).join(" · ") || l.loai || "—"}
                  </Text>
                  {/* Bảng tiền: hiện đủ số đồng như web */}
                  <MoneyText value={l.soTien} variant="subhead" />
                </View>
                {l.loai || l.nguon ? (
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {[l.loai, l.nguon].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                {l.soGiaoDich || l.ngay ? (
                  <Text variant="caption" color="textTertiary" numberOfLines={1}>
                    {[l.soGiaoDich, l.ngay ? formatDate(l.ngay) : null].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                {l.dienGiai ? (
                  <Text variant="caption" color="textSecondary" numberOfLines={2}>
                    {l.dienGiai}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  flex: { flex: 1 },
  hero: {
    gap: space.xs,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    borderRadius: radius.x3,
    backgroundColor: colors.showcase.bg,
    ...elevation.soft,
  },
  heroValue: { fontSize: 26, lineHeight: 34 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  rows: { paddingHorizontal: space.lg + 2, paddingVertical: space.xs },
  line: { paddingHorizontal: space.lg + 2, paddingVertical: space.md + 2, gap: 2 },
  lineHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { padding: space.lg },
});
