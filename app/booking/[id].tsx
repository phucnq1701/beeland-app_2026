import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Phone,
  Package,
  Clock,
  Upload,
  CheckCircle,
  X,
  Building2,
  User,
  Calendar,
  ImageIcon,
  ChevronRight,
  ChevronLeft,
  Hash,
  Banknote,
  CreditCard,
  Gift,
  Info,
  Receipt,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { BookingService } from "@/sevicesSupabase/BookingService";
import {
  PriceServices,
  ActivePriceListItem,
} from "@/sevicesSupabase/PriceServices";

/** Chuẩn hoá màu hex (#RGB hoặc #RRGGBB) -> "RRGGBB" */
const normalizeHex = (color?: string): string | null => {
  if (!color || typeof color !== "string") return null;
  const c = color.trim();
  if (!c.startsWith("#")) return null;
  let hex = c.slice(1);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  if (hex.length !== 6) return null;
  return hex;
};

/** Tự chọn màu chữ (đen/trắng) tương phản với màu nền để dễ đọc */
const getContrastTextColor = (bg?: string): string => {
  const hex = normalizeHex(bg);
  if (!hex) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1F2937" : "#FFFFFF";
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  // Giá đang hiệu lực theo bảng giá (RPC get_active_price_for_product);
  // null → fallback về data.price như cũ
  const [activePrice, setActivePrice] = useState<ActivePriceListItem | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  type DetailTab = "info" | "price" | "gift" | "image";
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [images, setImages] = useState<any[]>([]);
  const [imagesFetched, setImagesFetched] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showPreviewControls, setShowPreviewControls] = useState(true);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const returningFromPayment = useRef(false);

  const loadData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);
    setData(null);
    setActivePrice(null);
    try {
      const res = await BookingService.getBookingEditDetail(String(id ?? ""));
      if (version === requestVersion.current) setData(res?.data ?? null);
      const product = res?.data?.product;
      if (product) {
        // Không chặn UI chính: giá bảng giá về sau thì thay thế giá sản phẩm
        void PriceServices.getActivePriceForProduct({
          productId: product.id,
          maSP: product.ma_sp ?? product.ky_hieu,
        }).then((r) => {
          if (version === requestVersion.current) setActivePrice(r.data);
        });
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setLoadError(error instanceof Error && error.message.includes("đăng nhập")
          ? error.message
          : "Không tải được chi tiết booking. Vui lòng thử lại.");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setImages([]);
    setImagesFetched(false);
    setActiveTab("info");
    void loadData();
    return () => { requestVersion.current += 1; };
  }, [loadData]);

  // Quay lại từ màn thanh toán → nạp lại trạng thái booking (webhook có thể đã cập nhật)
  useFocusEffect(
    useCallback(() => {
      if (!returningFromPayment.current) return;
      returningFromPayment.current = false;
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const loadImages = async () => {
    try {
      setLoadingImages(true);
      setImagesError(null);
      setImages([]);
      const res = await BookingService.getListImageGC({
        // Giống web: UUID vòng đời, fallback UUID booking nếu chưa liên kết.
        MaPGC: data?.maPGC || data?.id,
      });
      setImages(res?.data ?? []);
      setImagesFetched(true);
    } catch (error) {
      console.log("load images error", error);
      setImagesError("Không tải được hình ảnh giao dịch. Vui lòng thử lại.");
    } finally {
      setLoadingImages(false);
    }
  };

  const fmtNumber = (v: any, isMoney = false) =>
    v != null && v !== "" && Number.isFinite(Number(v))
      ? new Intl.NumberFormat("vi-VN").format(
          isMoney ? Math.round(Number(v)) : Number(v)
        )
      : null;
  const fmtVND = (v: any) => fmtNumber(v, true);

  const money = (value: any) => {
    const formatted = fmtVND(value);
    return formatted == null ? null : `${formatted} VNĐ`;
  };
  const dateTime = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString("vi-VN");
  };

  const booking = {
    id: data?.id ?? null,
    soPhieu: data?.soPhieu ?? null,
    amountValue: data?.tongGia ?? 0,
    amount: fmtVND(data?.tongGia),
    tienGiuCho: fmtVND(data?.tienGiuCho),
    productCode:
      data?.product?.ky_hieu ?? data?.product?.ma_sp ?? null,
    customerName: data?.customer?.tenKH ?? null,
    customerPhone: data?.customer?.dienThoai ?? null,
    customerCccd: data?.customer?.cccd ?? null,
    customerEmail: data?.customer?.email ?? null,
    sanName: data?.san?.tenCongTy ?? null,
    projectName: data?.project?.ten_da ?? null,
    bookingDate: data?.ngayGiuCho ?? data?.ngayNhap ?? null,
    expiryDate: data?.hetHanLuc ?? null,
    priceListName: data?.priceList?.name ?? null,
    policyName: data?.policy?.ten_cs ?? null,
    paymentScheduleName: data?.paymentSchedule?.name ?? null,
    nhanVien: data?.nhanVien ?? null,
    status: data?.state,
    MaTT: data?.maTT ?? data?.state,
  };

  const statusConfig: Record<string, { text: string; color: string; bg: string; icon: string }> = {
    PENDING: { text: "Chờ duyệt", color: "#B45309", bg: "#FEF3C7", icon: "⏳" },
    APPROVED: { text: "Đã duyệt", color: "#047857", bg: "#D1FAE5", icon: "✅" },
    CANCELLED: { text: "Hủy booking", color: "#991B1B", bg: "#FEE2E2", icon: "❌" },
    EXPIRED: { text: "Hết hạn", color: "#991B1B", bg: "#FEE2E2", icon: "⏳" },
    1: { text: "Chờ duyệt", color: "#B45309", bg: "#FEF3C7", icon: "⏳" },
    6: { text: "Đã duyệt", color: "#047857", bg: "#D1FAE5", icon: "✅" },
    8: { text: "Đặt cọc chờ duyệt", color: "#92400E", bg: "#FEF3C7", icon: "⏳" },
    9: { text: "Góp vốn chờ duyệt", color: "#374151", bg: "#F3F4F6", icon: "⏳" },
    10: { text: "HĐMB chờ duyệt", color: "#1D4ED8", bg: "#DBEAFE", icon: "📋" },
    11: { text: "Đã thanh lý", color: "#374151", bg: "#F3F4F6", icon: "📄" },
    12: { text: "Thanh lý chờ duyệt", color: "#92400E", bg: "#FEF3C7", icon: "⏳" },
    13: { text: "Đặt cọc đã duyệt", color: "#047857", bg: "#D1FAE5", icon: "✅" },
    14: { text: "HĐMB đã duyệt", color: "#047857", bg: "#D1FAE5", icon: "✅" },
    15: { text: "Góp vốn đã duyệt", color: "#047857", bg: "#D1FAE5", icon: "✅" },
    16: { text: "Hủy booking", color: "#991B1B", bg: "#FEE2E2", icon: "❌" },
    17: { text: "Bàn giao chờ duyệt", color: "#0E7490", bg: "#CFFAFE", icon: "⏳" },
    18: { text: "Đã duyệt bàn giao", color: "#0E7490", bg: "#CFFAFE", icon: "✅" },
    19: { text: "Đã cấp sổ đỏ", color: "#047857", bg: "#D1FAE5", icon: "📕" },
    20: { text: "Thanh lý tất toán chờ duyệt", color: "#92400E", bg: "#FEF3C7", icon: "⏳" },
    21: { text: "Thanh lý tất toán đã duyệt", color: "#374151", bg: "#E5E7EB", icon: "✅" },
    22: { text: "Kế toán duyệt", color: "#1D4ED8", bg: "#DBEAFE", icon: "✅" },
  };

  /** Chọn nguồn ảnh chứng từ: chụp mới hoặc lấy từ thư viện */
  const handlePickImage = () => {
    if (isUploading) return;
    Alert.alert("Tải chứng từ", "Chọn nguồn ảnh", [
      { text: "Chụp ảnh", onPress: () => void pickFromCamera() },
      { text: "Chọn từ thư viện", onPress: () => void pickFromLibrary() },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Thông báo", "Cần cấp quyền truy cập camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) void handleUploadComplete(result.assets);
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Thông báo", "Cần cấp quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });
    if (!result.canceled) void handleUploadComplete(result.assets);
  };

  /**
   * Giống web FormImage: tải ảnh lên nơi lưu tài liệu của công ty rồi lưu
   * vào booking (MaPGC = UUID vòng đời, cùng khóa tab "Chứng từ" dùng để đọc).
   */
  const handleUploadComplete = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets?.length || isUploading) return;
    const maPGC = data?.maPGC || data?.id;
    if (!maPGC) {
      Alert.alert("Lỗi", "Không xác định được phiếu booking để lưu chứng từ");
      return;
    }
    setIsUploading(true);
    try {
      const links: string[] = [];
      for (const asset of assets) {
        const link = await BookingService.uploadBookingImage({
          uri: asset.uri,
          name: asset.fileName ?? undefined,
          type: asset.mimeType ?? undefined,
        });
        links.push(link);
      }
      await BookingService.addBookingImages({ MaPGC: String(maPGC), Images: links });
      setActiveTab("image");
      await loadImages();
      Alert.alert(
        "Thành công",
        links.length > 1 ? `Đã tải lên ${links.length} chứng từ` : "Đã tải lên chứng từ"
      );
    } catch (error) {
      console.log("Upload error:", error);
      Alert.alert(
        "Lỗi",
        error instanceof Error && error.message ? error.message : "Upload ảnh thất bại"
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!loading && !data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Chi tiết Booking" }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loadError ?? "Không tìm thấy booking"}</Text>
          <TouchableOpacity onPress={() => void loadData()} style={styles.closeButton} accessibilityLabel="Thử tải lại">
            <Text style={styles.infoRowLabel}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentStatus = statusConfig[String(booking.MaTT)] ??
    statusConfig[String(data?.state)] ??
    { text: "Chưa xác định", color: "#374151", bg: "#F3F4F6", icon: "•" };
  // Ưu tiên màu nền trạng thái chuẩn từ data (cloud_catalogs.color_code) để
  // chip trạng thái ở chi tiết khớp với màu hiển thị ở danh sách booking.
  const statusBgColor = normalizeHex(data?.colorCode)
    ? String(data.colorCode)
    : currentStatus.bg;
  const statusFgColor = normalizeHex(data?.colorCode)
    ? getContrastTextColor(data.colorCode)
    : currentStatus.color;
  const isActiveBooking =
    (data?.state === "PENDING" || String(booking.MaTT) === "1") &&
    !["APPROVED", "CANCELLED", "EXPIRED"].includes(data?.state) &&
    (!data?.giaiDoan || data.giaiDoan === "GIUCHO");

  // Ưu tiên giá theo bảng giá hiệu lực; không có thì dùng data.price như cũ
  const priceData: Record<string, any> | null = activePrice
    ? {
        ...activePrice,
        unit_price_vat:
          activePrice.unit_price_vat ??
          (Number(activePrice.area) > 0 && activePrice.total_after_vat != null
            ? Number(activePrice.total_after_vat) / Number(activePrice.area)
            : null),
      }
    : data?.price ?? null;

  const priceRows: { key: string; label: string; unit?: string }[] = [
    { key: "area", label: "Diện tích thông thủy", unit: "m²" },
    { key: "unit_price_vat", label: "Đơn giá gồm VAT" },
    { key: "total_before_vat", label: "Tổng giá chưa VAT" },
    { key: "vat_amount", label: "Tiền VAT" },
    { key: "maintenance_amount", label: "Phí bảo trì" },
    { key: "total_payment", label: "Tổng giá gồm PBT" },
  ];
  const lowRiseRows = [
    { key: "land_unit_price", label: "Đơn giá đất" },
    { key: "land_total", label: "Tổng giá đất" },
    { key: "area_xd", label: "Diện tích xây dựng", unit: "m²" },
    { key: "construction_unit_price", label: "Đơn giá xây dựng" },
    { key: "total_after_vat", label: "Tổng giá sau VAT" },
  ].filter(
    (row) => priceData?.[row.key] != null && Number(priceData[row.key]) !== 0
  );

  const tabs: {
    key: DetailTab;
    label: string;
    icon: typeof Info;
    count?: number;
  }[] = [
    { key: "info", label: "Thông tin", icon: Info },
    { key: "price", label: "Bảng giá", icon: Receipt },
    { key: "gift", label: "Quà tặng", icon: Gift, count: data?.promotions?.length ?? 0 },
    { key: "image", label: "Chứng từ", icon: ImageIcon, count: imagesFetched ? images.length : undefined },
  ];

  // Lưới ảnh 3 cột: trừ padding màn (20×2), padding thẻ (20×2), khoảng cách (8×2)
  const thumbSize = Math.floor((windowWidth - 40 - 40 - 16) / 3);

  const iconOf = (Icon: typeof Info, color: string) => <Icon size={16} color={color} />;
  const infoSections: {
    title: string;
    rows: { icon: React.ReactNode; label: string; value: string | null | undefined }[];
  }[] = [
    {
      title: "Khách hàng",
      rows: [
        { icon: iconOf(User, Colors.accent.blue), label: "Họ tên", value: booking.customerName },
        { icon: iconOf(Hash, Colors.primary), label: "Mã khách hàng", value: data?.customer?.maSoKH },
        { icon: iconOf(Phone, Colors.accent.green), label: "Điện thoại", value: booking.customerPhone },
        { icon: iconOf(CreditCard, Colors.accent.blue), label: "CCCD", value: booking.customerCccd },
        { icon: iconOf(User, Colors.primary), label: "Email", value: booking.customerEmail },
        { icon: iconOf(Building2, Colors.primary), label: "Địa chỉ", value: data?.customer?.diaChi },
      ],
    },
    {
      title: "Giao dịch",
      rows: [
        { icon: iconOf(Package, Colors.primary), label: "Sản phẩm", value: booking.productCode },
        { icon: iconOf(Building2, Colors.accent.purple), label: "Dự án", value: booking.projectName },
        { icon: iconOf(Building2, Colors.accent.purple), label: "Sàn giao dịch", value: booking.sanName },
        { icon: iconOf(User, Colors.accent.blue), label: "Nhân viên", value: booking.nhanVien },
        { icon: iconOf(Banknote, Colors.accent.green), label: "Tiền giữ chỗ", value: booking.tienGiuCho ? `${booking.tienGiuCho} VNĐ` : null },
        { icon: iconOf(Banknote, Colors.primary), label: "Đã thu", value: money(data?.daThu) },
        { icon: iconOf(CheckCircle, Colors.primary), label: "Booking ưu tiên", value: data?.uuTien == null ? null : data.uuTien ? "Có" : "Không" },
      ],
    },
    {
      title: "Chính sách",
      rows: [
        { icon: iconOf(Receipt, Colors.primary), label: "Bảng giá", value: booking.priceListName },
        { icon: iconOf(Package, Colors.primary), label: "Chính sách bán hàng", value: booking.policyName },
        { icon: iconOf(Package, Colors.primary), label: "Cấu hình tính giá", value: data?.pricingConfig?.name ?? data?.pricingConfig?.ten_cau_hinh ?? data?.pricingConfig?.ten_cs ?? data?.maCSTong },
        { icon: iconOf(Calendar, Colors.primary), label: "Tiến độ thanh toán", value: booking.paymentScheduleName },
      ],
    },
    {
      title: "Thời gian",
      rows: [
        { icon: iconOf(Clock, Colors.accent.cyan), label: "Ngày booking", value: dateTime(booking.bookingDate) },
        { icon: iconOf(Calendar, Colors.accent.orange), label: "Hết hạn lúc", value: dateTime(booking.expiryDate) },
        { icon: iconOf(Clock, Colors.primary), label: "Thời gian giữ chỗ", value: data?.thoiGianBooking != null ? `${fmtNumber(data.thoiGianBooking)} phút` : null },
      ],
    },
  ];

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconCircle}>{icon}</View>
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={styles.infoRowValue}>{value || "—"}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "",
          headerStyle: { backgroundColor: "#F8F6F3" },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            // Thanh tab bám dính khi cuộn
            stickyHeaderIndices={[1]}
          >
            {/* ---- Tóm tắt + thao tác nhanh ---- */}
            <View>
              <View style={styles.topSection}>
                <View style={styles.idRow}>
                  <Hash size={16} color={Colors.textSecondary} />
                  <Text style={styles.bookingIdText} numberOfLines={1}>
                    {booking.soPhieu ?? "—"}
                  </Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: statusBgColor }]}>
                  <Text style={styles.statusIcon}>{currentStatus.icon}</Text>
                  <Text style={[styles.statusLabel, { color: statusFgColor }]}>
                    {data?.tenTT || currentStatus.text}
                  </Text>
                </View>
              </View>

              <View style={styles.amountCard}>
                <View style={styles.amountCardInner}>
                  <Banknote size={20} color="#fff" />
                  <Text style={styles.amountTitle}>Giá trị hợp đồng</Text>
                </View>
                <Text style={styles.amountValue}>
                  {booking.amount ?? "—"} <Text style={styles.amountCurrency}>VNĐ</Text>
                </Text>
                <View style={styles.amountDivider} />
                <View style={styles.amountMetaRow}>
                  <View style={styles.amountMetaItem}>
                    <Package size={14} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.amountMetaText} numberOfLines={1}>
                      {[booking.productCode, booking.projectName].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </View>
                  {booking.expiryDate ? (
                    <View style={styles.amountMetaItem}>
                      <Clock size={14} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.amountMetaText} numberOfLines={1}>
                        Hết hạn {dateTime(booking.expiryDate)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {isActiveBooking && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    activeOpacity={0.8}
                    onPress={handlePickImage}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Upload size={18} color="#fff" />
                    )}
                    <Text style={styles.uploadButtonText}>Tải chứng từ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.paymentButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      returningFromPayment.current = true;
                      router.push({
                        pathname: "/booking/qr-payment",
                        params: { bookingId: String(booking.id ?? booking.soPhieu ?? "") },
                      });
                    }}
                  >
                    <CreditCard size={18} color="#fff" />
                    <Text style={styles.paymentButtonText}>Thanh toán</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>

            {/* ---- Thanh tab (sticky) ---- */}
            <View style={styles.tabBarWrap}>
              <View style={styles.tabBar}>
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;
                  const Icon = tab.icon;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.tabItem, active && styles.tabItemActive]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setActiveTab(tab.key);
                        if (tab.key === "image" && !imagesFetched && !loadingImages) {
                          void loadImages();
                        }
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Icon size={15} color={active ? "#fff" : Colors.textSecondary} />
                      <Text
                        style={[styles.tabLabel, active && styles.tabLabelActive]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                      {tab.count != null && tab.count > 0 ? (
                        <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                          <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                            {tab.count}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ---- Nội dung tab ---- */}
            <View style={styles.tabContent}>
              {activeTab === "info" &&
                infoSections.map((section) => (
                  <View key={section.title} style={styles.detailCard}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    {section.rows.map((row, index) => (
                      <View key={row.label}>
                        {index > 0 && <View style={styles.separator} />}
                        <InfoRow icon={row.icon} label={row.label} value={row.value} />
                      </View>
                    ))}
                  </View>
                ))}

              {activeTab === "price" && (
                <View style={styles.detailCard}>
                  <Text style={styles.sectionTitle}>Giá sản phẩm theo bảng giá</Text>
                  {booking.priceListName ? (
                    <Text style={styles.priceListName}>{booking.priceListName}</Text>
                  ) : null}
                  {!activePrice && data?.priceSource === "bds_products" && (
                    <View style={styles.noticeBox}>
                      <Info size={14} color="#92400E" />
                      <Text style={styles.noticeText}>
                        Chưa có dòng giá theo bảng giá đã chọn. Hiển thị giá từ sản phẩm.
                      </Text>
                    </View>
                  )}
                  {[...priceRows, ...lowRiseRows]
                    .filter((row) => row.key !== "total_payment")
                    .map((row, index) => (
                      <View key={row.key}>
                        {index > 0 && <View style={styles.separator} />}
                        <View style={styles.priceRow}>
                          <Text style={styles.priceRowLabel}>{row.label}</Text>
                          <Text style={styles.priceRowValue}>
                            {(row.unit
                              ? fmtNumber(priceData?.[row.key]) != null
                                ? `${fmtNumber(priceData?.[row.key])} ${row.unit}`
                                : null
                              : money(priceData?.[row.key])) || "—"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  <View style={styles.priceTotalBox}>
                    <Text style={styles.priceTotalLabel}>Tổng giá gồm PBT</Text>
                    <Text style={styles.priceTotalValue}>
                      {money(priceData?.total_payment) || "—"}
                    </Text>
                  </View>
                </View>
              )}

              {activeTab === "gift" && (
                <View style={styles.detailCard}>
                  <Text style={styles.sectionTitle}>Quà tặng / Khuyến mãi</Text>
                  {!data?.promotions?.length ? (
                    <View style={styles.tabEmpty}>
                      <View style={styles.emptyImageIcon}>
                        <Gift size={28} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.emptySub}>Chưa có quà tặng được chọn</Text>
                    </View>
                  ) : (
                    data.promotions.map((promotion: any, index: number) => (
                      <View
                        key={`${promotion.id ?? "gift"}-${index}`}
                        style={styles.giftItem}
                      >
                        <View style={styles.giftIcon}>
                          <Gift size={18} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.giftTitle}>
                            {promotion.tenQuaTang || promotion.tenKhuyenMai || "Quà tặng"}
                          </Text>
                          {promotion.tenQuaTang && promotion.tenKhuyenMai ? (
                            <Text style={styles.giftSub}>{promotion.tenKhuyenMai}</Text>
                          ) : null}
                          <View style={styles.giftMetaRow}>
                            <Text style={styles.giftMeta}>
                              SL: {fmtNumber(promotion.soLuong) ?? "—"}
                            </Text>
                            <Text style={styles.giftValue}>{money(promotion.giaTri) ?? "—"}</Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {activeTab === "image" && (
                <View style={styles.detailCard}>
                  <View style={styles.imageTabHeader}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                      Hình ảnh giao dịch
                    </Text>
                    {!loadingImages && (
                      <TouchableOpacity onPress={() => void loadImages()} hitSlop={10}>
                        <Text style={styles.linkText}>Tải lại</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {loadingImages ? (
                    <View style={styles.tabEmpty}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  ) : imagesError ? (
                    <View style={styles.tabEmpty}>
                      <Text style={styles.emptyTitle}>Lỗi tải hình ảnh</Text>
                      <Text style={styles.emptySub}>{imagesError}</Text>
                    </View>
                  ) : images.length === 0 ? (
                    <View style={styles.tabEmpty}>
                      <View style={styles.emptyImageIcon}>
                        <ImageIcon size={28} color={Colors.textSecondary} />
                      </View>
                      <Text style={styles.emptyTitle}>Chưa có hình ảnh</Text>
                      <Text style={styles.emptySub}>Hiện chưa có chứng từ thanh toán nào</Text>
                    </View>
                  ) : (
                    <View style={styles.imagesGrid}>
                      {images.map((img: any, index: number) => (
                        <TouchableOpacity
                          key={img.id ?? String(index)}
                          accessibilityLabel={img.name ?? "Xem ảnh booking"}
                          onPress={() => {
                            setShowPreviewControls(true);
                            setPreviewIndex(index);
                          }}
                          activeOpacity={0.8}
                          style={styles.imageThumb}
                        >
                          <Image
                            source={{ uri: img.uri }}
                            style={{ width: thumbSize, height: thumbSize, borderRadius: 12 }}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {isActiveBooking && (
                    <TouchableOpacity
                      style={styles.inlineUploadBtn}
                      activeOpacity={0.8}
                      onPress={handlePickImage}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Upload size={16} color={Colors.primary} />
                      )}
                      <Text style={styles.inlineUploadText}>
                        {isUploading ? "Đang tải lên..." : "Tải thêm chứng từ"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      )}

      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <Pressable
          style={styles.previewOverlay}
          onPress={() => setShowPreviewControls((v) => !v)}
        >
          {showPreviewControls && (
            <TouchableOpacity
              onPress={() => setPreviewIndex(null)}
              style={styles.previewClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={28} color="#fff" />
            </TouchableOpacity>
          )}
          {previewIndex !== null && images[previewIndex] && (
            <>
              <Image
                source={{ uri: images[previewIndex].uri }}
                style={styles.previewImg}
                resizeMode="contain"
              />
              {showPreviewControls && images.length > 1 && (
                <>
                  <TouchableOpacity
                    accessibilityLabel="Ảnh trước"
                    accessibilityState={{ disabled: previewIndex === 0 }}
                    onPress={() => setPreviewIndex((i) => (i != null && i > 0 ? i - 1 : i))}
                    style={[
                      styles.previewNav,
                      styles.previewNavLeft,
                      previewIndex === 0 && styles.previewNavDisabled,
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ChevronLeft size={28} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Ảnh tiếp theo"
                    accessibilityState={{ disabled: previewIndex === images.length - 1 }}
                    onPress={() =>
                      setPreviewIndex((i) => (i != null && i < images.length - 1 ? i + 1 : i))
                    }
                    style={[
                      styles.previewNav,
                      styles.previewNavRight,
                      previewIndex === images.length - 1 && styles.previewNavDisabled,
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ChevronRight size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.previewCounter}>
                    {previewIndex + 1} / {images.length}
                  </Text>
                </>
              )}
            </>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F6F3",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topSection: {
    flexWrap: "wrap",
    gap: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  idRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bookingIdText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  amountCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      web: { boxShadow: `0 6px 20px rgba(232, 111, 37, 0.3)` },
    }),
  },
  amountCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  amountTitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500" as const,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: "#fff",
    letterSpacing: -0.5,
  },
  amountDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 12,
  },
  amountMetaRow: {
    gap: 6,
  },
  amountMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  amountMetaText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500" as const,
  },
  tabBarWrap: {
    backgroundColor: "#F8F6F3",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 4,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
    }),
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  tabLabelActive: {
    color: "#fff",
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: "#fff",
  },
  tabContent: {
    minHeight: 300,
  },
  tabEmpty: {
    alignItems: "center",
    paddingVertical: 24,
  },
  priceListName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: -10,
    marginBottom: 12,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  priceRowLabel: {
    flexShrink: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  priceRowValue: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
    textAlign: "right" as const,
  },
  priceTotalBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.featureOrange,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  priceTotalLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  priceTotalValue: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.primary,
    flexShrink: 1,
    textAlign: "right" as const,
  },
  giftItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  giftIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.featureOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  giftTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  giftSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  giftMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  giftMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  giftValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  imageTabHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  inlineUploadBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.primary,
  },
  inlineUploadText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  amountCurrency: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.7)",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
    }),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F8F6F3",
    justifyContent: "center",
    alignItems: "center",
  },
  infoRowLabel: {
    flexShrink: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  infoRowValue: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
    textAlign: "right" as const,
    flex: 1,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  imageButton: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
    }),
  },
  imageButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  imageIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.featureOrange,
    justifyContent: "center",
    alignItems: "center",
  },
  imageButtonTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  imageButtonSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: { boxShadow: `0 4px 12px rgba(232, 111, 37, 0.25)` },
    }),
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#fff",
  },
  paymentButton: {
    flex: 1,
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#1D4ED8",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: { boxShadow: `0 4px 12px rgba(29, 78, 216, 0.25)` },
    }),
  },
  paymentButtonText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#fff",
  },
  uploadedCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
    }),
  },
  uploadedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  uploadedTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  uploadedImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#F8F6F3",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8F6F3",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyImageIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F8F6F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center" as const,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageThumb: {
    borderRadius: 12,
    overflow: "hidden",
  },
  imageThumbImg: {
    width: 110,
    height: 110,
    borderRadius: 12,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImg: {
    width: "100%",
    height: "80%",
  },
  previewNav: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  previewNavLeft: {
    left: 16,
  },
  previewNavRight: {
    right: 16,
  },
  previewNavDisabled: {
    opacity: 0.4,
  },
  previewCounter: {
    position: "absolute",
    bottom: 60,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
