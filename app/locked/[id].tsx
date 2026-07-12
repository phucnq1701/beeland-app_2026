import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { BookingService } from "@/sevices/BookingService";
import { ProductService } from "@/sevices/ProductService";
import { Format_Date } from "@/components/utils/common";

export default function LockDetailScreen() {
  const { id, maSP } = useLocalSearchParams<any>();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<any>(null);
  const [bannerProduct, setBannerProduct] = useState<any[]>([]);
  const [dataProduct, setDataProduct] = useState<any[]>([]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  

  const timerRef = useRef<any>(null);

  const screenWidth = Dimensions.get("window").width;
  const flatListRef = useRef<FlatList>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  /* =========================
        LOAD DATA
  ========================= */

  const loadData = async () => {
    setLoading(true)
    const res = await BookingService.getLockDetail({
      ID: id,
    });

    if (res?.data) {
      setData(res.data);

      const time = res.data.thoiGianConLai || 0;
      if (time > 0) {
        setIsLocked(true);
        setRemainingSeconds(time);
      } else {
        setIsLocked(false);
        setRemainingSeconds(0);
      }
    }
    setLoading(false)
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
  }, []);

  /* =========================
        COUNTDOWN
  ========================= */

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

  /* =========================
        FORMAT TIME
  ========================= */

  const formatCountdown = (seconds: number) => {
    const ss = Math.floor(seconds % 60);
    const mm = Math.floor((seconds % (60 * 60)) / 60);

    return `${mm < 10 ? "0" + mm : mm}:${ss < 10 ? "0" + ss : ss}`;
  };

  /* =========================
        LOCK CĂN
  ========================= */

  const handleLock = async () => {
    if (isLocked) return;

    try {
      const res = await BookingService.lockCan({
        maSP: data?.maSP,
      });

      if (res?.status === 2000) {
        const seconds = res?.data || 0;

        setIsLocked(true);
        setRemainingSeconds(seconds);
      }
    } catch (err) {
      console.log("Lock error", err);
    }
  };

  /* =========================
        IMAGE SLIDER
  ========================= */

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setCurrentImageIndex(index);
  };

  /* =========================
        FORMAT MONEY
  ========================= */

  const formatCurrency = (value: number) => {
    if (!value) return "0 ₫";

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  /* =========================
        UI
  ========================= */

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data?.tenDA || "Chi tiết lock" }} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* IMAGE */}
          <View style={styles.heroCard}>
            <FlatList
              ref={flatListRef}
              data={bannerProduct}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyExtractor={(item, index) => `img-${index}`}
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
            />

            {bannerProduct.length > 1 && (
              <View style={styles.paginationDots}>
                {bannerProduct.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentImageIndex && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* THÔNG TIN LOCK */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin lock căn</Text>

            <View style={styles.priceDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tên dự án</Text>
                <Text style={styles.detailValue}>{data?.tenDA}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mã sản phẩm</Text>
                <Text style={styles.detailValue}>{data?.kyHieu}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ngày lock</Text>
                <Text style={styles.detailValue}>
                  {Format_Date(data?.ngayLock)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thời gian còn lại</Text>

                <Text style={styles.countdownText}>
                  {formatCountdown(remainingSeconds)}
                </Text>
              </View>
            </View>
          </View>

          {/* ACTION BUTTON */}
          <View style={styles.bottomActions}>
            {/* {remainingSeconds === 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.lockButton]}
              onPress={handleLock}
            >
              <Lock color={Colors.white} size={20} />
              <Text style={styles.actionButtonText}>Lock căn</Text>
            </TouchableOpacity>
          )} */}

            {remainingSeconds > 0 && data?.isHienThiBook && (
              <TouchableOpacity
                style={[styles.actionButton, styles.bookButton]}
                onPress={() =>
                  router.push({
                    pathname: "/booking/create",
                    params: {
                      dataBooking: JSON.stringify(dataProduct),
                    },
                  })
                }
              >
                <Calendar color={Colors.white} size={20} />
                <Text style={styles.actionButtonText}>Book ngay</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* =========================
        STYLE
========================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  heroCard: {
    height: 320,
    backgroundColor: Colors.white,
  },

  heroImage: {
    height: "100%",
  },

  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },

  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },

  priceDetails: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  detailLabel: {
    color: Colors.textSecondary,
  },

  detailValue: {
    fontWeight: "600",
    color: Colors.text,
  },

  countdownText: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
  },

  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 24,
  },

  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
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

  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
  },

  paginationDots: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
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
