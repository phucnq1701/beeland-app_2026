import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, Gift, RefreshCw } from "lucide-react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { CustomerPicker } from "@/components/priceSheet/CustomerPicker";
import { InfoCard, money, PriceHero, ScheduleList } from "@/components/priceSheet/PriceSheetBlocks";
import { ProductPicker } from "@/components/priceSheet/ProductPicker";
import { RoundEditor } from "@/components/priceSheet/RoundEditor";
import { usePriceSheetDraft } from "@/components/priceSheet/usePriceSheetDraft";
import {
  AppHeader,
  BottomActionBar,
  Button,
  confirm,
  DateField,
  ErrorState,
  MoneyText,
  ProgressSteps,
  Screen,
  SelectField,
  SkeletonDetail,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { formatArea, formatNumberVN, parseVND } from "@/lib/format";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { dueDateFor } from "@/lib/priceSheetSchedule";
import { colors, elevation, radius, space } from "@/theme";

const STEPS = ["Căn hộ", "Chính sách", "Thanh toán", "Khách & quà"] as const;
const NONE = "__none__";

/**
 * Lập / sửa phiếu tính giá (rút gọn từ form 5 bước của web – beeland/src/components/PriceSheet/PriceSheetForm.tsx):
 * căn + bảng giá → chính sách + vòng chiết khấu → tiến độ thanh toán → khách (không bắt buộc) + quà tặng → lưu.
 * Không có trên app: người đồng sở hữu, ưu đãi lãi suất, 360 khách hàng, sửa tay dòng lịch, tạo từ chứng từ.
 * Params: `productId` (căn có sẵn) hoặc `sheetId` (sửa phiếu nháp đơn giản).
 */
export default function PriceSheetEditorScreen() {
  const router = useRouter();
  const toast = useToast();
  const { productId, sheetId } = useLocalSearchParams<{ productId?: string; sheetId?: string }>();
  const d = usePriceSheetDraft();
  const [step, setStep] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(!!(productId || sheetId));
  const [saving, setSaving] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const savingRef = useRef(false);
  const checkedMismatch = useRef(false);
  const isEdit = !!sheetId;

  const start = async (fn: () => Promise<any>) => {
    setInitError(null);
    setInitializing(true);
    try {
      await fn();
    } catch (e: any) {
      setInitError(e?.message || "Không tải được dữ liệu");
    } finally {
      setInitializing(false);
    }
  };

  const startNewAndWarn = async (id: string) => {
    const { warning } = await d.startNew(id);
    if (warning) toast.show({ type: "error", message: warning });
  };

  useEffect(() => {
    if (sheetId) {
      void start(async () => {
        const { blocked } = await d.startEdit(String(sheetId));
        if (blocked) throw new Error(blocked);
      });
    } else if (productId) {
      void start(() => startNewAndWarn(String(productId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, sheetId]);

  // Sửa phiếu: tính lại lệch số đã lưu (cấu hình / chính sách đã đổi) → báo để người dùng kiểm tra
  useEffect(() => {
    if (!isEdit || checkedMismatch.current || !d.calc || !d.editing || d.busy) return;
    checkedMismatch.current = true;
    const saved = Number(d.editing.snapshot?.totals?.totalContractValue ?? d.editing.base_price) || 0;
    setMismatch(Math.abs(saved - (Number(d.calc.tongGiaTriHD) || 0)) > 1);
  }, [isEdit, d.calc, d.editing, d.busy]);

  const f = d.form;
  const c = d.calc;
  const isLow = !!f?.isLowRise;
  const total = c ? (isLow ? c.tongGiaTriHDMB : c.tongGiaTriHD) : 0;
  const listed = f ? Number(f.rawTongGomPBT) || Number(f.rawTongGiaTriHDMB) || 0 : 0;

  const priceListOptions = useMemo(
    () => [
      { value: NONE, label: "Không theo bảng giá (giá sản phẩm)" },
      ...d.config.priceLists.map((b: any) => ({ value: String(b.id), label: b.name || "Bảng giá" })),
    ],
    [d.config.priceLists]
  );
  const policyOptions = useMemo(
    () => [{ value: NONE, label: "Không áp dụng chính sách" }, ...d.config.policies.map((p) => ({ value: p.id, label: p.name }))],
    [d.config.policies]
  );
  const scheduleOptions = useMemo(
    () => [{ value: NONE, label: "Chưa chọn" }, ...d.config.schedules.map((s) => ({ value: s.id, label: s.name }))],
    [d.config.schedules]
  );
  const configName = useMemo(
    () => d.config.policyConfigs.find((x: any) => String(x.ID) === String(d.policyConfigId))?.Name || "",
    [d.config.policyConfigs, d.policyConfigId]
  );

  /** Gọi thao tác chọn (bảng giá / chính sách / tiến độ) – lỗi máy chủ hiện toast */
  const act = (p: Promise<any>) =>
    p.catch((e: any) => toast.show({ type: "error", message: e?.message || "Không tải được dữ liệu" }));

  const save = async () => {
    if (savingRef.current || d.busy) return;
    if (!d.product || !c) {
      hapticError();
      toast.show({ type: "error", message: "Chưa chọn căn" });
      setStep(0);
      return;
    }
    if (c.warnings.length) {
      const ok = await confirm({
        title: "Công thức chiết khấu đang dùng dự phòng",
        message: `${c.warnings[0]}\nVẫn lưu phiếu?`,
        confirmText: "Lưu",
      });
      if (!ok) return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await d.save();
      hapticSuccess();
      toast.show({ type: "success", message: isEdit ? "Đã cập nhật phiếu tính giá" : "Đã lưu phiếu tính giá" });
      if (isEdit) router.back();
      else router.replace({ pathname: "/price-sheet/[id]", params: { id: saved.id } });
    } catch (e: any) {
      hapticError();
      toast.show({ type: "error", message: e?.message || "Không thể lưu phiếu tính giá" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const header = (
    <AppHeader
      variant="soft"
      title={isEdit ? "Sửa phiếu tính giá" : "Lập phiếu tính giá"}
      subtitle={d.product ? [d.product.KyHieu, d.product.TenDA].filter(Boolean).join(" · ") : undefined}
    />
  );

  if (initializing) {
    return (
      <Screen header={header} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.body}>
          <SkeletonDetail />
        </View>
      </Screen>
    );
  }
  if (initError) {
    return (
      <Screen header={header} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          title={isEdit ? "Không sửa được phiếu trên app" : "Không tải được căn"}
          description={initError}
          onRetry={() => {
            if (isEdit) return router.back();
            if (productId) return void start(() => startNewAndWarn(String(productId)));
            setInitError(null);
            d.reset();
          }}
        />
      </Screen>
    );
  }

  const busyText =
    d.busy === "priceList"
      ? "Đang nạp giá theo bảng giá…"
      : d.busy === "policy"
        ? "Đang nạp chính sách…"
        : d.busy === "schedule"
          ? "Đang nạp tiến độ thanh toán…"
          : d.busy === "product"
            ? "Đang nạp căn…"
            : null;

  const footer = (
    <BottomActionBar>
      <View style={styles.footer}>
        {c ? (
          <View style={styles.footerSum}>
            <Text variant="caption" color="textSecondary">
              Tổng HĐMB sau CK
            </Text>
            <MoneyText value={total} variant="subhead" weight="bold" />
          </View>
        ) : null}
        <View style={styles.footerBtns}>
          {step > 0 ? (
            <Button title="Quay lại" variant="secondary" onPress={() => setStep(step - 1)} style={styles.flex} />
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button
              title="Tiếp tục"
              onPress={() => {
                if (!d.product) {
                  hapticError();
                  toast.show({ type: "error", message: "Chọn căn để tiếp tục" });
                  return;
                }
                setStep(step + 1);
              }}
              disabled={!d.product}
              style={styles.flex}
            />
          ) : (
            <Button
              title={isEdit ? "Lưu thay đổi" : "Lưu phiếu"}
              icon={Check}
              onPress={save}
              loading={saving}
              disabled={!!d.busy}
              style={styles.flex}
            />
          )}
        </View>
      </View>
    </BottomActionBar>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen header={header} padded={false} keyboardAware footer={footer}>
        <View style={styles.body}>
          <ProgressSteps steps={STEPS} current={step} />
          {busyText ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption" color="textSecondary">
                {busyText}
              </Text>
            </View>
          ) : null}
          {mismatch ? (
            <View style={[styles.notice, styles.warn]}>
              <Text variant="caption" color="onWarningSubtle">
                Số tiền tính lại theo cấu hình hiện tại khác số đã lưu (cấu hình / chính sách có thể đã đổi). Kiểm tra lại
                trước khi lưu.
              </Text>
            </View>
          ) : null}

          {step === 0 ? (
            !d.product ? (
              <ProductPicker onPick={(id) => void start(() => startNewAndWarn(id))} />
            ) : (
              <>
                <PriceHero total={total} listed={listed} discount={c?.tienChietKhau} discountPercent={c?.totalDiscountPercent}>
                  <View style={styles.heroHead}>
                    <View style={styles.flex}>
                      <Text variant="heading" color={colors.showcase.text}>
                        {d.product.KyHieu || d.product.MaSP}
                      </Text>
                      <Text variant="caption" color={colors.showcase.textMuted}>
                        {[d.product.TenDA, isLow ? "Thấp tầng" : "Cao tầng"].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    {!isEdit ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Đổi căn"
                        hitSlop={8}
                        onPress={async () => {
                          const ok = await confirm({ title: "Đổi căn?", message: "Dữ liệu đang nhập sẽ được tính lại cho căn mới." });
                          if (ok) d.reset();
                        }}
                        style={styles.change}
                      >
                        <RefreshCw size={14} color={colors.showcase.text} />
                        <Text variant="label" color={colors.showcase.text}>
                          Đổi căn
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </PriceHero>
                <SelectField
                  label="Bảng giá"
                  value={d.priceListId ?? NONE}
                  options={priceListOptions}
                  onChange={(v) => void act(d.selectPriceList(v === NONE ? null : v))}
                  sheetTitle="Chọn bảng giá"
                  variant="raised"
                  loading={d.busy === "priceList"}
                />
                {f ? (
                  <InfoCard
                    title="Giá niêm yết"
                    rows={
                      isLow
                        ? [
                            ["Diện tích đất", f.dienTichDat ? `${formatArea(f.dienTichDat)} m²` : null],
                            ["Giá đất chưa VAT", money(f.rawTienDatChuaVAT)],
                            ["Tổng giá đất", money(f.rawTongTienDatVAT)],
                            ["Tiền xây dựng chưa VAT", money(f.rawThanhTienXD)],
                            ["Tổng tiền xây dựng gồm VAT", money(f.rawTongGiaXDVAT)],
                            ["Tổng giá trị HĐMB", money(f.rawTongGiaTriHDMB)],
                          ]
                        : [
                            ["Diện tích thông thủy", f.dienTichThongThuy ? `${formatArea(f.dienTichThongThuy)} m²` : null],
                            ["Đơn giá gồm VAT", money(f.rawDonGiaDaVAT)],
                            ["Tổng giá chưa VAT", money(f.rawTongGiaChuaVAT)],
                            [`VAT (${f.tyLeVAT}%)`, money(f.rawTienVAT)],
                            ["Tổng giá gồm VAT", money(f.rawTongGiaDaVAT)],
                            [`Kinh phí bảo trì (${f.tyLePBT}%)`, money(f.rawTienPhiBaoTri)],
                            ["Tổng gồm VAT + KPBT", money(f.rawTongGomPBT)],
                          ]
                    }
                  />
                ) : null}
              </>
            )
          ) : null}

          {step === 1 && c ? (
            <>
              <SelectField
                label="Chính sách bán hàng"
                value={d.policyId ?? NONE}
                options={policyOptions}
                onChange={(v) => void act(d.selectPolicy(v === NONE ? null : v))}
                sheetTitle="Chọn chính sách"
                variant="raised"
                loading={d.busy === "policy"}
              />
              {configName ? (
                <Text variant="caption" color="textSecondary">
                  Cấu hình tính giá: {configName}
                </Text>
              ) : null}
              {c.warnings.length ? (
                <View style={[styles.notice, styles.warn]}>
                  {c.warnings.map((w) => (
                    <Text key={w} variant="caption" color="onWarningSubtle">
                      {w}
                    </Text>
                  ))}
                </View>
              ) : null}
              {d.rounds.length ? (
                <>
                  <HomeSectionHeader title="Chiết khấu áp dụng" />
                  {d.rounds.map((r, i) => (
                    <RoundEditor
                      key={r.key}
                      index={i}
                      round={r}
                      result={c.roundResults[i]}
                      isLowRise={isLow}
                      onChange={(patch) => d.updateRound(i, patch)}
                    />
                  ))}
                </>
              ) : d.policyId && !d.busy ? (
                <View style={[styles.notice, styles.info]}>
                  <Text variant="caption" color="onInfoSubtle">
                    Chính sách chưa có cấu hình vòng chiết khấu – giá giữ nguyên giá niêm yết.
                  </Text>
                </View>
              ) : null}
              <PriceHero total={total} listed={listed} discount={c.tienChietKhau} discountPercent={c.totalDiscountPercent} />
              <InfoCard
                title="Sau chiết khấu"
                rows={
                  isLow
                    ? [
                        ["Tổng giá đất", money(c.tongTienDatVAT)],
                        ["Tiền xây dựng gồm VAT", money(c.tongGiaXDVAT)],
                        ["Tổng giá trị HĐMB", money(c.tongGiaTriHDMB)],
                      ]
                    : [
                        ["Tổng giá chưa VAT", money(c.giaTriSauCK)],
                        ["VAT", money(c.tienVAT)],
                        ["Tổng giá gồm VAT", money(c.tongGomVAT)],
                        ["Kinh phí bảo trì", money(c.phiBaoTri)],
                        ["Tổng giá trị HĐMB", money(c.tongGiaTriHD)],
                      ]
                }
              />
            </>
          ) : null}

          {step === 2 && f ? (
            <>
              <SelectField
                label="Tiến độ thanh toán"
                value={d.templateId ?? NONE}
                options={scheduleOptions}
                onChange={(v) => void act(d.selectTemplate(v === NONE ? null : v))}
                sheetTitle="Chọn tiến độ thanh toán"
                variant="raised"
                loading={d.busy === "schedule"}
              />
              <View style={styles.row2}>
                <DateField label="Ngày ký dự kiến" value={f.ngayKy} onChange={(date) => d.updateForm({ ngayKy: date })} variant="soft" />
              </View>
              <TextField
                label="Tiền cọc"
                variant="soft"
                keyboardType="number-pad"
                value={f.tienCoc ? formatNumberVN(f.tienCoc) : ""}
                onChangeText={(t) => d.updateForm({ tienCoc: parseVND(t) ?? 0 })}
                suffix={<Text color="textSecondary">₫</Text>}
              />
              <ScheduleList
                emptyText="Chọn tiến độ thanh toán để dựng lịch các đợt."
                items={d.schedule.map((r) => ({
                  name: r.kieuThanhToan,
                  ratio: r.tyLeTT,
                  dueDate: dueDateFor(r, f.ngayKy),
                  vat: r.tienVAT,
                  maintenance: r.tienBaoTri,
                  total: r.tongGiaTri,
                }))}
              />
            </>
          ) : null}

          {step === 3 && f ? (
            <>
              <HomeSectionHeader title="Khách hàng (không bắt buộc)" />
              <CustomerPicker value={d.customer} onChange={d.setCustomer} />
              {d.config.promotions.length ? (
                <>
                  <HomeSectionHeader title="Quà tặng" />
                  <View style={styles.card}>
                    {d.config.promotions.map((p, i) => {
                      const on = d.promotions.some((x) => x.ID === p.ID);
                      return (
                        <Pressable
                          key={p.ID}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          onPress={() => d.togglePromotion(p)}
                          style={({ pressed }) => [
                            styles.promo,
                            i < d.config.promotions.length - 1 ? styles.divider : null,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <View style={[styles.check, on ? styles.checkOn : null]}>
                            {on ? <Check size={14} color={colors.onPrimary} /> : <Gift size={14} color={colors.textTertiary} />}
                          </View>
                          <Text variant="body" style={styles.flex} numberOfLines={2}>
                            {p.TenQuaTang}
                            {p.SoLuong ? ` × ${p.SoLuong}` : ""}
                          </Text>
                          {p.GiaTri ? <MoneyText value={p.GiaTri} variant="caption" /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <TextField
                label="Ghi chú"
                variant="soft"
                multiline
                value={f.ghiChu}
                onChangeText={(t) => d.updateForm({ ghiChu: t })}
                placeholder="Ghi chú cho phiếu"
              />
              <InfoCard
                title="Tóm tắt"
                rows={[
                  ["Căn", d.product?.KyHieu],
                  ["Chính sách", d.policyName || "Không áp dụng"],
                  ["Tiến độ", d.templateName || null],
                  ["Chiết khấu", money(c?.tienChietKhau)],
                  ["Tổng giá trị HĐMB", money(total)],
                  ["Tiền cọc", money(f.tienCoc)],
                ]}
              />
            </>
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg, gap: space.md },
  flex: { flex: 1 },
  row2: { flexDirection: "row", gap: space.sm },
  heroHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginBottom: space.md,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.showcase.surface,
  },
  change: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    minHeight: 32,
    borderRadius: radius.full,
    backgroundColor: colors.showcase.surface,
  },
  busy: { flexDirection: "row", alignItems: "center", gap: space.sm },
  notice: { padding: space.md, borderRadius: radius.lg, gap: space.xs },
  warn: { backgroundColor: colors.warningSubtle },
  info: { backgroundColor: colors.infoSubtle },
  footer: { flex: 1, gap: space.sm },
  footerSum: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerBtns: { flexDirection: "row", gap: space.sm },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft, overflow: "hidden" },
  promo: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  checkOn: { backgroundColor: colors.primary },
});
