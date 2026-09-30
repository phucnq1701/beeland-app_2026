import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Building2, UserPlus, UserX } from "lucide-react-native";

import {
  AppHeader,
  Avatar,
  BottomActionBar,
  Button,
  Card,
  EmptyState,
  Screen,
  SearchBar,
  SectionHeader,
  SelectField,
  SkeletonList,
  Text,
  useToast,
} from "@/components/ui";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { formatVND, formatVNDShort, maskPhone } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, radius, space } from "@/theme";
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
  const initialNewCustomer = parseJsonParam(
    newCustomer
  ) as BookingCustomer | null;
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
      setCreatingBooking(true);

      // Payload theo chuẩn BookingService.createBooking
      const initDataBooking = {
        MaSP: bookingData?.MaSP,
        SanPhamId: bookingData?.id ?? bookingData?.Id ?? null,
        KyHieu: bookingData?.KyHieu,
        MaSan: selectedSan?.ID || selectedSan?.MaSan || null,
        TenSan: selectedSan?.TenSan || null,
        MaKhu: bookingData?.MaKhu || null,
        TenKhu: bookingData?.TenKhu || null,
        MaDA: bookingData?.MaDA,
        TenDA: bookingData?.TenDA,
        TongGiaGomPBT: bookingData?.TongGiaTriHDMB ?? bookingData?.TongGomPBT ?? 0,

        DTThongThuy: bookingData?.DTThongThuy || bookingData?.DienTichThongThuy || 0,
        DonGiaTT: bookingData?.DonGiaThongThuy || bookingData?.DonGia || 0,
        TongGiaGomVAT: bookingData?.TongGiaGomVAT ?? bookingData?.TongGiaTriHDMB ?? 0,
        PhiBaoTri: bookingData?.PhiBaoTri ?? bookingData?.TienPhiBaoTri ?? 0,

        DienTichDat: bookingData?.DienTichDat || 0,
        DonGiaDat: bookingData?.DonGiaDat || 0,
        TongGiaDat: bookingData?.ThanhTienDat || bookingData?.TongGiaDat || 0,

        DienTichXD: bookingData?.DienTichXD || 0,
        DonGiaXD: bookingData?.DonGiaXD || 0,
        ThanhTienXD: bookingData?.ThanhTienXD || 0,

        MaKH: selectedCustomer.maKH,
        TenKH: selectedCustomer.tenKH,
        DiDong: selectedCustomer.diDong,
        Email: selectedCustomer.email || "",
      };

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

  const unitPrice = bookingData?.TongGiaTriHDMB ?? bookingData?.TongGomPBT ?? bookingData?.TongGiaGomVAT;
  const holdAmount = bookingData?.TienGiuCho ?? bookingData?.TienBooking ?? null;

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
        header={<AppHeader title="Tạo booking" />}
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
                title="Tạo booking"
                loading={creatingBooking}
                onPress={handleContinue}
              />
            </View>
          </BottomActionBar>
        }
      >
        {/* Căn đang booking – ghim trên cùng để không mất ngữ cảnh */}
        <Card>
          <View style={styles.unit}>
            <View style={styles.unitIcon}>
              <Building2 size={22} color={colors.showcase.accent} />
            </View>
            <View style={styles.flex}>
              <Text variant="subhead" numberOfLines={1}>
                {bookingData?.KyHieu || "Sản phẩm"}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {bookingData?.TenDA || "—"}
              </Text>
            </View>
            {unitPrice ? (
              <Text variant="subhead" numeric>
                {formatVNDShort(unitPrice)}
              </Text>
            ) : null}
          </View>
        </Card>

        <SectionHeader title="Khách hàng *" />
        {customerError ? (
          <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
            {customerError}
          </Text>
        ) : null}
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Tên, SĐT hoặc mã KH" />

        <View style={styles.customerList}>
          {loading && customers.length === 0 ? (
            <Card padding={0}>
              <SkeletonList count={4} />
            </Card>
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

        <Button variant="ghost" icon={UserPlus} title="Thêm khách hàng mới" onPress={openNewCustomer} style={styles.addButton} />

        <SelectField
          label="Sàn giao dịch"
          sheetTitle="Chọn sàn giao dịch"
          value={selectedSan ? selectedSan.ID || selectedSan.MaSan : NO_SAN}
          options={sanOptions}
          loading={loadingSan}
          onChange={(v) =>
            handleSelectSan(v === NO_SAN ? null : sanList.find((s) => (s.ID || s.MaSan) === v) ?? null)
          }
        />
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
      <Avatar name={customer.tenKH || "?"} />
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
      <View style={[styles.radio, selected ? styles.radioOn : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  unit: { flexDirection: "row", alignItems: "center", gap: space.md },
  unitIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.showcase.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  customerList: { gap: space.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: space.md - 1,
  },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioOn: { borderWidth: 6, borderColor: colors.primary },
  addButton: { alignSelf: "flex-start" },
  footer: { flex: 1, gap: space.sm },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
