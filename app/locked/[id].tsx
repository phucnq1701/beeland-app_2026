import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CalendarPlus, ChevronLeft, Lock, LockOpen } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCarousel } from "@/components/product/ImageCarousel";
import { PriceBreakdown } from "@/components/product/PriceBreakdown";
import {
  BottomActionBar,
  Button,
  Card,
  IconButton,
  KeyValueRow,
  SectionHeader,
  SkeletonDetail,
  Text,
} from "@/components/ui";
import { formatCountdown } from "@/lib/countdown";
import { formatDateTime } from "@/lib/format";
import { colors, radius, space } from "@/theme";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { ProductService } from "@/sevicesSupabase/ProductService";

/** Ảnh dùng khi sản phẩm chưa có ảnh. */
const DEFAULT_IMAGE =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

export default function LockDetailScreen() {
  const { id, maSP } = useLocalSearchParams<any>();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<any>(null);
  const [bannerProduct, setBannerProduct] = useState<any[]>([]);
  const [dataProduct, setDataProduct] = useState<any>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [, setIsLocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  /* ---------------- Tải dữ liệu ---------------- */

  const loadData = async () => {
    setLoading(true);
    const res = await BookingService.getLockDetailCloud({
      ID: id,
    });

    if (res?.data) {
      setData(res.data);

      // ThoiGianConLai là giây (tính từ het_han_luc)
      const time = res.data.ThoiGianConLai || 0;
      if (time > 0) {
        setIsLocked(true);
        setRemainingSeconds(time);
      } else {
        setIsLocked(false);
        setRemainingSeconds(0);
      }
    }
    setLoading(false);
  };

  const getBannerProduct = async () => {
    const result = await ProductService.getBannerProduct({
      maSP: maSP,
    });

    setBannerProduct(result?.data ?? []);
  };
  const getProducts = async () => {
    const result = await ProductService.getDetailProducts({ maSP: maSP });

    if (result?.data) {
      setDataProduct(result.data);
    }
  };

  useEffect(() => {
    loadData();
    getBannerProduct();
    getProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Đếm ngược ---------------- */

  useEffect(() => {
    if (remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [remainingSeconds]);

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

  const images = bannerProduct.map((b: any) => b?.HinhAnh).filter((u: unknown): u is string => !!u);
  const active = remainingSeconds > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ImageCarousel images={images} fallback={DEFAULT_IMAGE} height={240 + insets.top} />

          <View style={styles.hero}>
            <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1}>
              {data?.tenDA || "Chi tiết lock"}
            </Text>
            <Text variant="title" color={colors.showcase.text} accessibilityRole="header">
              {data?.kyHieu ? `Căn ${data.kyHieu}` : "Căn đã lock"}
            </Text>
            <View
              style={[styles.timer, active ? styles.timerActive : styles.timerExpired]}
              accessible
              accessibilityLabel={active ? `Lock còn ${formatCountdown(remainingSeconds)}` : "Đã hết hạn lock"}
            >
              {active ? (
                <Lock size={18} color={colors.onWarningSubtle} />
              ) : (
                <LockOpen size={18} color={colors.onDangerSubtle} />
              )}
              <Text variant="subhead" color={active ? "onWarningSubtle" : "onDangerSubtle"}>
                {active ? "Lock còn" : "Đã hết hạn lock"}
              </Text>
              {active ? (
                <Text variant="heading" numeric color="onWarningSubtle" style={styles.push}>
                  {formatCountdown(remainingSeconds)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.content}>
            <SectionHeader title="Thông tin lock căn" />
            <Card>
              <KeyValueRow label="Tên dự án" value={data?.tenDA || "—"} />
              <KeyValueRow label="Mã sản phẩm" value={data?.kyHieu || "—"} />
              <KeyValueRow label="Ngày lock" value={formatDateTime(data?.ngayLock)} last />
            </Card>

            {dataProduct ? (
              <>
                <SectionHeader title="Giá sản phẩm" />
                <Card>
                  <PriceBreakdown activePrice={null} data={dataProduct} loading={false} />
                </Card>
              </>
            ) : null}
          </View>
        </ScrollView>
        {back}

        {active ? (
          <BottomActionBar>
            <Button
              size="lg"
              icon={CalendarPlus}
              title="Tạo booking"
              style={styles.flex}
              onPress={() =>
                router.push({
                  pathname: "/booking/create",
                  params: {
                    dataBooking: JSON.stringify(dataProduct || data),
                  },
                })
              }
            />
          </BottomActionBar>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.showcase.paper },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  back: { position: "absolute", left: space.md },
  hero: {
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    backgroundColor: colors.showcase.bg,
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  timerActive: { backgroundColor: colors.warningSubtle },
  timerExpired: { backgroundColor: colors.dangerSubtle },
  push: { marginLeft: "auto" },
  content: { padding: space.lg, gap: space.md },
});
