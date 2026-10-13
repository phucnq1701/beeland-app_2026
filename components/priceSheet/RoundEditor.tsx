import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { MoneyText, Text, TextField } from "@/components/ui";
import { formatNumberVN, parseVND } from "@/lib/format";
import type { PolicyDiscountRound } from "@/lib/priceSheetFormulas";
import { colors, elevation, radius, space } from "@/theme";

/** "2,5" / "2.5" → 2.5; rỗng → 0 */
function parsePercent(text: string): number {
  const n = Number(String(text ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 1 vòng chiết khấu theo chính sách (bảng "Chiết khấu áp dụng" của web): bật/tắt, % CK, CK tiền mặt;
 * hệ số theo chính sách (chỉ hiện). Kết quả vòng = roundResults[i] của lib/priceSheetCalc.
 */
export function RoundEditor({
  index,
  round,
  result,
  isLowRise,
  onChange,
}: {
  index: number;
  round: PolicyDiscountRound;
  result: any;
  isLowRise: boolean;
  onChange: (patch: Partial<PolicyDiscountRound>) => void;
}) {
  const [pctText, setPctText] = useState(String(round.discountPercent || "").replace(".", ","));
  const [cashText, setCashText] = useState(round.tienCK ? formatNumberVN(round.tienCK) : "");

  // Đổi chính sách → vòng mới: đồng bộ lại ô nhập
  useEffect(() => {
    setPctText(String(round.discountPercent || "").replace(".", ","));
    setCashText(round.tienCK ? formatNumberVN(round.tienCK) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.key]);

  const after = isLowRise ? result?.tongGiaTriHDMB : result?.tongGiaTriHD;
  return (
    <View style={[styles.card, !round.enabled ? styles.off : null]}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="subhead" numberOfLines={2}>
            {index + 1}. {round.name}
          </Text>
          {round.heSo && round.heSo !== 1 ? (
            <Text variant="caption" color="textSecondary">
              Hệ số {round.heSo}
            </Text>
          ) : null}
        </View>
        <Switch
          value={round.enabled}
          onValueChange={(v) => onChange({ enabled: v })}
          accessibilityLabel={`Áp dụng ${round.name}`}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.surface}
        />
      </View>
      {round.enabled ? (
        <>
          <View style={styles.inputs}>
            <TextField
              label="% chiết khấu"
              variant="soft"
              keyboardType="decimal-pad"
              value={pctText}
              onChangeText={(t) => {
                setPctText(t);
                onChange({ discountPercent: parsePercent(t) });
              }}
              containerStyle={styles.pct}
              suffix={<Text color="textSecondary">%</Text>}
            />
            <TextField
              label="CK tiền mặt"
              variant="soft"
              keyboardType="number-pad"
              value={cashText}
              onChangeText={(t) => {
                const n = parseVND(t) ?? 0;
                setCashText(n ? formatNumberVN(n) : "");
                onChange({ tienCK: n });
              }}
              containerStyle={styles.flex}
              suffix={<Text color="textSecondary">₫</Text>}
            />
          </View>
          <View style={styles.result}>
            <View style={styles.flex}>
              <Text variant="caption" color="textSecondary">
                Tiền chiết khấu
              </Text>
              <MoneyText value={Number(result?.tongCK) || 0} variant="subhead" color="success" />
            </View>
            <View style={[styles.flex, styles.right]}>
              <Text variant="caption" color="textSecondary">
                Giá trị sau vòng
              </Text>
              <MoneyText value={Number(after) || 0} variant="subhead" />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  off: { opacity: 0.7 },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  right: { alignItems: "flex-end" },
  inputs: { flexDirection: "row", gap: space.sm },
  pct: { width: 120 },
  result: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
});
