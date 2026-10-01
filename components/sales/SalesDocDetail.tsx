import React from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { AppHeader, Card, KeyValueRow, Screen, SkeletonDetail, StatusBadge, Text } from "@/components/ui";
import { ScheduleRow } from "@/lib/paymentMath";
import { colors, elevation, radius, space } from "@/theme";
import { Receipt } from "@/sevicesSupabase/PaymentProgressService";

import { MoneySummary, PaymentSchedule, ReceiptList } from "./PaymentBlocks";

/**
 * Khung chi tiết đặt cọc / hợp đồng: đầu phiếu (số, trạng thái, khách), tổng quan tiền, thông tin,
 * lịch thanh toán, phiếu thu. Màn hình chỉ truyền dữ liệu đã lấy từ dịch vụ (không tự tính tiền).
 */
export function SalesDocDetail({
  title,
  docNo,
  status,
  statusColor,
  customer,
  subtitle,
  info,
  value,
  paid,
  deposit,
  schedule,
  scheduleError,
  receipts,
  receiptsTotal,
  receiptsError,
  loading,
  refreshing,
  onRefresh,
}: {
  title: string;
  docNo: string;
  status?: string | null;
  statusColor?: string | null;
  customer: string;
  subtitle?: string;
  info: [string, string | null | undefined][];
  value: number | null | undefined;
  paid: number | null | undefined;
  deposit?: number | null;
  schedule: ScheduleRow[];
  scheduleError?: boolean;
  receipts: Receipt[];
  receiptsTotal: number;
  receiptsError?: boolean;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const rows = info.filter(([, v]) => v != null && String(v).trim() !== "") as [string, string][];
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={<AppHeader variant="soft" title={title} subtitle={docNo || undefined} />}
        padded={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={styles.body}>
          {/* Card navy: khách + trạng thái ở đầu, tiền bên dưới */}
          <MoneySummary value={value} paid={paid} deposit={deposit}>
            <View style={styles.hero}>
              <View style={styles.flex}>
                <Text variant="heading" color={colors.showcase.text} numberOfLines={2} accessibilityRole="header">
                  {customer || "—"}
                </Text>
                {subtitle ? (
                  <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {status ? <StatusBadge label={status} color={statusColor} /> : null}
            </View>
          </MoneySummary>

          {rows.length ? (
            <>
              <HomeSectionHeader title="Thông tin" />
              <Card padding={0} style={styles.card}>
                <View style={styles.rows}>
                  {rows.map(([label, v], i) => (
                    <KeyValueRow key={label} label={label} value={v} last={i === rows.length - 1} />
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {loading ? (
            <SkeletonDetail />
          ) : (
            <>
              <PaymentSchedule rows={schedule} error={scheduleError} />
              <ReceiptList rows={receipts} total={receiptsTotal} error={receiptsError} />
            </>
          )}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginBottom: space.md,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.showcase.surface,
  },
  flex: { flex: 1 },
  card: { borderWidth: 0, borderRadius: radius.xxl, ...elevation.soft },
  rows: { paddingHorizontal: space.lg + 2 },
});
