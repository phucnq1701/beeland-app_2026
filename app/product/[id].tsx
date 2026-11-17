import React, { useState, useEffect, useRef, useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, ChevronLeft, Lock, MapPin, PackageX } from "lucide-react-native";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { FocusStatusBar } from "@/components/ui/FocusStatusBar";
import { PriceBreakdown } from "@/components/product/PriceBreakdown";
import {
  BottomActionBar,
  Button,
  Card,
  EmptyState,
  IconButton,
  KeyValueRow,
  SkeletonDetail,
  StatusBadge,
  Text,
  useToast,
} from "@/components/ui";
import { formatCountdown } from "@/lib/countdown";
import { formatArea, formatVNDShort } from "@/lib/format";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { isFeatureAllowed, PRICE_SHEET_CREATE_LOCKED } from "@/lib/featureConfig";
import { isOpenForSale, OPEN_FOR_SALE_MESSAGE } from "@/lib/productStatus";
import { colors, elevation, radius, space } from "@/theme";
import { BookingService } from "@/services/BookingService";
import { getSessionInfo } from "@/services/session";
import { ProductService } from "@/services/ProductService";
import { PriceServices, ActivePriceListItem } from "@/services/PriceServices";

/** Ảnh dùng khi sản phẩm chưa có ảnh (ảnh mặc định của dự án). */
const DEFAULT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

export default function ProductDetailScreen() {
  const { id, lockMinutes } = useLocalSearchParams<{
    id?: string;
    lockMinutes?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [locking, setLocking] = useState<boolean>(false);
  const lockInFlight = useRef(false);
  // Chặn bấm "Tạo booking" 2 lần mở 2 màn tạo booking
  const navigating = useRef(false);

  // Lock theo MỐC hết hạn (giờ máy) — không đếm lùi rời rạc: tránh lúc vừa vào màn bị coi là "đã hết" rồi tắt nhầm lock
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const remainingSeconds = lockUntil ? Math.max(0, Math.ceil((lockUntil - nowMs) / 1000)) : 0;
  const isLocked = !!lockUntil && remainingSeconds > 0;
  const sweeping = useRef(false);
  // Phiếu lock do CHÍNH người dùng vừa tạo ở màn này ⇒ cho tạo booking ngay từ lock (như màn Căn đã lock)
  const [myLockId, setMyLockId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  // Lập phiếu tính giá (tính năng 17): chỉ tài khoản nội bộ có quyền ADD
  // Quyền ADD của /products/price-sheet do API chi tiết căn trả (perms.priceSheet) — không gọi riêng nữa.
  const [canPriceSheet, setCanPriceSheet] = useState(false);
  // Quyền nút giao dịch theo nhóm quyền như web (useProductTxPerm: LOCK / BOOKING của /products/high-rise | low-rise).
  // Chưa tải / lỗi ⇒ ẩn nút (fail-closed như web).
  const [txPerm, setTxPerm] = useState<{ lock: boolean; booking: boolean } | null>(null);
  const [isAgencyAccount, setIsAgencyAccount] = useState<boolean | null>(null);
  useEffect(() => {
    getSessionInfo()
      .then((s) => setIsAgencyAccount(s.isAgency))
      .catch(() => setIsAgencyAccount(null));
  }, []);
  const [bannerProduct, setBannerProduct] = useState<{ HinhAnh?: string }[]>([]);
  // Bảng giá đang hiệu lực (price_list_items qua RPC get_active_price_for_product)
  const [activePrice, setActivePrice] = useState<ActivePriceListItem | null>(null);
  const [priceLoading, setPriceLoading] = useState<boolean>(false);

  const getBannerProduct = async () => {
    const result = await ProductService.getBannerProduct({ maSP: id });
    setBannerProduct(result.data ?? []);
  };

  // Giá đang hiệu lực theo bảng giá (RPC get_active_price_for_product).
  // Không có bảng giá → activePrice = null, UI fallback về giá trên sản phẩm.
  const getActivePrice = async (product: any) => {
    setPriceLoading(true);
    try {
      const result = await PriceServices.getActivePriceForProduct({
        productId: product?.ID,
        maSP: product?.MaSP ?? id,
      });
      setActivePrice(result.data);
    } finally {
      setPriceLoading(false);
    }
  };

  const getProducts = async () => {
    setLoading(true);
    const result = await ProductService.getDetailProducts({ maSP: id, fresh: true });
    if ((result as any)?.error) toast.show({ type: "error", message: (result as any).error });
    setCanPriceSheet(!!result?.perms?.priceSheet);
    if (result?.perms) setTxPerm({ lock: !!result.perms.lock, booking: !!result.perms.booking });
    if (result?.data) {
      const seconds = result.data.ThoiGianConLai || 0;

      setData(result.data);

      // Ưu tiên bảng giá: lấy giá hiệu lực theo sản phẩm (không chặn UI chính)
      void getActivePrice(result.data);

      // Trạng thái lock luôn theo máy chủ (còn hạn ⇒ mốc mới; hết / không có ⇒ bỏ)
      setLockUntil(seconds > 0 ? Date.now() + seconds * 1000 : null);
      setNowMs(Date.now());
    }
    setLoading(false);
  };

  useEffect(() => {
    getBannerProduct();
    getProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khi quay lại màn (từ booking/lock/…): tải lại trạng thái mới nhất
  // (lock còn hiệu lực, trạng thái SP) mà không cần thoát ra vào lại.
  // Bỏ qua lần focus đầu vì effect trên đã load.
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      navigating.current = false;
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      void getProducts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    if (lockMinutes) {
      const minutes = parseInt(lockMinutes, 10);
      if (!isNaN(minutes) && minutes > 0) {
        setLockUntil(Date.now() + minutes * 60 * 1000);
        setNowMs(Date.now());
      }
    }
  }, [lockMinutes]);

  // Đồng hồ: chỉ chạy khi có mốc lock. Quá mốc ⇒ quét hết hạn 1 lần rồi nạp lại trạng thái từ máy chủ
  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);
  useEffect(() => {
    if (!lockUntil || remainingSeconds > 0 || sweeping.current) return;
    sweeping.current = true;
    void (async () => {
      try {
        await BookingService.sweepExpiredLocks();
        await getProducts();
      } finally {
        sweeping.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockUntil, remainingSeconds]);

  const back = (
    <View style={[styles.back, { top: insets.top + space.sm }]}>
      <IconButton icon={ChevronLeft} variant="glass" accessibilityLabel="Quay lại" onPress={() => router.back()} />
    </View>
  );

  if (loading && !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, { paddingTop: insets.top + 56 }]}>
          <SkeletonDetail />
          {back}
        </View>
      </>
    );
  }

  if (!loading && !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="product-not-found">
          <EmptyState icon={PackageX} title="Không tìm thấy sản phẩm" actionLabel="Quay lại" onAction={() => router.back()} />
        </View>
      </>
    );
  }

  const statusName = String(
    data?.TenTT || data?.ten_tt || data?.TrangThai || data?.status || data?.tt?.item_name || ""
  ).trim();
  // Như web (isOpenForSale): chỉ căn "Mở bán" (mã 2) mới được Lock / Booking.
  // Mã số cũ (nếu có) được ưu tiên, không thì theo tên trạng thái.
  const legacyCode = String(data?.ma_tt ?? data?.MaTT ?? "").trim();
  const canTransact = /^\d+$/.test(legacyCode) ? isOpenForSale(legacyCode) : isOpenForSale(statusName);

  const handleLock = async () => {
    if (isLocked || !canTransact || !txPerm?.lock || lockInFlight.current) return;
    lockInFlight.current = true;
    setLocking(true);
    try {
      // 1 lời gọi máy chủ (fn_nv_app_lock_tao): phút lock, số phiếu, 2 ⇒ 18 + phiếu LOCK cùng giao dịch
      const res = await BookingService.createLock({ sanPhamId: data?.ID, maSP: id });

      if (res?.status === 2000) {
        const seconds = res?.data || 0;

        if (seconds > 0) {
          setLockUntil(Date.now() + seconds * 1000);
          setNowMs(Date.now());
        }
        setMyLockId((res as any)?.lockId ?? null);
        hapticSuccess();
        toast.show({ type: "success", message: `Đã lock căn ${data?.KyHieu ?? ""}`.trim() });
        // Tải lại để cập nhật trạng thái SP (Đã Lock)
        await getProducts();
      } else {
        hapticError();
        toast.show({ type: "error", message: (res as any)?.message || "Không lock được căn này" });
      }
    } catch (err) {
      console.log("Lock error", err);
      hapticError();
      toast.show({ type: "error", message: "Không lock được căn này" });
    } finally {
      lockInFlight.current = false;
      setLocking(false);
    }
  };

  // Lập phiếu tính giá (tính năng 17): chỉ tài khoản được dùng tính năng + có quyền ADD
  // Tạm khoá lập phiếu trên app (2026-11-16) tới khi form khớp web ⇒ ẩn lối vào; bật lại: bỏ `PRICE_SHEET_CREATE_LOCKED`
  const showPriceSheet = !PRICE_SHEET_CREATE_LOCKED && canPriceSheet && isAgencyAccount !== null && isFeatureAllowed("17", isAgencyAccount);
  const images = bannerProduct.map((b) => b?.HinhAnh).filter((u): u is string => !!u);
  // Giá đầu màn: giá trị HĐMB của căn; căn chưa có giá riêng ⇒ tổng theo bảng giá đang áp dụng (cùng số ở "Chi tiết giá")
  const listPrice = Number(activePrice?.contract_total_value) > 0 ? Number(activePrice?.contract_total_value)
    : Number(activePrice?.total_payment) > 0 ? Number(activePrice?.total_payment) : 0;
  const heroPrice = Number(data?.TongGiaTriHDMB) > 0 ? Number(data.TongGiaTriHDMB) : listPrice;
  const price = heroPrice > 0 ? formatVNDShort(heroPrice) : "Liên hệ";
  const txt = (v: unknown) => {
    const t = String(v ?? "").trim();
    return t && t !== "0" ? t : null;
  };
  const unitRows = (
    [
      ["Loại sản phẩm", txt(data?.LoaiBDS)],
      ["Loại căn", txt(data?.TenLoaiCanHo)],
      ["Phòng ngủ", txt(data?.TenLoaiPN) ?? (Number(data?.SoPN) > 0 ? `${Number(data.SoPN)} PN` : null)],
      ["Tòa / khu", txt(data?.TenKhu)],
      ["Tầng", txt(data?.TenTang)],
      ["Vị trí", txt(data?.TenViTri)],
      ["Hướng cửa", txt(data?.TenHuongCua)],
      ["Hướng ban công", txt(data?.TenHuongBC)],
      ["View", txt(data?.TenView)],
      ["Diện tích thông thủy", Number(data?.DienTichThongThuy) > 0 ? formatArea(data.DienTichThongThuy) : null],
      ["Diện tích tim tường", Number(data?.DTTimDuong) > 0 ? formatArea(data.DTTimDuong) : null],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => !!r[1]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="light" />
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View testID="product-hero">
            <ImageCarousel
              images={images}
              fallback={DEFAULT_IMAGE}
              height={HERO_HEIGHT + insets.top}
              bottomInset={SHEET_OVERLAP}
            />
          </View>

          {/* Khối nội dung bo góc trên trồi đè lên đáy ảnh: tên dự án, ký hiệu căn, giá */}
          <View style={styles.sheet}>
            <View style={styles.hero}>
              <View style={styles.topRow}>
                <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
                  {data?.TenDA || "Dự án"}
                </Text>
                {/* Tag trạng thái: nền theo color_code của trạng thái, như ô ngoài lưới */}
                {statusName ? <StatusBadge label={statusName} color={data?.ColorTT || data?.MauNen} /> : null}
              </View>
              <Text variant="title" accessibilityRole="header" style={styles.code}>
                {data?.KyHieu ? `Căn ${data.KyHieu}` : "Sản phẩm"}
              </Text>
              <Text variant="display" color="primary" numeric>
                {price}
              </Text>
              {/* Địa chỉ trùng tên dự án (dòng ngay trên) ⇒ bỏ cho đỡ lặp */}
              {data?.DiaChi && String(data.DiaChi).trim().toLowerCase() !== String(data?.TenDA ?? "").trim().toLowerCase() ? (
                <View style={styles.place}>
                  <MapPin size={16} color={colors.textSecondary} strokeWidth={2} />
                  <Text variant="caption" color="textSecondary" style={styles.flex}>
                    {data.DiaChi}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.content}>
              {!canTransact ? (
                <Text variant="caption" color="textSecondary">
                  {isLocked
                    ? myLockId
                      ? "Bạn vừa lock căn này — tạo booking trước khi hết giờ lock."
                      : "Căn đang được lock. Nếu bạn là người lock, tạo booking ở mục Căn đã lock."
                    : `${OPEN_FOR_SALE_MESSAGE} – căn đang ở trạng thái “${statusName || "không xác định"}”.`}
                </Text>
              ) : null}

              {/* Thông tin căn nhân viên hay được khách hỏi (dữ liệu có sẵn từ fn_nv_app_san_pham_chi_tiet) — chỉ dòng có dữ liệu */}
              {unitRows.length ? (
                <>
                  <HomeSectionHeader title="Thông tin căn" />
                  <Card style={styles.card}>
                    {unitRows.map(([label, value], i) => (
                      <KeyValueRow key={label} label={label} value={value} last={i === unitRows.length - 1} />
                    ))}
                  </Card>
                </>
              ) : null}

              <HomeSectionHeader
                title="Chi tiết giá"
                actionLabel={showPriceSheet && data?.ID ? "Lập phiếu tính giá" : undefined}
                onAction={() => router.push({ pathname: "/price-sheet/new", params: { productId: String(data?.ID) } })}
              />
              <Card style={styles.card}>
                <PriceBreakdown activePrice={activePrice} data={data} loading={priceLoading} />
              </Card>
            </View>
          </View>
        </ScrollView>
        {back}

        {isLocked || txPerm?.lock || (txPerm?.booking && data?.isHienThiBook) ? (
        <BottomActionBar>
          {isLocked ? (
            <View style={styles.lockTimer} accessible accessibilityLabel={`Đang lock, còn ${formatCountdown(remainingSeconds)}`}>
              <Lock size={18} color={colors.onWarningSubtle} />
              <Text variant="subhead" numeric color="onWarningSubtle">
                {formatCountdown(remainingSeconds)}
              </Text>
            </View>
          ) : txPerm?.lock ? (
            <Button
              variant="secondary"
              icon={Lock}
              title="Lock căn"
              loading={locking}
              disabled={!canTransact}
              style={styles.pill}
              onPress={() => void handleLock()}
            />
          ) : null}
          {isLocked && txPerm?.booking ? (
            <Button
              size="lg"
              icon={CalendarPlus}
              title={myLockId ? "Tạo booking" : "Căn đã lock"}
              style={[styles.flex, styles.pill]}
              onPress={() => {
                if (navigating.current) return;
                navigating.current = true;
                if (myLockId) {
                  // Như màn Căn đã lock: kèm id phiếu lock để máy chủ khép đúng phiếu này khi tạo booking
                  router.push({ pathname: "/booking/create", params: { dataBooking: JSON.stringify({ ...data, LockId: myLockId }) } });
                } else {
                  router.push("/locked-units");
                }
              }}
            />
          ) : txPerm?.booking && data?.isHienThiBook ? (
            <Button
              testID="action-book"
              size="lg"
              icon={CalendarPlus}
              title="Tạo booking"
              disabled={!canTransact}
              style={[styles.flex, styles.pill]}
              onPress={() => {
                if (!canTransact || navigating.current) return;
                navigating.current = true;
                router.push({
                  pathname: "/booking/create",
                  params: {
                    dataBooking: JSON.stringify(data),
                  },
                });
              }}
            />
          ) : null}
        </BottomActionBar>
        ) : null}
      </View>
    </>
  );
}

/** Khối nội dung bo góc trên, trồi đè lên đáy ảnh. */
// Ảnh đầu trang (chưa tính status bar) — 2/3 bản cũ 340 (2026-10-16)
const HERO_HEIGHT = 227;
const SHEET_OVERLAP = radius.x3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center" },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  back: { position: "absolute", left: space.lg },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: space.xxl,
    borderTopLeftRadius: radius.x3,
    borderTopRightRadius: radius.x3,
    backgroundColor: colors.bg,
  },
  hero: { gap: space.xs, paddingHorizontal: space.xl },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  code: { fontSize: 26, lineHeight: 34 },
  place: { flexDirection: "row", alignItems: "flex-start", gap: space.xs, marginTop: space.xs },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl, gap: space.md },
  card: { borderWidth: 0, borderRadius: radius.xxl, paddingHorizontal: space.lg + 2, ...elevation.soft },
  pill: { borderRadius: radius.full },
  lockTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    backgroundColor: colors.warningSubtle,
  },
});
