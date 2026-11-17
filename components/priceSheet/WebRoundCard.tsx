import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";

import { BottomSheet, MoneyText, Text, TextField } from "@/components/ui";
import { formatNumberVN, parseVND } from "@/lib/format";
import {
  isPercentLoai,
  isRoundLocked,
  mergePickedOptions,
  optionValueText,
  sumPicked,
  toPicked,
} from "@/lib/web/components/Products/ContractForm/discountOptions";
import { allocationHint, isOptionHidden, matchOption } from "@/lib/web/components/Products/ContractForm/optionConditions";
import { showsTongCK } from "@/lib/web/components/Products/ContractForm/roundVars";
import { colors, elevation, radius, space } from "@/theme";

/** "2,5" / "2.5" → 2.5; rỗng → 0 (như web parseFloat || 0) */
function parsePercent(text: string): number {
  const n = Number(String(text ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 1 dòng bảng "Chiết khấu áp dụng" của form web (PriceSheetForm + RoundOptionsCell): bật / tắt dòng, CK % / CK tiền (khoá khi dòng
 * có mức chi tiết — isRoundLocked), chọn mức (chỉ 1 mức; mức không thoả điều kiện khoá + lý do; CTBH chỉ thấy mức đã phân bổ).
 * Mọi luật lấy từ module web chép (lib/web); thao tác gọi lại đúng setter / hàm của form web (bên gọi truyền vào).
 */
export function WebRoundCard({
  index,
  round,
  tongCK,
  ctx,
  pending,
  disabled,
  onToggle,
  onPercent,
  onCash,
  onPick,
}: {
  index: number;
  round: any;
  tongCK: number | null | undefined;
  ctx: any;
  pending?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onPercent: (v: number) => void;
  onCash: (v: number) => void;
  onPick: (picked: any[]) => void;
}) {
  const [pctText, setPctText] = useState(String(round.discountPercent || "").replace(".", ","));
  const [cashText, setCashText] = useState(round.tienCK ? formatNumberVN(Math.round(round.tienCK)) : "");
  const [sheet, setSheet] = useState(false);

  // Số do form tính lại (tick mức, đổi chính sách) ⇒ đồng bộ ô nhập
  useEffect(() => {
    setPctText(String(round.discountPercent || "").replace(".", ","));
    setCashText(round.tienCK ? formatNumberVN(Math.round(round.tienCK)) : "");
  }, [round.discountPercent, round.tienCK, round.key]);

  const locked = !round.enabled || isRoundLocked(round) || !!pending || !!disabled;
  const picked: any[] = round.luaChonDaChon ?? [];
  const hasOptions = (round.luaChon?.length ?? 0) > 0 || picked.length > 0;
  const pickedIds = new Set(picked.map((p) => String(p.ID)));
  const policyOpts = new Map<string, any>((round.luaChon ?? []).map((o: any) => [String(o.ID ?? ""), o]));
  const items = mergePickedOptions(round.luaChon, picked).filter(
    (it: any) => pickedIds.has(String(it.ID)) || !isOptionHidden(policyOpts.get(String(it.ID)), ctx)
  );
  const pct = isPercentLoai(round.loai);
  const check = (id: string) => {
    const o = policyOpts.get(id);
    return ctx && o ? matchOption(o, ctx) : ({ ok: true } as any);
  };
  // Chỉ chọn 1 mức: tick mức khác thì thay mức cũ, bỏ tick thì về trống (RoundOptionsCell.toggle)
  const toggle = (item: any, checked: boolean) => {
    onPick(checked ? [toPicked(item)] : picked.filter((p) => String(p.ID) !== String(item.ID)));
  };
  const optLabel = picked.length === 0 ? "Chọn mức" : picked.length === 1 ? picked[0].Ten : `${picked.length} mức`;
  const noItemsText = !ctx?.congTyBanHangId ? "Chọn Công ty bán hàng" : "Chưa phân bổ";

  return (
    <View style={[styles.card, !round.enabled ? styles.off : null]}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="subhead" numberOfLines={2}>
            {index + 1}. {round.name}
          </Text>
          {round.heSo && Number(round.heSo) !== 1 ? (
            <Text variant="caption" color="textSecondary">
              Hệ số {round.heSo}
            </Text>
          ) : null}
          {round.khongTruGiaHD ? (
            <Text variant="caption" color="textSecondary">
              Không trừ giá HĐ: CK tính bằng 0
            </Text>
          ) : null}
        </View>
        <Switch
          value={!!round.enabled}
          onValueChange={() => onToggle()}
          disabled={!!disabled}
          accessibilityLabel={`Áp dụng ${round.name}`}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.surface}
        />
      </View>
      {round.enabled ? (
        <>
          {hasOptions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chi tiết ${round.name}: ${optLabel}`}
              onPress={() => setSheet(true)}
              disabled={!!pending || !!disabled}
              style={({ pressed }) => [styles.opt, pressed ? styles.pressed : null]}
            >
              <View style={styles.flex}>
                <Text variant="caption" color="textSecondary">
                  Chi tiết
                </Text>
                <Text variant="body" numberOfLines={1}>
                  {items.length ? optLabel : noItemsText}
                </Text>
              </View>
              {picked.length ? <Text variant="label">{optionValueText(round.loai, sumPicked(picked, pct))}</Text> : null}
              <ChevronRight size={18} color={colors.textTertiary} />
            </Pressable>
          ) : null}
          <View style={styles.inputs}>
            <TextField
              label="CK %"
              variant="soft"
              keyboardType="decimal-pad"
              value={pctText}
              editable={!locked}
              onChangeText={(t) => {
                setPctText(t);
                onPercent(parsePercent(t));
              }}
              containerStyle={styles.pct}
              suffix={<Text color="textSecondary">%</Text>}
            />
            <TextField
              label="CK tiền"
              variant="soft"
              keyboardType="number-pad"
              value={cashText}
              editable={!locked}
              onChangeText={(t) => {
                const n = parseVND(t) ?? 0;
                setCashText(n ? formatNumberVN(n) : "");
                onCash(n);
              }}
              containerStyle={styles.flex}
              suffix={<Text color="textSecondary">₫</Text>}
            />
          </View>
          <View style={styles.result}>
            <Text variant="caption" color="textSecondary" style={styles.flex}>
              Tổng chiết khấu
            </Text>
            {showsTongCK(!!round.enabled, Number(tongCK) || 0) ? (
              <MoneyText value={Number(tongCK) || 0} variant="subhead" color="success" />
            ) : (
              <Text color="textSecondary">-</Text>
            )}
          </View>
        </>
      ) : null}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title={round.name}>
        <View style={styles.sheet}>
          {items.length === 0 ? (
            <Text color="textSecondary">{noItemsText}</Text>
          ) : (
            items.map((item: any) => {
              const isPicked = pickedIds.has(String(item.ID));
              const m = check(String(item.ID));
              const po = policyOpts.get(String(item.ID));
              const alloc = po ? allocationHint(po, ctx) : "";
              const off = !!pending || !!disabled || (!m.ok && !isPicked);
              return (
                <Pressable
                  key={String(item.ID)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isPicked, disabled: off }}
                  disabled={off}
                  onPress={() => toggle(item, !isPicked)}
                  style={({ pressed }) => [styles.item, !m.ok ? styles.dim : null, pressed ? styles.pressed : null]}
                >
                  <View style={[styles.box, isPicked ? styles.boxOn : null]}>
                    {isPicked ? <Check size={14} color={colors.onPrimary} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text variant="body">
                      {item.Ten}
                      {item.DonViTinh ? ` · ${item.DonViTinh}` : ""} ({optionValueText(round.loai, item.GiaTri)})
                    </Text>
                    {item.stale && !pending ? (
                      <Text variant="caption" color="danger">
                        Đã xóa khỏi chính sách
                      </Text>
                    ) : null}
                    {!m.ok && isPicked ? (
                      <Text variant="caption" color="danger">
                        Không còn phù hợp
                      </Text>
                    ) : null}
                    {alloc ? (
                      <Text variant="caption" color="textSecondary">
                        {alloc}
                      </Text>
                    ) : null}
                    {!m.ok ? (
                      <Text variant="caption" color="textSecondary">
                        {m.reason}
                      </Text>
                    ) : m.info ? (
                      <Text variant="caption" color={m.warn ? "warning" : "textSecondary"}>
                        {m.info}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
          <View style={styles.sum}>
            <Text variant="label">Tổng</Text>
            <Text variant="label">{optionValueText(round.loai, sumPicked(picked, pct))}</Text>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  off: { opacity: 0.7 },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  inputs: { flexDirection: "row", gap: space.sm },
  pct: { width: 110 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  pressed: { opacity: 0.7 },
  result: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  sheet: { gap: space.sm, paddingBottom: space.lg },
  item: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: space.sm, minHeight: 44 },
  dim: { opacity: 0.6 },
  box: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sum: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.sm },
});
