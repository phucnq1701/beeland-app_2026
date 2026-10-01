import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Building2, Check, UserPlus, UserX } from "lucide-react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";

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
  useToast,
} from "@/components/ui";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { formatVND, formatVNDShort, maskPhone } from "@/lib/format";
import { buildBookingPayload } from "@/lib/bookingPayload";
import { BookingSalesConfig, pickPrice, policyBookingAmount } from "@/lib/bookingPrice";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, elevation, radius, space } from "@/theme";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { CustomerService as CustomerSupabaseService } from "@/sevicesSupabase/CustomerService";
import { ProductService } from "@/sevicesSupabase/ProductService";

type BookingCustomer = {
  id?: string;
  maKH: string;
  tenKH: string;
  diDong: string;
  type?: string;
  company?: string | null;
  email?: string;
  cccd?: string;
  diaChi?: string;
  taxCode?: string;
  status?: string;
};

type SanGiaoDich = {
  ID: string;
  MaSan: string;
  MaCT?: string;
  TenSan: string;
  TenCT?: string;
  DiaChi?: string;
  DienThoai?: string;
  Email?: string;
};

/** Giá trị "không qua sàn" trong SelectField (sàn là tuỳ chọn). */
const NO_SAN = "__none__";

function parseJsonParam(value: unknown) {
  if (!value || Array.isArray(value)) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function normalizeCustomer(item: any): BookingCustomer {
  const raw = item?.raw || {};
  const isBusiness =
    item?.type === "business" ||
    item?.is_personal === false ||
    raw?.is_personal === false;

  return {
    id: item?.id ?? raw?.id ?? "",
    // Quy chuẩn: query theo id (uuid). Ưu tiên UUID thật; chỉ fallback về
    // ma_so_kh (vd "KH-00006") khi chưa có id — BookingService sẽ tự resolve
    // uuid từ ma_so_kh.
    maKH: String(
      item?.id && String(item.id).includes("-")
        ? item.id
        : raw?.id && String(raw.id).includes("-")
          ? raw.id
          : item?.ma_kh ?? raw?.MaKH ?? item?.id ?? raw?.id ?? ""
    ),
    tenKH: (item?.ho_ten ?? raw?.TenKH ?? item?.ten_kh ?? raw?.ten_kh ?? "")
      .toString()
      .trim(),
    diDong: String(item?.dien_thoai ?? raw?.DiDong ?? item?.di_dong ?? ""),
    email: String(item?.email ?? raw?.Email ?? ""),
    cccd: String(item?.cccd ?? raw?.SoCMND ?? ""),
    diaChi: String(item?.dia_chi ?? raw?.DiaChi ?? ""),
    company: raw?.TenCongTy ?? item?.ten_cong_ty ?? null,
    taxCode: String(item?.taxCode ?? raw?.MaSoThue ?? ""),
    type: isBusiness ? "business" : "personal",
    status: item?.status ?? raw?.status ?? "",
  };
}

const customerKey = (c: BookingCustomer) => c.maKH || c.id || c.tenKH;

export default function CreateBookingScreen() {
  const router = useRouter();
  const toast = useToast();
  const { dataBooking, newCustomer } = useLocalSearchParams();

  const bookingData = parseJsonParam(dataBooking);
  // KH vừa tạo ở customer/new (bản ghi cloud_customers) → chuẩn hoá về BookingCustomer
  const parsedNewCustomer = parseJsonParam(newCustomer);
  const initialNewCustomer = parsedNewCustomer ? normalizeCustomer(parsedNewCustomer) : null;
  const bookingParam = typeof dataBooking === "string" ? dataBooking : "";

  const [selectedCustomer, setSelectedCustomer] =
    useState<BookingCustomer | null>(initialNewCustomer);
  const [selectedSan, setSelectedSan] = useState<SanGiaoDich | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [dataKH, setDataKH] = useState<BookingCustomer[]>([]);
  const [sanList, setSanList] = useState<SanGiaoDich[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSan, setLoadingSan] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  // Chặn gửi trùng ngay cả khi người dùng bấm 2 lần trước khi màn kịp vẽ lại
  const submitting = useRef(false);

  // Bảng giá / chính sách web tự chọn cho căn này (giá booking lấy theo bảng giá, thiếu thì giá sản phẩm)
  const [salesConfig, setSalesConfig] = useState<BookingSalesConfig | null>(null);
  const salesConfigTask = useRef<Promise<BookingSalesConfig> | null>(null);
  const loadSalesConfig = () => {
    if (!salesConfigTask.current) {
      salesConfigTask.current = BookingService.getBookingSalesConfig(bookingData);
      void salesConfigTask.current.then(setSalesConfig);
    }
    return salesConfigTask.current;
  };
  useEffect(() => {
    void loadSalesConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quay về từ customer/new (router.dismissTo giữ nguyên màn này, chỉ đổi param) → chọn KH mới
  useEffect(() => {
    if (!newCustomer) return;
    const parsed = parseJsonParam(newCustomer);
    if (parsed) {
      setSelectedCustomer(normalizeCustomer(parsed));
      setCustomerError(null);
    }
  }, [newCustomer]);

  // Lấy danh sách sàn giao dịch từ dm_companies (is_san=true)
  const loadSanList = async () => {
    setLoadingSan(true);
    try {
      const res = await ProductService.getSanGiaoDichAPI();
      const list: SanGiaoDich[] = Array.isArray(res?.data) ? res.data : [];
      setSanList(list);

      // Nếu sản phẩm hoặc bookingData đã chỉ định sàn thì auto select
      const spMaSan = bookingData?.MaSan || bookingData?.ma_san || bookingData?.san_giao_dich;
      if (spMaSan && list.length > 0) {
        const found = list.find(
          (s) =>
            s.ID === spMaSan ||
            s.MaSan === spMaSan ||
            s.TenSan?.toLowerCase() === String(spMaSan).toLowerCase()
        );
        if (found) {
          setSelectedSan(found);
        }
      }
    } catch (error) {
      console.log("Error loading san giao dich:", error);
    } finally {
      setLoadingSan(false);
    }
  };

  const handleSelectCustomer = (customer: BookingCustomer) => {
    setSelectedCustomer(customer);
    setCustomerError(null);
  };

  const handleSelectSan = (san: SanGiaoDich | null) => {
    setSelectedSan(san);
  };

  const handleContinue = async () => {
    // Sàn của sản phẩm được tự chọn khi danh sách sàn tải xong → chờ để không gửi MaSan rỗng
    if (submitting.current || loadingSan) return;
    if (!selectedCustomer) {
      setCustomerError("Vui lòng chọn khách hàng");
      hapticError();
      return;
    }
    if (!selectedCustomer.maKH) {
      setCustomerError("Khách hàng chưa có mã để ghép vào booking");
      hapticError();
      return;
    }

    try {
      submitting.current = true;
      setCreatingBooking(true);

      // Payload theo chuẩn BookingService.createBooking (trường giá như web)
      const sales = salesConfig ?? (await loadSalesConfig());
      const initDataBooking = buildBookingPayload(bookingData, selectedCustomer, selectedSan, sales);

      const resultBooking = await BookingService.createBooking(initDataBooking);

      if (resultBooking?.status === 2000) {
        hapticSuccess();
        toast.show({
          type: "success",
          message: `Đã tạo booking cho ${selectedCustomer.tenKH || "khách hàng"}`,
        });
        // Vào thẳng chi tiết booking vừa tạo để thu tiền luôn (spec D8)
        if (resultBooking?.id) {
          router.replace({
            pathname: "/booking/[id]",
            params: { id: String(resultBooking.id) },
          });
        } else {
          router.replace("/bookings");
        }
      } else {
        hapticError();
        toast.show({ type: "error", message: resultBooking?.message || "Không thể tạo booking" });
      }
    } catch (error: any) {
      console.log("createBooking error:", error);
      hapticError();
      toast.show({ type: "error", message: error?.message || "Không thể tạo booking" });
    } finally {
      submitting.current = false;
      setCreatingBooking(false);
    }
  };

  const loadData = async (search = "") => {
    setLoading(true);
    try {
      const res = await CustomerSupabaseService.getCustomers({ search });
      const list = Array.isArray(res?.data) ? res.data : [];
      setDataKH(list.map((customer) => normalizeCustomer(customer)));
    } catch (error) {
      console.log("ERROR getCustomers:", error);
      setDataKH([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingData) {
      const statusName = String(
        bookingData?.TenTT ||
        bookingData?.ten_tt ||
        bookingData?.TrangThai ||
        bookingData?.status ||
        ""
      )
        .toLowerCase()
        .trim();
      const isBooking =
        statusName.includes("booking") ||
        statusName.includes("chờ duyệt") ||
        statusName.includes("cho duyet") ||
        statusName.includes("đã book") ||
        statusName.includes("da book") ||
        statusName.includes("giữ chỗ") ||
        statusName.includes("giu cho") ||
        String(bookingData?.MaTT) === "5" ||
        String(bookingData?.MaTT) === "6";

      // Lỗi chặn → giữ Alert (spec 4.5)
      if (isBooking) {
        Alert.alert(
          "Thông báo",
          "Sản phẩm này đã có người booking rồi, người sau không được phép booking nữa.",
          [
            {
              text: "Quay lại",
              onPress: () => router.back(),
            },
          ]
        );
      }
    }

    loadSanList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tải danh sách KH lúc mở màn và mỗi khi từ khoá đứng yên 300ms
  useEffect(() => {
    loadData(debouncedQuery);
  }, [debouncedQuery]);

  // KH vừa tạo mới (quay về từ customer/new) có thể chưa nằm trong kết quả tìm kiếm → ghim lên đầu
  const customers = useMemo(() => {
    if (!selectedCustomer) return dataKH;
    const inList = dataKH.some((c) => customerKey(c) === customerKey(selectedCustomer));
    return inList ? dataKH : [selectedCustomer, ...dataKH];
  }, [dataKH, selectedCustomer]);

  const sanOptions = useMemo(
    () => [
      { value: NO_SAN, label: "Không qua sàn" },
      ...sanList.map((s) => ({ value: s.ID || s.MaSan, label: s.TenSan, description: s.DiaChi || undefined })),
    ],
    [sanList]
  );

  const productPrice = bookingData?.TongGiaTriHDMB ?? bookingData?.TongGomPBT ?? bookingData?.TongGiaGomVAT;
  // Giá hiển thị = giá sẽ ghi vào booking (bảng giá trước, như web)
  const unitPrice = salesConfig?.priceItem ? pickPrice(salesConfig.priceItem.TongGiaGomPBT, productPrice) : productPrice;
  const holdAmount =
    policyBookingAmount(salesConfig?.policy ?? null) ?? bookingData?.TienGiuCho ?? bookingData?.TienBooking ?? null;

  const openNewCustomer = () => {
    const params: Record<string, string> = { returnToBooking: "1" };
    if (bookingParam) params.dataBooking = bookingParam;
    router.push({ pathname: "/customer/new", params });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        keyboardAware
        padded={false}
        header={<AppHeader variant="soft" title="Tạo booking" />}
        footer={
          <BottomActionBar>
            <View style={styles.footer}>
              {holdAmount ? (
                <View style={styles.footerRow}>
                  <Text variant="caption" color="textSecondary">
                    Tiền giữ chỗ
                  </Text>
                  <Text variant="subhead" numeric>
                    {formatVND(holdAmount)}
                  </Text>
                </View>
              ) : null}
              <Button
                size="lg"
                fullWidth
                style={styles.pill}
                title={loadingSan ? "Đang tải sàn giao dịch…" : "Tạo booking"}
                loading={creatingBooking}
                disabled={loadingSan}
                onPress={handleContinue}
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
                {bookingData?.KyHieu || "Sản phẩm"}
              </Text>
              <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
                {bookingData?.TenDA || "—"}
              </Text>
            </View>
            {unitPrice ? (
              <Text variant="heading" color={colors.showcase.accent} numeric>
                {formatVNDShort(unitPrice)}
              </Text>
            ) : null}
          </View>

          <HomeSectionHeader title="Khách hàng *" />
          {customerError ? (
            <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
              {customerError}
            </Text>
          ) : null}
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Tên, SĐT hoặc mã KH" variant="soft" />

          <View style={styles.customerList}>
            {loading && customers.length === 0 ? (
              <View style={styles.skeletonCard}>
                <SkeletonList count={4} />
              </View>
            ) : customers.length === 0 ? (
              <EmptyState icon={UserX} title="Không tìm thấy khách hàng" description="Thử từ khoá khác hoặc thêm khách hàng mới." />
            ) : (
              customers.map((customer) => {
                const selected = !!selectedCustomer && customerKey(selectedCustomer) === customerKey(customer);
                return (
                  <CustomerOption
                    key={customerKey(customer)}
                    customer={customer}
                    selected={selected}
                    onPress={() => handleSelectCustomer(customer)}
                  />
                );
              })
            )}
          </View>

          <Button
            variant="ghost"
            icon={UserPlus}
            title="Thêm khách hàng mới"
            onPress={openNewCustomer}
            style={[styles.addButton, styles.pill]}
          />

          <SelectField
            label="Sàn giao dịch"
            sheetTitle="Chọn sàn giao dịch"
            value={selectedSan ? selectedSan.ID || selectedSan.MaSan : NO_SAN}
            options={sanOptions}
            loading={loadingSan}
            onChange={(v) =>
              handleSelectSan(v === NO_SAN ? null : sanList.find((s) => (s.ID || s.MaSan) === v) ?? null)
            }
            variant="raised"
          />
        </View>
      </Screen>
    </>
  );
}

function CustomerOption({
  customer,
  selected,
  onPress,
}: {
  customer: BookingCustomer;
  selected: boolean;
  onPress: () => void;
}) {
  const sub = [maskPhone(customer.diDong), customer.company].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${customer.tenKH}${sub ? ", " + sub : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed && !selected ? styles.optionPressed : null,
      ]}
    >
      <Avatar name={customer.tenKH || "?"} size={44} round />
      <View style={styles.flex}>
        <Text variant="subhead" numberOfLines={1}>
          {customer.tenKH || "—"}
        </Text>
        {sub ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, selected ? styles.radioOn : null]}>
        {selected ? <Check size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
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
  skeletonCard: { borderRadius: radius.xxl, overflow: "hidden", backgroundColor: colors.surface },
  customerList: { gap: space.sm + 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    borderRadius: radius.xxl,
    // Viền luôn dày 2 (trong suốt khi chưa chọn) → chọn không làm nội dung nhảy
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
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
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  addButton: { alignSelf: "flex-start" },
  footer: { flex: 1, gap: space.sm },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
