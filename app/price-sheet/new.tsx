import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, FileText, Search, User } from "lucide-react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { ProductPicker } from "@/components/priceSheet/ProductPicker";
import { InfoCard, money, PriceHero, ScheduleList } from "@/components/priceSheet/PriceSheetBlocks";
import { useWebPriceSheet } from "@/components/priceSheet/useWebPriceSheet";
import { WebRoundCard } from "@/components/priceSheet/WebRoundCard";
import {
  AppHeader,
  BottomActionBar,
  Button,
  confirm,
  DateField,
  EmptyState,
  ErrorState,
  MoneyText,
  ProgressSteps,
  Screen,
  SegmentedControl,
  SelectField,
  SkeletonDetail,
  Text,
  TextField,
} from "@/components/ui";
import { formatArea, maskPhone } from "@/lib/format";
import { hapticError } from "@/lib/haptics";
import { PRICE_SHEET_CREATE_LOCKED } from "@/lib/featureConfig";
import { applyPicked } from "@/lib/web/components/Products/ContractForm/discountOptions";
import { paymentScheduleOptions, scheduleOutOfUnitFund } from "@/lib/web/components/Products/ContractForm/paymentScheduleOptions";
import { policyGateReason } from "@/lib/web/components/Products/ContractForm/disabledReasons";
import { onSalesCompanyChange } from "@/lib/web/components/Products/ContractForm/useSalesPolicyGate";
import { policyOutOfUnitFund, policyPickOptions, POLICY_OUT_OF_UNIT_FUND_WARNING } from "@/lib/web/components/Sales/salesConfig/expiryPickOptions";
import { priceListOptionsForPolicy } from "@/lib/web/components/Sales/salesConfig/policyScope";
import { policyExpiryDate } from "@/lib/web/lib/priceSheetExpiry";
import { isLowRiseProduct } from "@/lib/web/utils/productType";
import { toast as webToast } from "@/lib/web/_shims/sonner";
import { colors, radius, space } from "@/theme";

const STEPS = ["Căn & chính sách", "Lịch thanh toán", "Khách hàng"] as const;
const NONE = "__none__";

/**
 * Lập / sửa phiếu tính giá trên app — luồng app (3 bước), logic ĐÚNG form web: mọi dữ liệu / thao tác gọi vào form web chép nguyên văn
 * (useWebPriceSheet ⇒ lib/web useWebPriceSheetForm): quỹ căn ⇒ bảng giá, công ty bán hàng, chính sách (trước bảng giá), tùy chọn chiết
 * khấu theo điều kiện / phân bổ / tồn kho, tiến độ, ngày tính / ngày hết hạn (≤ hạn chính sách), tính giá, lưu (máy chủ cấp số phiếu).
 * Duyệt phiếu vẫn trên web. Params: `productId` (lập cho căn) hoặc `sheetId` (sửa).
 */
export default function PriceSheetEditorRoute() {
  const router = useRouter();
  if (PRICE_SHEET_CREATE_LOCKED) {
    return (
      <Screen header={<AppHeader variant="soft" title="Phiếu tính giá" />}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon={FileText}
          title="Lập / sửa phiếu tính giá trên web"
          description="App tạm chỉ xem phiếu tính giá. Vui lòng lập hoặc sửa phiếu trên web."
          actionLabel="Quay lại"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  return <PriceSheetEditorEntry />;
}

/** Không có căn / phiếu (nút "+" danh sách) ⇒ chọn căn trước (như web PriceSheetProductPicker), rồi mở form */
function PriceSheetEditorEntry() {
  const router = useRouter();
  const { productId, sheetId } = useLocalSearchParams<{ productId?: string; sheetId?: string }>();
  if (productId || sheetId) return <PriceSheetEditorScreen />;
  return (
    <Screen header={<AppHeader variant="soft" title="Lập phiếu tính giá" />} padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.body}>
        <ProductPicker onPick={(id) => router.replace({ pathname: "/price-sheet/new", params: { productId: String(id) } })} />
      </View>
    </Screen>
  );
}

/** Ô chọn của web (value / label / disabled) ⇒ SelectField app: bỏ mục khoá (trừ mục đang chọn), thêm mục "không chọn" khi cho xoá */
function toSelect(opts: any[] | undefined, current: unknown, noneLabel?: string) {
  const cur = current == null ? "" : String(current);
  const list = (opts || [])
    .filter((o: any) => !o?.disabled || String(o?.value) === cur)
    .map((o: any) => ({ value: String(o.value), label: String(o.label ?? o.value), description: o.description || undefined }));
  return noneLabel ? [{ value: NONE, label: noneLabel }, ...list] : list;
}

const toDate = (v: any): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function PriceSheetEditorScreen() {
  const router = useRouter();
  const { productId, sheetId } = useLocalSearchParams<{ productId?: string; sheetId?: string }>();
  const { ready, error, form: r, editingSheet, closed } = useWebPriceSheet({
    productId: productId ? String(productId) : null,
    sheetId: sheetId ? String(sheetId) : null,
  });
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const isEdit = !!sheetId;
  const navigated = useRef(false);

  // Form đóng sau khi lưu (web onOpenChange(false)) ⇒ sang chi tiết phiếu vừa lưu / quay lại
  useEffect(() => {
    if (!closed || navigated.current) return;
    navigated.current = true;
    const id = closed.saved?.id;
    if (id && !isEdit) router.replace({ pathname: "/price-sheet/[id]", params: { id: String(id) } });
    else router.back();
  }, [closed, isEdit, router]);

  // Tìm khách: đúng ô tìm của web (effect web tự gọi CustomerService.getList theo customerSearch + loại khách)
  useEffect(() => {
    const t = setTimeout(() => r?.setCustomerSearch?.(search.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const fd = r?.formData || {};
  const product = r?.product;
  const isLow = !!r && isLowRiseProduct({ loaiSP: fd.loaiSP, product, maSP: fd.maSanPham });
  const c = r?.calculations || {};
  const total = isLow ? c.tongGiaTriHDMB : c.tongGiaTriHD;
  const listed = Number(fd.rawTongGomPBT) || Number(fd.rawTongGiaTriHDMB) || 0;
  const policyRow = r?.selectedPolicyRow;
  const gate = r?.gate || {};

  const policyOptions = useMemo(
    () =>
      r
        ? toSelect(
            policyPickOptions(r.chinhSachBH, {
              isLow,
              ngay: fd.ngayKy,
              selectedId: r.selectedPolicyId,
              allowIds: r.exceptionIds?.CSBH,
              quyCanId: r.unitFund?.quyCanId,
              toaId: r.criteria?.toaId,
            }),
            r.selectedPolicyId,
            "-- Không chọn chính sách --"
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r?.chinhSachBH, isLow, fd.ngayKy, r?.selectedPolicyId, r?.exceptionIds, r?.unitFund?.quyCanId, r?.criteria?.toaId]
  );
  const priceListOptions = useMemo(
    () =>
      r
        ? toSelect(
            priceListOptionsForPolicy(
              r.unitFund?.priceListOptions,
              (r.chinhSachBH || []).find(
                (x: any) => String(x?.ID ?? x?.id ?? "").toLowerCase() === String(r.selectedPolicyId ?? "").toLowerCase()
              ),
              r.selectedPriceListId
            ),
            r.selectedPriceListId,
            "-- Không theo bảng giá --"
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r?.unitFund?.priceListOptions, r?.chinhSachBH, r?.selectedPolicyId, r?.selectedPriceListId]
  );
  const scheduleOptions = useMemo(
    () =>
      r
        ? toSelect(
            paymentScheduleOptions(r.lichThanhToan, r.unitFund?.quyCanId, r.selectedTemplateId, { ngay: fd.ngayKy }, r.exceptionIds?.TDTT),
            r.selectedTemplateId
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r?.lichThanhToan, r?.unitFund?.quyCanId, r?.selectedTemplateId, fd.ngayKy, r?.exceptionIds]
  );

  const header = (
    <AppHeader
      variant="soft"
      title={isEdit ? "Sửa phiếu tính giá" : "Lập phiếu tính giá"}
      subtitle={product ? [product.KyHieu, product.TenDA].filter(Boolean).join(" · ") : undefined}
    />
  );

  if (error) {
    return (
      <Screen header={header} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState title={isEdit ? "Không mở được phiếu" : "Không tải được căn"} description={error} onRetry={() => router.back()} />
      </Screen>
    );
  }
  if (!ready || !r) {
    return (
      <Screen header={header} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.body}>
          <SkeletonDetail />
        </View>
      </Screen>
    );
  }

  const busyText = r.loadingPolicies
    ? "Đang nạp chính sách / bảng giá…"
    : r.loadingPriceList
      ? "Đang nạp giá theo bảng giá…"
      : r.loadingSchedule
        ? "Đang nạp tiến độ thanh toán…"
        : r.loadingPriceCalc
          ? "Đang dựng bảng chiết khấu…"
          : null;

  /** Đổi chính sách: lịch đã sửa ⇒ hỏi như web requestSelectCSBH */
  const pickPolicy = async (v: string | null) => {
    r.policyPickedRef.current = v;
    if (!v || !r.isScheduleDirty()) return void r.handleSelectCSBH(v as any);
    const ok = await confirm({
      title: "Nạp lại tiến độ thanh toán?",
      message:
        "Bạn đã chỉnh sửa tiến độ thanh toán hiện tại. Đổi chính sách bán hàng sẽ nạp lại tiến độ theo chính sách mới và ghi đè các chỉnh sửa này.",
      confirmText: "Nạp lại tiến độ",
      cancelText: "Giữ tiến độ hiện tại",
    });
    void r.handleSelectCSBH(v, ok ? undefined : { keepSchedule: true });
  };

  const changeUnitFund = (v: string) => {
    if (!v) return;
    r.unitFund.change(String(v));
    if (scheduleOutOfUnitFund(r.lichThanhToan, String(v), r.selectedTemplateId))
      webToast.warning("Lịch thanh toán đang chọn không thuộc quỹ căn này, vui lòng chọn lại lịch thanh toán");
    if (policyOutOfUnitFund(r.chinhSachBH, String(v), r.selectedPolicyId)) webToast.warning(POLICY_OUT_OF_UNIT_FUND_WARNING);
  };

  const updateRound = (idx: number, fn: (x: any) => any, financial = true) => {
    if (financial) r.markFinancialEdited();
    r.setPolicyRounds((prev: any[]) => prev.map((x, i) => (i === idx ? fn(x) : x)));
  };

  const dueDates: (string | null)[] = r.dueDatesOf ? r.dueDatesOf(r.paymentSchedule || []) : [];
  const enabledRounds = (r.policyRounds || []).map((x: any, i: number) => ({ x, i }));
  const pendingOptions = !!r.reopenDetails?.pending;
  const customerName = fd.customerType === "business" ? fd.TenCongTy : fd.TenKH;

  const save = async () => {
    if (r.isSaving) return;
    try {
      await r.handleSave(false);
    } catch (e: any) {
      hapticError();
      webToast.error(e?.message || "Không thể lưu phiếu tính giá");
    }
  };

  const footer = (
    <BottomActionBar>
      <View style={styles.footer}>
        <View style={styles.footerSum}>
          <Text variant="caption" color="textSecondary">
            Tổng giá trị HĐMB
          </Text>
          <MoneyText value={Number(total) || 0} variant="subhead" weight="bold" />
        </View>
        <View style={styles.footerBtns}>
          {step > 0 ? <Button title="Quay lại" variant="secondary" onPress={() => setStep(step - 1)} style={styles.flex} /> : null}
          {step < STEPS.length - 1 ? (
            <Button title="Tiếp tục" onPress={() => setStep(step + 1)} style={styles.flex} />
          ) : (
            <Button
              title={isEdit ? "Lưu thay đổi" : "Lưu phiếu"}
              icon={Check}
              onPress={save}
              loading={!!r.isSaving}
              disabled={!!busyText || pendingOptions}
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
      <Screen header={header} padded={false} keyboardAware hideFooterWithKeyboard footer={footer}>
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

          {step === 0 ? (
            <>
              <PriceHero total={Number(total) || 0} listed={listed} discount={c.tienChietKhau} discountPercent={c.totalDiscountPercent}>
                <View style={styles.heroHead}>
                  <Text variant="heading" color={colors.showcase.text}>
                    {product?.KyHieu || fd.maSanPham}
                  </Text>
                  <Text variant="caption" color={colors.showcase.textMuted}>
                    {[fd.duAn || product?.TenDA, isLow ? "Thấp tầng" : "Cao tầng"].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </PriceHero>

              <View style={styles.card}>
                <SelectField
                  label="Quỹ căn"
                  required
                  variant="soft"
                  value={r.unitFund?.quyCanId ? String(r.unitFund.quyCanId) : null}
                  options={(r.unitFund?.funds || []).map((q: any) => ({ value: String(q.id), label: q.name }))}
                  onChange={(v) => changeUnitFund(String(v))}
                  placeholder="-- Chọn quỹ căn --"
                  sheetTitle="Chọn quỹ căn"
                />
                {r.salesCompanyRule?.show ? (
                  <SelectField
                    label="Công ty bán hàng"
                    required={!!r.salesCompanyRequired}
                    variant="soft"
                    disabled={!!r.salesCompanyLocked}
                    value={r.congTyBanHangId ? String(r.congTyBanHangId) : null}
                    options={toSelect(r.salesCompanyOptions, r.congTyBanHangId, r.salesCompanyRequired ? undefined : "-- Không chọn --")}
                    onChange={(v) =>
                      onSalesCompanyChange(r.congTyBanHangId, v === NONE ? undefined : String(v), r.setCongTyBanHangId, r.markCompanyChanged)
                    }
                    placeholder="Chọn công ty bán hàng"
                    sheetTitle="Chọn công ty bán hàng"
                  />
                ) : null}
                <SelectField
                  label="Chính sách bán hàng"
                  variant="soft"
                  disabled={!!gate.locked}
                  value={r.selectedPolicyId ? String(r.selectedPolicyId) : NONE}
                  options={policyOptions}
                  onChange={(v) => void pickPolicy(v === NONE ? null : String(v))}
                  sheetTitle="Chọn chính sách"
                  loading={!!r.loadingPriceCalc}
                />
                {gate.locked ? (
                  <Text variant="caption" color="textSecondary">
                    {policyGateReason(gate, "chính sách bán hàng", r.salesCompanyLoadFailed)}
                  </Text>
                ) : null}
                <SelectField
                  label="Bảng giá"
                  variant="soft"
                  value={r.selectedPriceListId ? String(r.selectedPriceListId) : NONE}
                  options={priceListOptions}
                  onChange={(v) => void r.handleBG(v === NONE ? undefined : String(v))}
                  sheetTitle="Chọn bảng giá"
                  loading={!!r.loadingPriceList}
                />
                <SelectField
                  label="Lịch thanh toán"
                  variant="soft"
                  disabled={!!gate.locked}
                  value={r.selectedTemplateId ? String(r.selectedTemplateId) : null}
                  options={scheduleOptions}
                  onChange={(v) => void r.handleTemplateSelect(String(v))}
                  placeholder="-- Chọn lịch thanh toán --"
                  sheetTitle="Chọn lịch thanh toán"
                  loading={!!r.loadingSchedule}
                />
                <View style={styles.row2}>
                  <View style={styles.flex}>
                    <DateField
                      label="Ngày tính"
                      variant="soft"
                      value={toDate(fd.ngayKy)}
                      onChange={(d) => r.setFormData({ ...r.formData, ngayKy: d })}
                    />
                  </View>
                  {r.sections?.expiry ? (
                    <View style={styles.flex}>
                      <DateField
                        label="Ngày hết hạn"
                        variant="soft"
                        value={toDate(fd.ngayHetHan)}
                        maximumDate={toDate(policyExpiryDate(policyRow)) || undefined}
                        onChange={(d) => r.setFormData({ ...r.formData, ngayHetHan: ymd(d) })}
                      />
                    </View>
                  ) : null}
                </View>
                <Text variant="caption" color="textSecondary">
                  Số phiếu: {fd.soHopDong || editingSheet?.sheet_code || "máy chủ tự cấp khi lưu"}
                </Text>
              </View>

              <InfoCard
                title="Giá niêm yết"
                rows={
                  isLow
                    ? [
                        ["Diện tích đất", fd.dienTichDat ? formatArea(fd.dienTichDat) : null],
                        ["Giá đất chưa VAT", money(fd.rawTienDatChuaVAT)],
                        ["Tổng giá đất", money(fd.rawTongTienDatVAT)],
                        ["Tiền xây dựng chưa VAT", money(fd.rawThanhTienXD)],
                        ["Tổng tiền xây dựng gồm VAT", money(fd.rawTongGiaXDVAT)],
                        ["Tổng giá trị HĐMB", money(fd.rawTongGiaTriHDMB)],
                      ]
                    : [
                        ["Diện tích thông thủy", fd.dienTichThongThuy ? formatArea(fd.dienTichThongThuy) : null],
                        ["Tổng giá chưa VAT", money(fd.rawTongGiaChuaVAT)],
                        [`VAT (${fd.tyLeVAT ?? 10}%)`, money(fd.rawTienVAT)],
                        ["Tổng giá gồm VAT", money(fd.rawTongGiaDaVAT)],
                        [`Kinh phí bảo trì (${fd.tyLePBT ?? 2}%)`, money(fd.rawTienPhiBaoTri)],
                        ["Tổng gồm VAT + KPBT", money(fd.rawTongGomPBT)],
                      ]
                }
              />

              {enabledRounds.length ? (
                <>
                  <HomeSectionHeader title="Chiết khấu áp dụng" />
                  {enabledRounds.map(({ x, i }: any) => (
                    <WebRoundCard
                      key={String(x.key ?? i)}
                      index={i}
                      round={x}
                      tongCK={Math.round(c.roundResults?.[i]?.tongCK ?? 0)}
                      ctx={r.optionCtx}
                      pending={pendingOptions}
                      onToggle={() => updateRound(i, (y) => ({ ...y, enabled: !y.enabled }), false)}
                      onPercent={(v) => updateRound(i, (y) => ({ ...y, discountPercent: v }))}
                      onCash={(v) => updateRound(i, (y) => ({ ...y, tienCK: v }))}
                      onPick={(picked) => updateRound(i, (y) => applyPicked(y, picked))}
                    />
                  ))}
                </>
              ) : r.selectedPolicyId && !busyText ? (
                <View style={[styles.notice, styles.info]}>
                  <Text variant="caption" color="onInfoSubtle">
                    Chính sách chưa có dòng chiết khấu – giá giữ nguyên giá niêm yết.
                  </Text>
                </View>
              ) : null}

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

          {step === 1 ? (
            <>
              <InfoCard title="Tiền cọc" rows={[["Theo cài đặt bán hàng", money(fd.tienCoc)]]} />
              <ScheduleList
                emptyText="Chọn lịch thanh toán ở bước 1 để dựng các đợt."
                items={(r.paymentSchedule || []).map((row: any, i: number) => ({
                  name: row.kieuThanhToan,
                  ratio: row.tyLeTT,
                  dueDate: dueDates[i] ?? null,
                  base: row.soTien,
                  vat: row.tienVAT,
                  maintenance: row.tienBaoTri,
                  total: row.tongGiaTri,
                }))}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <HomeSectionHeader title="Khách hàng (không bắt buộc)" />
              <SegmentedControl
                options={[
                  { value: "individual", label: "Cá nhân" },
                  { value: "business", label: "Doanh nghiệp" },
                ]}
                value={fd.customerType || "individual"}
                onChange={(v) => r.setFormData({ ...r.formData, customerType: v })}
              />
              {customerName ? (
                <View style={styles.picked}>
                  <User size={18} color={colors.primary} />
                  <View style={styles.flex}>
                    <Text variant="subhead">{customerName}</Text>
                    <Text variant="caption" color="textSecondary">
                      {[fd.MaSoKH, maskPhone(fd.DiDong || fd.DienThoaiCT)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </View>
              ) : null}
              <TextField
                label="Tìm khách hàng"
                variant="soft"
                value={search}
                onChangeText={setSearch}
                placeholder="Tên, SĐT, CCCD, mã khách (≥ 2 ký tự)"
                prefix={<Search size={16} color={colors.textTertiary} />}
              />
              {(r.customerOptions || []).length ? (
                <View style={styles.card}>
                  {(r.customerOptions || []).slice(0, 30).map((k: any, i: number) => (
                    <Pressable
                      key={String(k.MaKH ?? k.ID ?? i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Chọn ${k.TenKH || k.TenCongTy || ""}`}
                      onPress={() => {
                        r.handleCustomerSelect(k);
                        setSearch("");
                      }}
                      style={({ pressed }) => [styles.cust, pressed ? styles.pressed : null]}
                    >
                      <Text variant="body">{fd.customerType === "business" ? k.TenCongTy || k.TenKH : k.TenKH}</Text>
                      <Text variant="caption" color="textSecondary">
                        {[k.MaSoKH, maskPhone(k.DiDong)].filter(Boolean).join(" · ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <InfoCard
                title="Tóm tắt"
                rows={[
                  ["Căn", product?.KyHieu || fd.maSanPham],
                  ["Chính sách", policyRow?.TenChinhSach || policyRow?.ten_cs || "Không áp dụng"],
                  ["Chiết khấu", money(c.tienChietKhau)],
                  ["Tổng giá trị HĐMB", money(total)],
                  ["Tiền cọc", money(fd.tienCoc)],
                  ["Ngày hết hạn", fd.ngayHetHan ? String(fd.ngayHetHan).split("-").reverse().join("/") : null],
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
    gap: space.xs,
    marginBottom: space.md,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.showcase.surface,
  },
  busy: { flexDirection: "row", alignItems: "center", gap: space.sm },
  card: { padding: space.lg, gap: space.md, borderRadius: radius.xxl, backgroundColor: colors.surface },
  notice: { padding: space.md, borderRadius: radius.lg, gap: space.xs },
  info: { backgroundColor: colors.infoSubtle },
  footer: { flex: 1, gap: space.sm },
  footerSum: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerBtns: { flexDirection: "row", gap: space.sm },
  picked: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  cust: { paddingVertical: space.sm, gap: 2 },
  pressed: { opacity: 0.7 },
});
