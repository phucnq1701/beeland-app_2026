import { AlertTriangle, CheckCircle2, Clock, LucideIcon } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { Card, Text } from "@/components/ui";
import { formatDateTime, formatVND } from "@/lib/format";
import { colors, space } from "@/theme";

type Tone = "success" | "danger" | "neutral";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSubtle, fg: colors.success },
  danger: { bg: colors.dangerSubtle, fg: colors.danger },
  neutral: { bg: colors.surfaceMuted, fg: colors.textTertiary },
};

function ResultCard({ icon: Icon, tone, title, lines }: { icon: LucideIcon; tone: Tone; title: string; lines: string[] }) {
  const t = TONE[tone];
  return (
    <Card>
      <View style={styles.wrap} accessible accessibilityLiveRegion="polite" accessibilityLabel={[title, ...lines].join(". ")}>
        <View style={[styles.icon, { backgroundColor: t.bg }]}>
          <Icon size={32} color={t.fg} />
        </View>
        <Text variant="heading" align="center">
          {title}
        </Text>
        {lines.map((l) => (
          <Text key={l} variant="caption" color="textSecondary" align="center">
            {l}
          </Text>
        ))}
      </View>
    </Card>
  );
}

/** Trạng thái "Đã nhận tiền" ngay trên màn QR (thay Alert). */
export function QrPaid({ amount, paidAt, bookingCode }: { amount: unknown; paidAt?: string | null; bookingCode: string }) {
  const lines = [paidAt ? `Lúc ${formatDateTime(paidAt)}` : null, bookingCode ? `Booking ${bookingCode}` : null].filter(
    (x): x is string => !!x
  );
  return <ResultCard icon={CheckCircle2} tone="success" title={`Đã nhận ${formatVND(amount)}`} lines={lines} />;
}

/** hadQr: booking từng có mã QR (đã bị huỷ khi hết hạn). */
export function QrExpired({ hadQr }: { hadQr: boolean }) {
  return (
    <ResultCard
      icon={AlertTriangle}
      tone="danger"
      title="Hết thời gian giữ chỗ"
      lines={[
        hadQr
          ? "Mã QR đã bị huỷ. Căn có thể đã được mở bán lại."
          : "Không thể thu tiền cho booking này nữa. Căn có thể đã được mở bán lại.",
      ]}
    />
  );
}

export function QrNoDeadline() {
  return (
    <ResultCard
      icon={Clock}
      tone="neutral"
      title="Booking chưa có hạn giữ chỗ"
      lines={["Không thể tạo mã QR cho booking này."]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.xs, paddingVertical: space.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
});
