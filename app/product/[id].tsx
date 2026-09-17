import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Share,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { featuredProperties, Property, products } from "@/mocks/properties";
import { overviewBlocks } from "@/mocks/overviewUnits";
import {
  MapPin,
  DollarSign,
  Share2,
  Heart,
  Lock,
  Calendar,
  Calculator,
  Home,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { ProductService } from "@/sevicesSupabase/ProductService";

export default function ProductDetailScreen() {
  const { id, lockMinutes } = useLocalSearchParams<{
    id?: string;
    lockMinutes?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [data, setData] = useState<any>(null);
  const [bannerProduct, setBannerProduct] = useState<Array<{ HinhAnh?: string }>>(
    []
  );

  // const loadData = async () => {
  //   let res = await BookingService.getLockDetail({
  //     ID: id2,
  //   });
  //   console.log(res.data,'data123');
  //   setData(res?.data);
  // };

  const getBannerProduct = async () => {
    const result = await ProductService.getBannerProduct({ maSP: id });
    setBannerProduct(result.data ?? []);
  };
  const getProducts = async () => {
    setLoading(true);
    const result = await ProductService.getDetailProducts({ maSP: id });
    if (result?.data) {
      const seconds = result.data.ThoiGianConLai || 0;

      setData(result.data);

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
  }, []);

  useEffect(() => {
    if (lockMinutes) {
      const minutes = parseInt(lockMinutes, 10);
      if (!isNaN(minutes) && minutes > 0) {
        setIsLocked(true);
        setRemainingSeconds(minutes * 60);
      }
    }
  }, [lockMinutes]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList<{ HinhAnh?: string }>>(null);
  const screenWidth = Dimensions.get("window").width;

  // Tiêu đề hiển thị lấy từ dữ liệu cloud (data), không dùng mocks.
  const property: Property | undefined = useMemo(() => {
    if (!data) return undefined;
    return {
      id: String(data?.MaSP ?? id ?? ""),
      title: data?.TenDA || data?.KyHieu || "Sản phẩm",
      location: data?.DiaChi || "",
      price: "",
      image: "",
      images: [],
      area: Number(data?.DienTich) || 0,
      clearArea: Number(data?.DTThongThuy) || 0,
      priceValue: Number(data?.TongGiaTriHDMB) || 0,
      code: data?.KyHieu || "",
    } as Property;
  }, [data, id]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  // const formatCountdown = (seconds: number): string => {
  //   const mins = Math.floor(seconds / 60);
  //   const secs = seconds % 60;
  //   return `${mins}:${secs.toString().padStart(2, "0")}`;
  // };

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
  }, [isLocked, remainingSeconds]);

  if (!loading && !data) {
    return (
      <View style={styles.missingContainer} testID="product-not-found">
        <Text style={styles.missingTitle}>Không tìm thấy sản phẩm</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="go-back"
        >
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  const statusName = String(
    data?.TenTT ||
    data?.ten_tt ||
    data?.TrangThai ||
    data?.status ||
    data?.tt?.item_name ||
    ""
  )
    .toLowerCase()
    .trim();
  const isBookingStatus =
    statusName.includes("booking") ||
    statusName.includes("chờ duyệt") ||
    statusName.includes("cho duyet") ||
    statusName.includes("đã book") ||
    statusName.includes("da book") ||
    statusName.includes("giữ chỗ") ||
    statusName.includes("giu cho") ||
    String(data?.MaTT) === "5" ||
    String(data?.MaTT) === "6" ||
    String(data?.ma_tt) === "5" ||
    String(data?.ma_tt) === "6";
  const isUnavailableStatus =
    isBookingStatus ||
    statusName.includes("đã bán") ||
    statusName.includes("đặt cọc") ||
    statusName.includes("thanh lý") ||
    statusName.includes("hợp đồng");
  const handleLock = async () => {
    if (isLocked) return;

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
        // Tải lại để cập nhật trạng thái SP (Đã Lock)
        await getProducts();
      }
    } catch (err) {
      console.log("Lock error", err);
    }
  };

  const displayImages =
    property?.images && property.images.length > 0
      ? property.images
      : [property?.image].filter(Boolean);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setCurrentImageIndex(index);
  };

  console.log(data?.KyHieu);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: property?.title || "Sản phẩm" }} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard} testID="product-hero">
            <FlatList
              ref={flatListRef}
              data={bannerProduct}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyExtractor={(item, index) => `image-${index}`}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item?.HinhAnh }}
                  style={[styles.heroImage, { width: screenWidth }]}
                  contentFit="cover"
                />
              )}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.85)"]}
              style={styles.heroOverlay}
              pointerEvents="none"
            />

            {/* <View style={[styles.heroActions, { top: insets.top - 50 }]}>
              <TouchableOpacity
                testID="action-favorite"
                style={[styles.heroIconBtn]}
                onPress={() => {
                  setIsFavorite(!isFavorite);
                  console.log("[Product] Favorite toggled", {
                    id: property?.id,
                    isFavorite: !isFavorite,
                  });
                }}
              >
                <Heart
                  color={isFavorite ? "#8B5CF6" : Colors.white}
                  size={22}
                  fill={isFavorite ? "#8B5CF6" : "transparent"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                testID="action-share"
                style={[styles.heroIconBtn]}
                onPress={async () => {
                  console.log("[Product] Share pressed", { id: property?.id });
                  try {
                    const shareUrl = `https://app.com/product/${property?.id}`;
                    const shareMessage = `${property?.title} - ${property?.price}\n${property?.location}\n${shareUrl}`;

                    await Share.share({
                      message: shareMessage,
                      url: shareUrl,
                      title: property?.title,
                    });
                  } catch (error) {
                    console.error("[Product] Share error:", error);
                  }
                }}
              >
                <Share2 color={Colors.white} size={20} />
              </TouchableOpacity>
            </View> */}

            {bannerProduct.length > 1 && (
              <View style={styles.paginationDots}>
                {bannerProduct.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.dot,
                      index === currentImageIndex && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            )}

            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>{data?.TenDA}</Text>

              <View style={styles.rowCenter}>
                <Home color={Colors.white} size={16} />
                <Text style={styles.heroSubtitle}> {data?.KyHieu}</Text>
              </View>
              <View style={styles.rowCenter}>
                <MapPin color={Colors.white} size={16} />
                <Text style={styles.heroSubtitle}>{data?.DiaChi}</Text>
              </View>
              <View style={styles.pricePill}>
                <DollarSign color={Colors.white} size={16} />
                <Text style={styles.priceText}>
                  {Number(data?.TongGiaTriHDMB) > 0
                    ? `${(Number(data.TongGiaTriHDMB) / 1000000000).toFixed(2)} tỷ`
                    : "Liên hệ"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin căn hộ</Text>
            <Text style={styles.sectionText}>
              Căn hộ tiêu chuẩn hiện đại, tiện ích nội khu đầy đủ, vị trí kết
              nối thuận tiện.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chi tiết giá</Text>
              {/* <TouchableOpacity
                testID="action-calculator"
                style={styles.calculatorBtn}
                onPress={() => {
                  console.log("[Product] Calculator pressed", {
                    id: property?.id,
                  });
                  router.push(`/price-calculator/${property?.id}`);
                }}
              >
                <Calculator color={Colors.primary} size={20} />
                <Text style={styles.calculatorBtnText}>Tính giá</Text>
              </TouchableOpacity> */}
            </View>
            <View style={styles.priceDetails}>
              {Number(data?.DTThongThuy) > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Diện tích thông thủy:</Text>
                  <Text style={styles.detailValue}>
                    {data?.DTThongThuy} m²
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tổng giá gồm VAT:</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(data?.TongGiaGomVAT)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tiền VAT:</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(data?.TienVAT)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phí bảo trì:</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(data?.PhiBaoTri)}
                </Text>
              </View>
              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Tổng giá trị HĐ:</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(data?.TongGiaTriHDMB)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.lockButton,
                isLocked && styles.lockedButton,
              ]}
              onPress={handleLock}
              disabled={isLocked}
            >
              <Lock color={Colors.white} size={20} />

              {!isLocked ? (
                <Text style={styles.actionButtonText}>Lock căn</Text>
              ) : (
                <Text style={styles.actionButtonText}>
                  {formatCountdown(remainingSeconds)}
                </Text>
              )}
            </TouchableOpacity>

            {data?.isHienThiBook ? (
              <TouchableOpacity
                testID="action-book"
                style={[
                  styles.actionButton,
                  styles.bookButton,
                  isBookingStatus && styles.disabledButton,
                ]}
                activeOpacity={isBookingStatus ? 1 : 0.85}
                disabled={isBookingStatus}
                onPress={() => {
                  if (isBookingStatus) return;
                  router.push({
                    pathname: "/booking/create",
                    params: {
                      dataBooking: JSON.stringify(data),
                    },
                  });
                }}
              >
                <Calendar
                  color={isBookingStatus ? "#9CA3AF" : Colors.white}
                  size={20}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    isBookingStatus && styles.disabledButtonText,
                  ]}
                >
                  {isBookingStatus ? "Đã booking" : "Book ngay"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 24 },
  heroCard: {
    height: 320,
    backgroundColor: Colors.white,
  },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  heroInfo: {
    position: "absolute" as const,
    left: 20,
    right: 20,
    bottom: 20,
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  heroTitle: { fontSize: 26, fontWeight: "800" as const, color: Colors.white },
  heroSubtitle: { color: Colors.white, opacity: 0.95 },
  pricePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  priceText: { color: Colors.white, fontWeight: "700" as const },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  calculatorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calculatorBtnText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  sectionText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  heroActions: {
    position: "absolute" as const,
    right: 16,
    flexDirection: "row",
    gap: 10,
    zIndex: 10,
  },
  heroIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  ctaBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimary: { backgroundColor: Colors.primary },
  ctaPrimaryText: {
    color: Colors.white,
    fontWeight: "700" as const,
    fontSize: 16,
  },
  iconBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  missingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  missingTitle: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
    fontWeight: "600" as const,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: { color: Colors.white, fontWeight: "700" as const },
  priceDetails: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.primary,
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  lockButton: {
    backgroundColor: "#6B7280",
  },
  bookButton: {
    backgroundColor: Colors.primary,
  },
  disabledButton: {
    backgroundColor: "#E5E7EB",
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700" as const,
  },
  disabledButtonText: {
    color: "#9CA3AF",
  },
  lockedButton: {
    backgroundColor: "#8B5CF6",
  },
  countdownText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  paginationDots: {
    position: "absolute" as const,
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  activeDot: {
    backgroundColor: Colors.white,
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
});
