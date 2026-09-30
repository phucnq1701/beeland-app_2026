import React, { useState, useEffect, useRef, useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, ChevronLeft, Lock, MapPin, PackageX } from "lucide-react-native";

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
  SectionHeader,
  SkeletonDetail,
  Text,
  useToast,
} from "@/components/ui";
import { formatCountdown } from "@/lib/countdown";
import { formatArea, formatVNDShort } from "@/lib/format";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { isOpenForSale, OPEN_FOR_SALE_MESSAGE } from "@/lib/productStatus";
import { colors, space } from "@/theme";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { ProductService } from "@/sevicesSupabase/ProductService";
import { PriceServices, ActivePriceListItem } from "@/sevicesSupabase/PriceServices";

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

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [data, setData] = useState<any>(null);
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
    const result = await ProductService.getDetailProducts({ maSP: id });
    if (result?.data) {
      const seconds = result.data.ThoiGianConLai || 0;

      setData(result.data);

      // Ưu tiên bảng giá: lấy giá hiệu lực theo sản phẩm (không chặn UI chính)
      void getActivePrice(result.data);

      if (seconds > 0) {
        setIsLocked(true);
        setRemainingSeconds(seconds);
      }
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
        setIsLocked(true);
        setRemainingSeconds(minutes * 60);
      }
    }
  }, [lockMinutes]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLocked) return;

    // Hết giờ lock → quét hết hạn (trả SP về Mở bán) + tải lại trạng thái
    if (remainingSeconds <= 0) {
      void (async () => {
        await BookingService.sweepExpiredLocks();
        await getProducts();
        setIsLocked(false);
      })();
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, remainingSeconds]);

  const back = (
    <View style={[styles.back, { top: insets.top + space.sm }]}>
      <IconButton icon={ChevronLeft} variant="onDark" accessibilityLabel="Quay lại" onPress={() => router.back()} />
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
    if (isLocked || !canTransact || lockInFlight.current) return;
    lockInFlight.current = true;
    setLocking(true);
    try {
      // Tạo lock cloud: RPC đổi SP (2→18) + insert phiếu LOCK
      const res = await BookingService.createLock({
        maSP: id,
        kyHieu: data?.KyHieu,
        maDA: data?.MaDA,
      });

      if (res?.status === 2000) {
        const seconds = res?.data || 0;

        setIsLocked(true);
        setRemainingSeconds(seconds);
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

  const images = bannerProduct.map((b) => b?.HinhAnh).filter((u): u is string => !!u);
  const price = Number(data?.TongGiaTriHDMB) > 0 ? formatVNDShort(data.TongGiaTriHDMB) : "Liên hệ";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="light" />
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View testID="product-hero">
            <ImageCarousel images={images} fallback={DEFAULT_IMAGE} height={260 + insets.top} />
          </View>

          {/* Khối trưng bày: tên dự án, ký hiệu căn, giá */}
          <View style={styles.hero}>
            <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
              {data?.TenDA || "Dự án"}
            </Text>
            <Text variant="title" color={colors.showcase.text} accessibilityRole="header">
              {data?.KyHieu ? `Căn ${data.KyHieu}` : "Sản phẩm"}
            </Text>
            <Text variant="display" color={colors.showcase.accent} numeric>
              {price}
            </Text>
            {data?.DiaChi ? (
              <View style={styles.place}>
                <MapPin size={16} color={colors.showcase.textMuted} />
                <Text variant="caption" color={colors.showcase.textMuted} style={styles.flex}>
                  {data.DiaChi}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.content}>
            <SectionHeader title="Thông tin căn" />
            <Card>
              <KeyValueRow label="Ký hiệu" value={data?.KyHieu || "—"} />
              <KeyValueRow label="Dự án" value={data?.TenDA || "—"} />
              <KeyValueRow label="Diện tích thông thủy" value={formatArea(data?.DTThongThuy)} />
              <KeyValueRow label="Diện tích tim tường" value={formatArea(data?.DienTich)} />
              <KeyValueRow label="Trạng thái" value={statusName || "—"} last />
            </Card>
            {!canTransact ? (
              <Text variant="caption" color="textSecondary">
                {isLocked
                  ? "Căn đang được lock. Tạo booking từ mục Lock căn (như trên web)."
                  : `${OPEN_FOR_SALE_MESSAGE} – căn đang ở trạng thái “${statusName || "không xác định"}”.`}
              </Text>
            ) : null}

            <SectionHeader title="Chi tiết giá" />
            <Card>
              <PriceBreakdown activePrice={activePrice} data={data} loading={priceLoading} />
            </Card>
          </View>
        </ScrollView>
        {back}

        <BottomActionBar>
          {isLocked ? (
            <View style={styles.lockTimer} accessible accessibilityLabel={`Đang lock, còn ${formatCountdown(remainingSeconds)}`}>
              <Lock size={18} color={colors.onWarningSubtle} />
              <Text variant="subhead" numeric color="onWarningSubtle">
                {formatCountdown(remainingSeconds)}
              </Text>
            </View>
          ) : (
            <Button
              variant="secondary"
              icon={Lock}
              title="Lock căn"
              loading={locking}
              disabled={!canTransact}
              onPress={() => void handleLock()}
            />
          )}
          {data?.isHienThiBook ? (
            <Button
              testID="action-book"
              size="lg"
              icon={CalendarPlus}
              title="Tạo booking"
              disabled={!canTransact}
              style={styles.flex}
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.showcase.paper },
  center: { justifyContent: "center" },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  back: { position: "absolute", left: space.md },
  hero: {
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    backgroundColor: colors.showcase.bg,
  },
  place: { flexDirection: "row", alignItems: "flex-start", gap: space.xs, marginTop: space.xs },
  content: { padding: space.lg, gap: space.md },
  lockTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: 12,
    backgroundColor: colors.warningSubtle,
  },
});
