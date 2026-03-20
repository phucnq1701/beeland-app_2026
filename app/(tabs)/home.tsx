import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import {
  Search,
  Bell,
  MapPin,
  ChevronRight,
  Sparkles,
  Calendar,
  Users,
  ClipboardList,
  Phone,
  Clock,
} from "lucide-react-native";

import Colors from "@/constants/colors";
import { features, Feature } from "@/mocks/features";
import { notifications } from "@/mocks/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { ProjectService } from "../sevices/ProjectService";
import { UserService } from "../sevices/UserService";
import { Format_Date } from "@/components/utils/common";
import { CustomerService } from "../sevices/CustomerService";

const DEFAULT_PROJECT_IMAGE = "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bigwmih05tf7or57crm12";
const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 48;
const STORAGE_KEY = "@home_features_config";
const MAX_HOME_FEATURES = 6;

export default function HomeScreen() {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [displayedFeatures, setDisplayedFeatures] = useState<Feature[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const featuresAnimations = useRef<Animated.Value[]>([]);
  const badgePulse = useRef(new Animated.Value(1)).current;
  const cardsScale = useRef<{ [key: string]: Animated.Value }>({}).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const [duAn, setDuAn] = useState<any[]>([]);
  const [booking, setBooking] = useState<any[]>([]);
  const [khachHang, setKhachHang] = useState<any[]>([]);
  const [lichHen, setLichHen] = useState<any[]>([]);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem("@token");

      if (token) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/login");
      }
    };

    void checkToken();
  }, [router]);

  const loadData = async () => {
    try {
      const resDA = await ProjectService.getProjects({});
      const data = resDA?.data || [];
      setDuAn(data.slice(0, 5));
    } catch (error) {
      console.log("[Home] Error loading projects:", error instanceof Error ? error.message : String(error));
    }

    try {
      const resBooking = await UserService.getTransactions({
        TuNgay: "2000-01-01",
        DenNgay: "2100-01-01",
        DuAn: "",
        MaTT: 0,
        MaKhu: 0,
        inputSearch: "",
        Offset: 1,
        Limit: 50,
      });
      const dataBooking = resBooking?.data || [];
      setBooking(dataBooking.slice(0, 5));
    } catch (error) {
      console.log("[Home] Error loading bookings:", error instanceof Error ? error.message : String(error));
    }

    try {
      const resKH = await CustomerService.getCustomers("");
      const dataKH = resKH?.data || [];
      setKhachHang(dataKH.slice(0, 5));
    } catch (error) {
      console.log("[Home] Error loading customers:", error instanceof Error ? error.message : String(error));
    }

    try {
      const resLH = await CustomerService.getLichHenByMaKH({
        MaKH: 0,
        TuNgay: "2000-01-01",
        DenNgay: "2100-01-01",
        InputString: "",
        Home: 0,
      });
      const dataLH = resLH?.data || [];
      setLichHen(dataLH.slice(0, 5));
    } catch (error) {
      console.log("[Home] Error loading appointments:", error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    loadFeatureConfiguration().catch(() => {});
    startAnimations();
    startShimmer();
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFeatureConfiguration();
    }, [])
  );

  const startShimmer = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(badgePulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadFeatureConfiguration = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        const selectedIds = config.selectedIds || [];
        const orderedFeatures = selectedIds
          .map((id: string) => features.find((f) => f.id === id))
          .filter(Boolean) as Feature[];
        const slicedFeatures = orderedFeatures.slice(0, MAX_HOME_FEATURES);
        setDisplayedFeatures(slicedFeatures);
        initializeFeatureAnimations(slicedFeatures.length);
      } else {
        const defaultFeatures = features.slice(0, MAX_HOME_FEATURES);
        setDisplayedFeatures(defaultFeatures);
        initializeFeatureAnimations(defaultFeatures.length);
      }
    } catch (error) {
      console.log(
        "[Home] Load feature config error:",
        error instanceof Error ? error.message : String(error)
      );
      const defaultFeatures = features.slice(0, MAX_HOME_FEATURES);
      setDisplayedFeatures(defaultFeatures);
      initializeFeatureAnimations(defaultFeatures.length);
    }
  };

  const initializeFeatureAnimations = (count: number) => {
    featuresAnimations.current = Array(count)
      .fill(0)
      .map(() => new Animated.Value(0));

    const animations = featuresAnimations.current.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        delay: index * 50,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  };

  const getCardScale = (id: string) => {
    if (!cardsScale[id]) {
      cardsScale[id] = new Animated.Value(1);
    }
    return cardsScale[id];
  };

  const animatePress = (id: string, callback: () => void) => {
    const scale = getCardScale(id);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 100);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / CARD_WIDTH);
    setActiveIndex(index);
  };

  const statusColors: Record<string, string> = {
    "Chờ duyệt": "#F59E0B", // amber
    "Đã duyệt": "#10B981", // green
    "Huỷ booking": "#EF4444", // red
  };

  const priorityColors: Record<string, string> = {
    "Chờ duyệt": "#FEF3C7", // vàng nhạt
    "Đã duyệt": "#D1FAE5", // xanh nhạt
    "Huỷ booking": "#FEE2E2", // đỏ nhạt
  };
  const handlePressProperty = useCallback(
    (property: any) => {
      animatePress(`property-${property.MaDA}`, () => {
        try {
          console.log("[Home] Navigate to project options", property);

          router.push({
            pathname: "/project/[id]" as const,
            params: {
              id: property.MaDA,
              project: JSON.stringify(property),
            },
          });
        } catch (e) {
          console.log("[Home] Navigate error", e);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  const handleFeaturePress = useCallback(
    (featureId: string) => {
      console.log("[Home] Feature pressed", { featureId });
      const scale = getCardScale(`feature-${featureId}`);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        if (featureId === "1") {
          router.push("/projects");
        } else if (featureId === "2") {
          router.push("/products");
        } else if (featureId === "3") {
          router.push("/appointments");
        } else if (featureId === "4") {
          router.push("/locked-units");
        } else if (featureId === "5") {
          router.push("/bookings");
        } else if (featureId === "6") {
          router.push("/customers");
        } else if (featureId === "8") {
          console.log("[Home] Navigating to contracts");
          router.push("/contracts");
        } else if (featureId === "9") {
          console.log("[Home] Navigating to reports");
          router.push("/reports");
        } else if (featureId === "13") {
          console.log("[Home] Navigating to deposits");
          router.push("/deposits");
        } else {
          console.log("[Home] No route defined for feature", { featureId });
        }
      }, 200);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  const handleSearchPress = useCallback(() => {
    console.log("[Home] Search pressed");
    router.push("/products");
  }, [router]);

  const handleNotificationPress = useCallback(() => {
    console.log("[Home] Notification pressed");
    router.push("/notifications");
  }, [router]);

  const handleViewAllProjects = useCallback(() => {
    console.log("[Home] View all projects pressed");
    router.push("/projects");
  }, [router]);

  const handleManageFeaturesPress = useCallback(() => {
    console.log("[Home] View all management pressed");
    router.push("/all-management");
  }, [router]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradients.background}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.orbWarm1} />
      <View style={styles.orbWarm2} />
      <View style={styles.orbWarm3} />

      <Animated.View
        style={[
          styles.headerBackground,
          {
            paddingTop: insets.top + 8,
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <LinearGradient
          colors={Colors.gradients.warmGlass}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.greetingRow}>
                <Sparkles size={14} color={Colors.primary} />
                <Text style={styles.greeting}>Tài khoản</Text>
              </View>
              <Text style={styles.headerTitle}>Xin chào</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.iconButtonGlass}
                onPress={handleSearchPress}
                activeOpacity={0.7}
              >
                <Search color={Colors.text} size={20} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButtonGlass}
                onPress={handleNotificationPress}
                activeOpacity={0.7}
              >
                <Bell color={Colors.text} size={20} />
                {unreadCount > 0 && (
                  <Animated.View
                    style={[
                      styles.badgeGlass,
                      { transform: [{ scale: badgePulse }] },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <LinearGradient
              colors={Colors.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sectionIndicator}
            />
            <Text style={styles.sectionTitle}>Dự án nổi bật</Text>
          </View>
          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={handleViewAllProjects}
          >
            <Text style={styles.seeAllText}>Xem tất cả</Text>
            <ChevronRight color={Colors.primary} size={18} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 16}
          snapToAlignment="center"
          contentContainerStyle={styles.carouselContent}
        >
          {duAn.map((property, index) => (
            <Animated.View
              key={property.MaDA}
              style={{
                transform: [
                  { scale: getCardScale(`property-${property.MaDA}`) },
                ],
              }}
            >
              <TouchableOpacity
                testID={`property-card-${property.MaDA}`}
                style={[
                  styles.propertyCard,
                  index === 0 && styles.propertyCardFirst,
                  index === duAn.length - 1 && styles.propertyCardLast,
                ]}
                activeOpacity={1}
                onPress={() => handlePressProperty(property)}
              >
                <Image
                  source={{ uri: property.image || DEFAULT_PROJECT_IMAGE }}
                  style={styles.propertyImage}
                  contentFit="cover"
                />

                <View
                  style={[
                    styles.propertyBadge,
                    {
                      backgroundColor:
                        property?.MaTT === 1
                          ? "rgba(16, 185, 129, 0.9)"
                          : property?.MaTT === 2
                          ? "rgba(239, 68, 68, 0.9)"
                          : property?.MaTT === 3
                          ? "rgba(249, 115, 22, 0.9)"
                          : "rgba(107, 114, 128, 0.9)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeDot,
                      {
                        backgroundColor:
                          property?.MaTT === 1
                            ? "#6EE7B7"
                            : property?.MaTT === 2
                            ? "#FCA5A5"
                            : property?.MaTT === 3
                            ? "#FDBA74"
                            : "#D1D5DB",
                      },
                    ]}
                  />

                  <Text style={styles.propertyBadgeText}>
                    {property?.MaTT === 1
                      ? "Đang bán"
                      : property?.MaTT === 2
                      ? "Đã bán"
                      : property?.MaTT === 3
                      ? "Đầu tư"
                      : "Không xác định"}
                  </Text>
                </View>

                <Animated.View
                  style={[
                    styles.shimmer,
                    { transform: [{ translateX: shimmerTranslate }] },
                  ]}
                />

                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.85)"]}
                  style={styles.propertyGradient}
                >
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyTitle}>{property.TenDA}</Text>
                    <View style={styles.propertyLocationRow}>
                      <MapPin color="rgba(255,255,255,0.7)" size={14} />
                      <Text style={styles.propertyLocation}>
                        {property.district}
                      </Text>
                    </View>
                    <View style={styles.propertyFooter}>
                      <Text style={styles.propertyPrice}>{property.price}</Text>
                      <View style={styles.arrowButton}>
                        <ChevronRight color={Colors.white} size={18} />
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>

        <View style={styles.pagination}>
          {duAn.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                activeIndex === index && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.featuresSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={Colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sectionIndicator}
              />
              <Text style={styles.sectionTitle}>Quản lý</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={handleManageFeaturesPress}
            >
              <Text style={styles.seeAllText}>Tất cả</Text>
              <ChevronRight color={Colors.primary} size={18} />
            </TouchableOpacity>
          </View>

          <View style={styles.featuresGrid}>
            {displayedFeatures.map((feature, index) => {
              const animValue =
                featuresAnimations.current[index] || new Animated.Value(1);
              return (
                <Animated.View
                  key={feature.id}
                  style={{
                    opacity: animValue,
                    transform: [
                      { scale: getCardScale(`feature-${feature.id}`) },
                      {
                        translateY: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    style={styles.featureCard}
                    activeOpacity={0.7}
                    onPress={() => handleFeaturePress(feature.id)}
                  >
                    <View
                      style={[
                        styles.featureIconContainer,
                        { backgroundColor: feature.backgroundColor },
                      ]}
                    >
                      <feature.icon color={feature.iconColor} size={26} />
                    </View>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={Colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sectionIndicator}
              />
              <Text style={styles.sectionTitle}>Booking gần đây</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => router.push("/bookings")}
            >
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <ChevronRight color={Colors.primary} size={18} />
            </TouchableOpacity>
          </View>
          {booking.map((booking) => (
            <TouchableOpacity
              key={booking.maPGC}
              style={styles.recentCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/booking/[id]",
                  params: { id: booking.maPGC },
                })
              }
            >
              <View
                style={[
                  styles.recentIconBox,
                  { backgroundColor: statusColors[booking.tenTT] },
                ]}
              >
                <ClipboardList
                  size={20}
                  color={priorityColors[booking.tenTT]}
                />
              </View>
              <View style={styles.recentCardContent}>
                <Text style={styles.recentCardTitle} numberOfLines={1}>
                  {booking.khachHang}
                </Text>
                <Text style={styles.recentCardSub} numberOfLines={1}>
                  {booking.maSanPham} • {booking.tenDA}
                </Text>
                <View style={styles.recentCardRow}>
                  <Calendar size={12} color={Colors.textTertiary} />
                  <Text style={styles.recentCardSub} numberOfLines={1}>
                    {Format_Date(booking.ngayGiuCho)}
                  </Text>
                </View>
              </View>
              <View style={styles.recentCardRight}>
                <Text style={styles.recentCardAmount}>
                  {booking.tongGiaGomVAT?.toLocaleString("vi-VN")}đ
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[booking.tenTT] },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: priorityColors[booking.tenTT] },
                    ]}
                  >
                    {booking.tenTT}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={Colors.gradients.blue}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sectionIndicator}
              />
              <Text style={styles.sectionTitle}>Khách hàng gần đây</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => router.push("/customers")}
            >
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <ChevronRight color={Colors.primary} size={18} />
            </TouchableOpacity>
          </View>
          {khachHang.map((customer) => (
            <TouchableOpacity
              key={customer.maKH}
              style={styles.recentCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/customer/[id]",
                  params: { id: customer.maKH },
                })
              }
            >
              <View
                style={[
                  styles.recentIconBox,
                  { backgroundColor: "rgba(59,130,246,0.1)" },
                ]}
              >
                <Users size={20} color={Colors.accent.blue} />
              </View>
              <View style={styles.recentCardContent}>
                <Text style={styles.recentCardTitle} numberOfLines={1}>
                  {customer.tenKH}
                </Text>
                <View style={styles.recentCardRow}>
                  <Phone size={12} color={Colors.textTertiary} />
                  <Text style={styles.recentCardSub} numberOfLines={1}>
                    {customer.diDong}
                  </Text>
                </View>
                <View style={styles.recentCardRow}>
                  <Clock size={12} color={Colors.textTertiary} />
                  <Text style={styles.recentCardSub} numberOfLines={1}>
                    Tạo: {Format_Date(customer.ngayDangKy)}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      customer.status === "active"
                        ? "rgba(16,185,129,0.1)"
                        : customer.status === "potential"
                        ? "rgba(59,130,246,0.1)"
                        : "rgba(200,200,200,0.15)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        customer.status === "active"
                          ? Colors.success
                          : customer.status === "potential"
                          ? Colors.accent.blue
                          : Colors.textTertiary,
                    },
                  ]}
                >
                  {customer.tenTT ?? "Không xác định"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={["#10B981", "#06B6D4"] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sectionIndicator}
              />
              <Text style={styles.sectionTitle}>Lịch hẹn gần đây</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => router.push("/appointments")}
            >
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <ChevronRight color={Colors.primary} size={18} />
            </TouchableOpacity>
          </View>
          {lichHen.map((apt) => (
            <TouchableOpacity
              key={apt.maLH}
              style={styles.recentCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/appointments",
                  params: { id: apt.maLH, dataFromHome: JSON.stringify(apt) },
                })
              }
            >
              <View
                style={[
                  styles.recentIconBox,
                  { backgroundColor: "rgba(16,185,129,0.1)" },
                ]}
              >
                <Calendar size={20} color={Colors.success} />
              </View>
              <View style={styles.recentCardContent}>
                <Text style={styles.recentCardTitle} numberOfLines={1}>
                  {apt.tieuDe}
                </Text>
                <View style={styles.recentCardRow}>
                  <Clock size={12} color={Colors.textTertiary} />
                  <Text style={styles.recentCardSub} numberOfLines={1}>
                    {Format_Date(apt.ngayHen)}
                  </Text>
                </View>
              </View>
              {/* <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      apt.status === "confirmed"
                        ? "rgba(16,185,129,0.1)"
                        : apt.status === "pending"
                        ? "rgba(245,158,11,0.1)"
                        : apt.status === "completed"
                        ? "rgba(59,130,246,0.1)"
                        : "rgba(239,68,68,0.1)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        apt.status === "confirmed"
                          ? Colors.success
                          : apt.status === "pending"
                          ? Colors.warning
                          : apt.status === "completed"
                          ? Colors.accent.blue
                          : Colors.error,
                    },
                  ]}
                >
                  {apt.status === "confirmed"
                    ? "Xác nhận"
                    : apt.status === "pending"
                    ? "Chờ XN"
                    : apt.status === "completed"
                    ? "Hoàn thành"
                    : "Đã hủy"}
                </Text>
              </View> */}
            </TouchableOpacity>
          ))}
        </View>

        {/* <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={["#EC4899", "#F97316"] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sectionIndicator}
              />
              <Text style={styles.sectionTitle}>Sản phẩm yêu thích</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => router.push("/products")}
            >
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <ChevronRight color={Colors.primary} size={18} />
            </TouchableOpacity>
          </View>
          {products.slice(0, 5).map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.recentCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: product.id },
                })
              }
            >
              <View
                style={[
                  styles.recentIconBox,
                  { backgroundColor: "rgba(236,72,153,0.1)" },
                ]}
              >
                <Heart size={20} color={Colors.accent.pink} />
              </View>
              <View style={styles.recentCardContent}>
                <Text style={styles.recentCardTitle} numberOfLines={1}>
                  {product.code}
                </Text>
                <Text style={styles.recentCardSub} numberOfLines={1}>
                  {product.price}đ
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      product.status === "available"
                        ? "rgba(16,185,129,0.1)"
                        : product.status === "pending"
                        ? "rgba(245,158,11,0.1)"
                        : "rgba(239,68,68,0.1)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        product.status === "available"
                          ? Colors.success
                          : product.status === "pending"
                          ? Colors.warning
                          : Colors.error,
                    },
                  ]}
                >
                  {product.status === "available"
                    ? "Còn hàng"
                    : product.status === "pending"
                    ? "Đang giữ"
                    : "Đã hủy"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View> */}

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orbWarm1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(200, 200, 200, 0.08)",
    top: -60,
    right: -80,
    ...(Platform.OS === "web" ? { filter: "blur(60px)" } : { opacity: 0.6 }),
  },
  orbWarm2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(200, 200, 200, 0.06)",
    bottom: 300,
    left: -60,
    ...(Platform.OS === "web" ? { filter: "blur(50px)" } : { opacity: 0.5 }),
  },
  orbWarm3: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(200, 200, 200, 0.05)",
    top: 400,
    right: -40,
    ...(Platform.OS === "web" ? { filter: "blur(40px)" } : { opacity: 0.4 }),
  },

  headerBackground: {
    zIndex: 100,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.08)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
      },
    }),
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  badgeGlass: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  carouselContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  propertyCard: {
    width: CARD_WIDTH,
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    marginRight: 16,
    backgroundColor: Colors.backgroundSecondary,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.1)",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 6px 24px rgba(0, 0, 0, 0.08)",
      },
    }),
  },
  propertyCardFirst: {
    marginLeft: 0,
  },
  propertyCardLast: {
    marginRight: 0,
  },
  propertyImage: {
    width: "100%",
    height: "100%",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  propertyBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.9)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6EE7B7",
  },
  propertyBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  propertyGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "70%",
    justifyContent: "flex-end",
    padding: 20,
  },
  propertyInfo: {
    gap: 6,
  },
  propertyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.3,
  },
  propertyLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  propertyLocation: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    flex: 1,
  },
  propertyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  propertyPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.white,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 28,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(200, 200, 200, 0.25)",
  },
  paginationDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  featuresSection: {
    marginTop: 8,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    paddingHorizontal: 20,
    gap: 10,
  },
  recentSection: {
    marginTop: 28,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.04)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
      },
    }),
  },
  recentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.1)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      },
    }),
  },
  recentCardContent: {
    flex: 1,
    gap: 3,
  },
  recentCardTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  recentCardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  recentCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recentCardRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  recentCardAmount: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  featureCard: {
    width: (width - 40 - 20) / 3,
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    padding: 12,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.06)",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 3px 12px rgba(0, 0, 0, 0.04)",
        backdropFilter: "blur(12px)",
      },
    }),
  },
  featureIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.12)",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },
});
