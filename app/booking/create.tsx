import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Building2, UserPlus, UserX, X } from "lucide-react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { useWebBooking } from "@/components/booking/useWebBooking";
import {
  AppHeader,
  Avatar,
  BottomActionBar,
  Button,
  EmptyState,
  Screen,
  SearchBar,
  SelectField,
  SkeletonList,
  Text,
} from "@/components/ui";
import { hapticSuccess } from "@/lib/haptics";
import { formatVND, formatVNDShort, maskPhone } from "@/lib/format";
import { AGENCY_FIXED_REASON, salesCompanyLockReason } from "@/lib/web/components/Products/ContractForm/disabledReasons";
import { policyConfigPickOptions } from "@/lib/web/components/Sales/salesConfig/expiryPickOptions";
import { priceListOptionsForPolicy } from "@/lib/web/components/Sales/salesConfig/policyScope";
import { bookingFormTitle, fundCodeOf } from "@/lib/web/lib/transferFund";
import { colors, elevation, radius, space } from "@/theme";

/** Giá trị "không chọn" trong SelectField */
const NONE = "__none__";

function parseJsonParam(value: unknown) {
  if (!value || Array.isArray(value)) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

/** Khách vừa tạo ở customer/new (dòng fn_customer_get) ⇒ dạng web CustomerFormModal trả về (handleCustomerSaved) */
function toWebSavedCustomer(c: any) {
  const raw = c?.raw || {};
  const id = [c?.id, raw?.id, c?.MaKH].map((x) => (x == null ? "" : String(x))).find((x) => x.includes("-")) ?? "";
  return {
    MaKH: id,
    MaSoKH: c?.ma_so_kh ?? raw?.ma_so_kh ?? c?.MaSoKH ?? null,
    TenKH: c?.ho_ten ?? raw?.TenKH ?? c?.ten_kh ?? c?.TenKH ?? "",
    TenCongTy: raw?.TenCongTy ?? c?.ten_cong_ty ?? "",
    SoCMND: c?.cccd ?? raw?.SoCMND ?? c?.SoCMND ?? "",
    DiDong: c?.dien_thoai ?? raw?.DiDong ?? c?.di_dong ?? c?.DiDong ?? "",
    Email: c?.email ?? raw?.Email ?? c?.Email ?? "",
    DiaChi: c?.dia_chi ?? raw?.DiaChi ?? c?.DiaChi ?? "",
  };
}

/**
 * Tạo booking — luồng app giữ nguyên (từ chi tiết căn / phiếu lock; chọn khách, "Thêm mới" sang màn tạo khách rồi quay về; lưu xong vào
 * thẳng chi tiết booking để thu tiền), logic ĐÚNG form web BookingFormDialog (useWebBooking ⇒ lib/web useWebBookingForm): số phiếu theo quy
 * tắc đánh mã, khách hàng (fn_customer_picker, ≥ 2 ký tự), đại lý phân phối theo công ty bán hàng, quỹ căn (khoá), chính sách trước bảng
 * giá (lọc theo quỹ căn / tòa / hạn), giá theo bảng giá, tiền + thời gian giữ chỗ theo chính sách / cài đặt bán hàng.
 */
export default function CreateBookingScreen() {
  const router = useRouter();
  const { dataBooking, newCustomer } = useLocalSearchParams();
  const bookingParam = typeof dataBooking === "string" ? dataBooking : "";
  const bookingData = useMemo(() => parseJsonParam(dataBooking), [dataBooking]);

  const { ready, error, form: r, created } = useWebBooking({ bookingData });
  const navigated = useRef(false);

  // Lưu xong (form web gọi onSuccess) ⇒ vào thẳng chi tiết booking vừa tạo để thu tiền (spec D8)
  useEffect(() => {
    if (!created || navigated.current) return;
    navigated.current = true;
    hapticSuccess();
    if (created.BookingId) router.replace({ pathname: "/booking/[id]", params: { id: String(created.BookingId) } });
    else router.replace("/bookings");
  }, [created, router]);

  // Quay về từ customer/new (router.dismissTo giữ màn này, chỉ đổi param) ⇒ chọn khách mới như web handleCustomerSaved
  const appliedNewCustomer = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !r || !newCustomer || appliedNewCustomer.current === String(newCustomer)) return;
    const parsed = parseJsonParam(newCustomer);
    if (!parsed) return;
    appliedNewCustomer.current = String(newCustomer);
    r.handleCustomerSaved(toWebSavedCustomer(parsed));
  }, [ready, r, newCustomer]);

  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = Math.round(windowHeight * 0.45);

  const openNewCustomer = () => {
    const params: Record<string, string> = { returnToBooking: "1" };
    if (bookingParam) params.dataBooking = bookingParam;
    router.push({ pathname: "/customer/new", params });
  };

  const header = (
    <AppHeader
      variant="soft"
      title={r ? bookingFormTitle(false, fundCodeOf(r.unitFund?.funds, r.unitFund?.quyCanId)) : "Tạo booking"}
    />
  );

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <EmptyState icon={UserX} title="Không mở được form booking" description={error} />
        </Screen>
      </>
    );
  }
  if (!ready || !r || created) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <SkeletonList count={5} />
        </Screen>
      </>
    );
  }

  // Ô chọn như web: chính sách (ẩn hết hạn / khác quỹ căn / không áp dụng cho tòa của căn), bảng giá theo chính sách đang chọn
  const policyRaw = r.salesConfig.policies.find((o: any) => o.value === r.policyId)?.raw;
  const policyOptions = [
    { value: NONE, label: "-- Không chọn chính sách --" },
    ...policyConfigPickOptions(r.salesConfig.policies, null, r.policyId, r.exceptionIds?.CSBH, r.unitFund.quyCanId, r.data?.MaKhu ?? null),
  ];
  const priceListOptions = [
    { value: NONE, label: "-- Không chọn bảng giá --" },
    ...priceListOptionsForPolicy(r.unitFund.priceListOptions, policyRaw, r.priceListId).map((o: any) => ({
      value: String(o.value),
      label: String(o.label ?? o.value),
    })),
  ];
  const agencyOptions = [
    ...(r.agencyLocked ? [] : [{ value: NONE, label: "-- Không chọn đại lý --" }]),
    ...r.agencyOptions.map((s: any) => ({ value: String(s.ID), label: s.TenCT })),
    // Đại lý của tài khoản không có trong danh sách vẫn hiện (như web)
    ...(r.maSan && !r.agencyOptions.some((s: any) => String(s.ID).toLowerCase() === r.maSan.toLowerCase())
      ? [{ value: r.maSan, label: r.listSan.find((s: any) => String(s.ID).toLowerCase() === r.maSan.toLowerCase())?.TenCT ?? `Đại lý #${r.maSan}` }]
      : []),
  ];
  const companyOptions = [
    ...(r.salesCompanyLocked || r.salesCompanyRequired ? [] : [{ value: NONE, label: "-- Không chọn --" }]),
    ...(r.salesCompanyOptions || []).map((o: any) => ({ value: String(o.value), label: String(o.label ?? o.value) })),
  ];
  const companyReason = salesCompanyLockReason(!!r.salesCompanyLocked, !!r.salesCompanyRequired);
  const noAgencyHint = !r.agencyLocked && r.congTyBanHangId && r.agencyOptions.length === 0;
  // Hiển thị: căn chưa có tổng giá HĐ (web hiện "—") ⇒ lấy giá trị HĐ theo bảng giá đang chọn (như màn booking cũ của app); chỉ để xem
  const contractValue = Number(r.data?.TongGiaTriHDMB) || Number(r.priceInfo?.GiaTriHD) || 0;
  const unitPrice = Number(r.price) || contractValue;
  const selected = r.selectedCustomer;
  const query = String(r.searchQuery ?? "");

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        keyboardAware
        hideFooterWithKeyboard
        padded={false}
        header={header}
        footer={
          <BottomActionBar>
            <View style={styles.footer}>
              {r.tienGiuChoHienThi ? (
                <View style={styles.footerRow}>
                  <Text variant="caption" color="textSecondary">
                    Tiền giữ chỗ
                  </Text>
                  <Text variant="subhead" numeric>
                    {formatVND(r.tienGiuChoHienThi)}
                  </Text>
                </View>
              ) : null}
              <Button
                size="lg"
                fullWidth
                style={styles.pill}
                title={r.loading ? "Đang tải dữ liệu sản phẩm…" : `Giữ chỗ ${r.code || ""}`.trim()}
                loading={!!r.submitting}
                disabled={!!r.submitting || !!r.loading || !r.isValid}
                onPress={() => void r.handleSubmit()}
              />
            </View>
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          {/* Căn đang booking – card navy trên cùng để không mất ngữ cảnh */}
          <View style={styles.unit}>
            <View style={styles.unitIcon}>
              <Building2 size={22} color={colors.showcase.accent} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text variant="heading" color={colors.showcase.text} numberOfLines={1}>
                {r.code || "Sản phẩm"}
              </Text>
              <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
                {[r.projectName || "—", r.floor != null && r.floor !== "" ? `Tầng ${r.floor}` : null, r.area ? `${r.area} m²` : null]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
            {unitPrice ? (
              <Text variant="heading" color={colors.showcase.accent} numeric>
                {formatVNDShort(unitPrice)}
              </Text>
            ) : null}
          </View>

          {/* Số phiếu / tiền / thời gian giữ chỗ (như dòng tóm tắt của web) */}
          <View style={styles.card}>
            <Meta label="Số phiếu giữ chỗ" value={r.bookingCode || "Tự cấp khi lưu"} />
            <Meta label="Tổng giá HĐ" value={contractValue ? formatVNDShort(contractValue) : "—"} />
            <Meta label="Thời gian giữ chỗ" value={r.tgBooking ? `${r.tgBooking} phút` : "—"} />
            <Meta label="Tiền giữ chỗ" value={r.tienGiuChoHienThi ? formatVND(r.tienGiuChoHienThi) : "—"} />
          </View>

          <HomeSectionHeader title="Khách hàng *" actionLabel="Thêm mới" actionIcon={UserPlus} onAction={openNewCustomer} />
          {selected ? (
            <View style={[styles.customerCard, styles.selectedRow]}>
              <Avatar name={selected.tenKH || "?"} size={40} round />
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={1}>
                  {selected.tenKH || "(Chưa có tên)"}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {[selected.soCMND, maskPhone(selected.diDong)].filter(Boolean).join(" · ") || "—"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bỏ chọn khách hàng"
                hitSlop={10}
                onPress={() => r.clearCustomer()}
                style={({ pressed }) => [styles.clear, pressed ? styles.pressed : null]}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <>
              <SearchBar value={query} onChangeText={r.setSearchQuery} placeholder="Nhập tên / SĐT / CCCD để tìm" variant="soft" />
              <View style={[styles.customerCard, { maxHeight: listMaxHeight }]}>
                {r.searching && r.results.length === 0 ? (
                  <SkeletonList count={3} />
                ) : r.results.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    {query.trim().length < 2 ? (
                      <EmptyState icon={UserX} title="Tìm khách hàng" description="Nhập tên / SĐT / CCCD (ít nhất 2 ký tự) hoặc bấm Thêm mới." />
                    ) : (
                      <EmptyState icon={UserX} title="Không tìm thấy khách hàng" description="Thử từ khoá khác hoặc bấm Thêm mới." />
                    )}
                  </View>
                ) : (
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    {r.results.map((c: any, i: number) => (
                      <CustomerOption key={String(c.value)} customer={c} last={i === r.results.length - 1} onPress={() => r.handleSelectCustomer(c)} />
                    ))}
                  </ScrollView>
                )}
              </View>
            </>
          )}

          <HomeSectionHeader title="Thông tin phiếu" />
          <View style={styles.card}>
            <SelectField
              label="Công ty bán hàng"
              required={!!r.salesCompanyRequired}
              variant="soft"
              disabled={!!r.salesCompanyLocked}
              value={r.congTyBanHangId ? String(r.congTyBanHangId) : r.salesCompanyLocked || r.salesCompanyRequired ? null : NONE}
              options={companyOptions}
              onChange={(v) => r.handleChangeCongTyBanHang(v === NONE ? null : String(v))}
              placeholder="Chọn công ty bán hàng"
              sheetTitle="Chọn công ty bán hàng"
            />
            {companyReason ? <Hint text={companyReason} /> : null}
            <SelectField
              label="Đại lý phân phối"
              variant="soft"
              disabled={!!r.agencyLocked}
              value={r.maSan ? String(r.maSan) : r.agencyLocked ? null : NONE}
              options={agencyOptions}
              onChange={(v) => r.setMaSan(v === NONE ? "" : String(v))}
              placeholder={noAgencyHint ? "Công ty bán hàng chưa có đại lý phân phối" : "Chọn đại lý phân phối"}
              sheetTitle="Chọn đại lý phân phối"
            />
            {r.agencyLocked ? <Hint text={AGENCY_FIXED_REASON} /> : noAgencyHint ? <Hint text="Công ty bán hàng chưa có đại lý phân phối" /> : null}
          </View>

          <HomeSectionHeader title="Chính sách & cấu hình bán hàng" />
          <View style={styles.card}>
            <Hint text="Chỉ lưu lựa chọn để dùng lại khi lên phiếu đặt cọc / hợp đồng" />
            {r.policyTienBooking ? <Hint text={`Tiền booking theo chính sách: ${formatVND(r.policyTienBooking)}`} /> : null}
            <SelectField
              label="Quỹ căn"
              variant="soft"
              disabled={!!r.unitFund.locked}
              value={r.unitFund.quyCanId ? String(r.unitFund.quyCanId) : null}
              options={(r.unitFund.funds || []).map((q: any) => ({ value: String(q.id), label: q.name }))}
              onChange={(v) => v && r.unitFund.change(String(v))}
              placeholder="-- Chọn quỹ căn --"
              sheetTitle="Chọn quỹ căn"
            />
            {r.unitFund.locked && r.unitFund.lockReason ? <Hint text={r.unitFund.lockReason} /> : null}
            <SelectField
              label="Chính sách bán hàng"
              variant="soft"
              loading={!!r.salesConfig.loading}
              value={r.policyId ? String(r.policyId) : NONE}
              options={policyOptions}
              onChange={(v) => r.handleSelectPolicy(v === NONE ? undefined : String(v))}
              sheetTitle="Chọn chính sách bán hàng"
            />
            <SelectField
              label="Bảng giá"
              variant="soft"
              loading={!!r.salesConfig.loading}
              value={r.priceListId ? String(r.priceListId) : NONE}
              options={priceListOptions}
              onChange={(v) => r.changePriceList(v === NONE ? undefined : String(v))}
              sheetTitle="Chọn bảng giá"
            />
          </View>

          <HomeSectionHeader title="Giá sản phẩm theo bảng giá" />
          <View style={styles.card}>
            <Hint text={r.priceListId ? "Giá lấy từ bảng giá đang chọn (chỉ để xem)" : "Chọn bảng giá để xem giá sản phẩm"} />
            {r.loadingPriceInfo ? (
              <SkeletonList count={2} />
            ) : (
              <View style={styles.grid}>
                {(r.priceInfoItems || []).map((it: any) => (
                  <View key={it.label} style={styles.gridItem}>
                    <Text variant="caption" color="textSecondary" numberOfLines={1}>
                      {it.label}
                    </Text>
                    <Text variant="label" numeric numberOfLines={1}>
                      {prettyPriceValue(it.label, it.value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Screen>
    </>
  );
}

/**
 * Số trong khối giá (chuỗi đã định dạng kiểu web "97.419.750,893") ⇒ dễ đọc: tiền làm tròn đồng + "₫", diện tích + "m²".
 * Chuỗi không phải số (vd "—") giữ nguyên.
 */
function prettyPriceValue(label: string, value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^-?[\d.]+(,\d+)?$/.test(raw)) return raw || "—";
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  if (/diện tích/i.test(label)) return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} m²`;
  return `${Math.round(n).toLocaleString("vi-VN")} ₫`;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="label" numeric numberOfLines={1} style={styles.metaValue}>
        {value}
      </Text>
    </View>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <Text variant="caption" color="textSecondary">
      {text}
    </Text>
  );
}

function CustomerOption({ customer, last, onPress }: { customer: any; last: boolean; onPress: () => void }) {
  const sub = [customer.soCMND, maskPhone(customer.diDong)].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${customer.tenKH || "Khách hàng"}${sub ? ", " + sub : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.option, last ? styles.optionLast : null, pressed ? styles.optionPressed : null]}
    >
      <Avatar name={customer.tenKH || "?"} size={40} round />
      <View style={styles.flex}>
        <Text variant="subhead" numberOfLines={1}>
          {customer.tenKH || "(Chưa có tên)"}
        </Text>
        {sub ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.radio} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  pill: { borderRadius: radius.full },
  unit: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg + 2,
    paddingVertical: space.lg,
    borderRadius: radius.x3,
    backgroundColor: colors.showcase.bg,
    ...elevation.soft,
  },
  unitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.showcase.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { padding: space.lg, gap: space.md, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  metaValue: { flexShrink: 1, textAlign: "right" },
  customerCard: { borderRadius: radius.xxl, overflow: "hidden", backgroundColor: colors.surface, ...elevation.soft },
  selectedRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, backgroundColor: colors.primarySubtle },
  clear: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  emptyWrap: { paddingVertical: space.lg },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 64,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionLast: { borderBottomWidth: 0 },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.md },
  gridItem: { width: "50%", paddingRight: space.sm, gap: 2 },
  footer: { flex: 1, gap: space.sm },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
