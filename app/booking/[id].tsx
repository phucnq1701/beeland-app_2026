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
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
  Hash,
  Banknote,
  CreditCard,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { CartService } from "@/sevices/CartServices";

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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const [showImagesModal, setShowImagesModal] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fadeAnim = useState(new Animated.Value(0))[0];

  const loadData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);
    setData(null);
    try {
      const res = await BookingService.getBookingEditDetail(String(id ?? ""));
      if (version === requestVersion.current) setData(res?.data ?? null);
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
    setUploadedImage(null);
    void loadData();
    return () => { requestVersion.current += 1; };
  }, [loadData]);

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

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Thông báo", "Cần cấp quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      void handleUploadComplete(uri);
    }
  };

  const handleUploadComplete = async (imageUri: string) => {
    if (!imageUri) {
      Alert.alert("Lỗi", "Vui lòng chọn ảnh chuyển khoản");
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("Image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "payment.jpg",
      } as any);
      const res = await CartService.confirmReceiptUpload(formData);
      if (res?.length > 0) {
        const imgs: any[] = [];
        res.forEach((link: string) => {
          imgs.push({ Image: link });
        });
        const _resBk = await BookingService.addImageBooking({
          MaPGC: data?.maPGC ?? data?.soPhieu,
          RequestIMG: imgs,
        });
        if (_resBk?.status === 2000) {
          setUploadedImage(imageUri);
          Alert.alert(
            "Thành công",
            "Ảnh chuyển khoản đã được gửi. Chúng tôi sẽ xác nhận thanh toán trong 15-30 phút.",
            [{ text: "OK", onPress: () => router.push("/bookings") }]
          );
        } else {
          Alert.alert("Lỗi", "Lỗi thêm ảnh vào booking!");
        }
      } else {
        Alert.alert("Lỗi", "Lỗi tải ảnh chuyển khoản");
      }
    } catch (error) {
      console.log("Upload error:", error);
      Alert.alert("Lỗi", "Upload ảnh thất bại");
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
  ].filter((row) => data?.price?.[row.key] != null);

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
          >
            <View style={styles.topSection}>
              <View style={styles.idRow}>
                <Hash size={16} color={Colors.textSecondary} />
                <Text style={styles.bookingIdText}>{booking.soPhieu ?? "—"}</Text>
              </View>
              {currentStatus && (
                <View style={[styles.statusChip, { backgroundColor: statusBgColor }]}>
                  <Text style={styles.statusIcon}>{currentStatus.icon}</Text>
                  <Text style={[styles.statusLabel, { color: statusFgColor }]}>
                    {data?.tenTT || currentStatus.text}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.amountCard}>
              <View style={styles.amountCardInner}>
                <Banknote size={20} color="#fff" />
                <Text style={styles.amountTitle}>Giá trị hợp đồng</Text>
              </View>
              <Text style={styles.amountValue}>{booking.amount ?? "—"} <Text style={styles.amountCurrency}>VNĐ</Text></Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Thông tin booking</Text>
              <InfoRow
                icon={<Package size={16} color={Colors.primary} />}
                label="Sản phẩm"
                value={booking.productCode}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<User size={16} color={Colors.accent.blue} />}
                label="Khách hàng"
                value={booking.customerName}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Phone size={16} color={Colors.accent.green} />}
                label="Điện thoại"
                value={booking.customerPhone}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Building2 size={16} color={Colors.accent.purple} />}
                label="Dự án"
                value={booking.projectName}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<User size={16} color={Colors.accent.blue} />}
                label="CCCD"
                value={booking.customerCccd}
              />
              <View style={styles.separator} />
              <InfoRow icon={<User size={16} color={Colors.primary} />} label="Mã khách hàng" value={data?.customer?.maSoKH} />
              <InfoRow icon={<User size={16} color={Colors.primary} />} label="Email" value={booking.customerEmail} />
              <InfoRow icon={<Building2 size={16} color={Colors.primary} />} label="Địa chỉ" value={data?.customer?.diaChi} />
              <View style={styles.separator} />
              <InfoRow
                icon={<Banknote size={16} color={Colors.accent.green} />}
                label="Tiền giữ chỗ"
                value={booking.tienGiuCho ? `${booking.tienGiuCho} VNĐ` : null}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Building2 size={16} color={Colors.accent.purple} />}
                label="Sàn giao dịch"
                value={booking.sanName}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<User size={16} color={Colors.accent.blue} />}
                label="Nhân viên"
                value={booking.nhanVien}
              />
              <InfoRow icon={<Clock size={16} color={Colors.primary} />} label="Thời gian giữ chỗ" value={data?.thoiGianBooking != null ? `${fmtNumber(data.thoiGianBooking)} phút` : null} />
              <InfoRow icon={<CheckCircle size={16} color={Colors.primary} />} label="Booking ưu tiên" value={data?.uuTien == null ? null : data.uuTien ? "Có" : "Không"} />
              <InfoRow icon={<Banknote size={16} color={Colors.primary} />} label="Đã thu" value={money(data?.daThu)} />
              <View style={styles.separator} />
              <InfoRow
                icon={<Package size={16} color={Colors.primary} />}
                label="Bảng giá"
                value={booking.priceListName}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Package size={16} color={Colors.primary} />}
                label="Chính sách bán hàng"
                value={booking.policyName}
              />
              <View style={styles.separator} />
              <InfoRow icon={<Package size={16} color={Colors.primary} />} label="Cấu hình tính giá" value={data?.pricingConfig?.name ?? data?.pricingConfig?.ten_cau_hinh ?? data?.pricingConfig?.ten_cs ?? data?.maCSTong} />
              <View style={styles.separator} />
              <InfoRow
                icon={<Package size={16} color={Colors.primary} />}
                label="Tiến độ thanh toán"
                value={booking.paymentScheduleName}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Clock size={16} color={Colors.accent.cyan} />}
                label="Ngày booking"
                value={dateTime(booking.bookingDate)}
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Calendar size={16} color={Colors.accent.orange} />}
                label="Hết hạn lúc"
                value={dateTime(booking.expiryDate)}
              />
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Thông tin giá sản phẩm theo bảng giá</Text>
              {data?.priceSource === "bds_products" && (
                <Text style={styles.emptySub}>Chưa có dòng giá theo bảng giá đã chọn. Hiển thị giá từ sản phẩm.</Text>
              )}
              {[...priceRows, ...lowRiseRows].map((row) => (
                <InfoRow
                  key={row.key}
                  icon={<Banknote size={16} color={Colors.primary} />}
                  label={row.label}
                  value={row.unit
                    ? (fmtNumber(data?.price?.[row.key]) != null ? `${fmtNumber(data.price[row.key])} ${row.unit}` : null)
                    : money(data?.price?.[row.key])}
                />
              ))}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Quà tặng / Khuyến mãi</Text>
              {!data?.promotions?.length ? (
                <Text style={styles.emptySub}>Chưa có quà tặng được chọn</Text>
              ) : data.promotions.map((promotion: any, index: number) => (
                <View key={`${promotion.id ?? "gift"}-${index}`}>
                  {index > 0 && <View style={styles.separator} />}
                  <InfoRow icon={<Package size={16} color={Colors.primary} />} label="Khuyến mãi" value={promotion.tenKhuyenMai} />
                  <InfoRow icon={<Package size={16} color={Colors.primary} />} label="Quà tặng" value={promotion.tenQuaTang} />
                  <InfoRow icon={<Hash size={16} color={Colors.primary} />} label="Số lượng" value={fmtNumber(promotion.soLuong)} />
                  <InfoRow icon={<Banknote size={16} color={Colors.primary} />} label="Giá trị" value={money(promotion.giaTri)} />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.imageButton}
              activeOpacity={0.7}
              onPress={async () => {
                setShowImagesModal(true);
                await loadImages();
              }}
            >
              <View style={styles.imageButtonLeft}>
                <View style={styles.imageIconCircle}>
                  <ImageIcon size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.imageButtonTitle}>Hình ảnh giao dịch</Text>
                  <Text style={styles.imageButtonSub}>Xem chứng từ đã tải lên</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

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
                    Alert.alert(
                      "Thanh toán",
                      "Bạn muốn thanh toán booking này?",
                      [
                        { text: "Không", style: "cancel" },
                        {
                          text: "Thanh toán",
                          onPress: () => {
                            router.push({
                              pathname: "/booking/qr-payment",
                              params: { bookingId: booking.soPhieu ?? booking.id },
                            });
                          },
                        },
                      ]
                    );
                  }}
                >
                  <CreditCard size={18} color="#fff" />
                  <Text style={styles.paymentButtonText}>Thanh toán</Text>
                </TouchableOpacity>
              </View>
            )}

            {uploadedImage && (
              <View style={styles.uploadedCard}>
                <View style={styles.uploadedHeader}>
                  <CheckCircle color={Colors.success} size={20} />
                  <Text style={styles.uploadedTitle}>Đã tải lên thành công</Text>
                </View>
                <Image
                  source={{
                    uri:
                      Platform.OS === "ios"
                        ? uploadedImage
                        : uploadedImage.replace("file://", ""),
                  }}
                  style={styles.uploadedImage}
                />
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      )}

      <Modal
        visible={showImagesModal}
        animationType="slide"
        onRequestClose={() => setShowImagesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Hình ảnh giao dịch</Text>
            <TouchableOpacity
              onPress={() => setShowImagesModal(false)}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {loadingImages ? (
            <View style={styles.modalCentered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : imagesError ? (
            <View style={styles.modalCentered}>
              <Text style={styles.emptyTitle}>Lỗi tải hình ảnh</Text>
              <Text style={styles.emptySub}>{imagesError}</Text>
              <TouchableOpacity onPress={() => void loadImages()} style={styles.imageButton}>
                <Text style={styles.imageButtonTitle}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : images.length === 0 ? (
            <View style={styles.modalCentered}>
              <View style={styles.emptyImageIcon}>
                <ImageIcon size={32} color={Colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có hình ảnh</Text>
              <Text style={styles.emptySub}>Hiện chưa có chứng từ thanh toán nào</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.imagesGrid}
            >
              {images.map((img: any, index: number) => {
                const uri = img.uri;
                return (
                  <TouchableOpacity
                    key={img.id ?? String(index)}
                    accessibilityLabel={img.name ?? "Xem ảnh booking"}
                    onPress={() => {
                      setShowImagesModal(false);
                      setPreviewImage(uri);
                    }}
                    activeOpacity={0.8}
                    style={styles.imageThumb}
                  >
                    <Image source={{ uri }} style={styles.imageThumbImg} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPreviewImage(null);
          setShowImagesModal(true);
        }}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            onPress={() => {
              setPreviewImage(null);
              setShowImagesModal(true);
            }}
            style={styles.previewClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImg}
              resizeMode="contain"
            />
          )}
        </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bookingIdText: {
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
    marginTop: 4,
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
    padding: 16,
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
});
