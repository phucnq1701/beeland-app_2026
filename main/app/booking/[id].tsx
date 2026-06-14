import React, { useEffect, useState, useCallback } from "react";
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
import { bookings } from "@/mocks/bookings";
import { ProductService } from "@/sevices/ProductService";
import { BookingService } from "@/sevices/BookingService";
import { CartService } from "@/sevices/CartServices";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const mockBooking = bookings?.[0];

  const [data, setData] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const [showImagesModal, setShowImagesModal] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fadeAnim = useState(new Animated.Value(0))[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ProductService.getGiuCho({ MaPGC: id });
      setData(res?.data ?? null);
    } catch (error) {
      console.log("load booking error", error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadData();
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
      const res = await BookingService.getListImageGC({
        maPGC: booking.id,
      });
      setImages(res?.data ?? []);
    } catch (error) {
      console.log("load images error", error);
    } finally {
      setLoadingImages(false);
    }
  };

  const booking = {
    id: data?.MaPGC ?? mockBooking?.id ?? null,
    amountValue: data?.TongGiaTriHD ?? mockBooking?.amountValue ?? 0,
    amount: data?.TongGiaTriHD
      ? new Intl.NumberFormat("vi-VN").format(data.TongGiaTriHD)
      : mockBooking?.amount ?? null,
    productCode: data?.MaSanPham ?? mockBooking?.productCode ?? null,
    customerName: data?.HoTenKH ?? mockBooking?.customerName ?? null,
    customerPhone: data?.DienThoai ?? mockBooking?.customerPhone ?? null,
    projectName: data?.TenDuan ?? mockBooking?.projectName ?? null,
    bookingDate: data?.NgayGD ?? mockBooking?.bookingDate ?? null,
    expiryDate: mockBooking?.expiryDate ?? null,
    status: data?.MaTT,
    MaTT: data?.MaTT,
  };

  const statusConfig: Record<number, { text: string; color: string; bg: string; icon: string }> = {
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
      setUploadedImage(uri);
      void handleUploadComplete(uri);
    }
  };

  const handleUploadComplete = async (imageUri: string) => {
    if (!imageUri) {
      Alert.alert("Lỗi", "Vui lòng chọn ảnh chuyển khoản");
      return;
    }
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
          MaPGC: booking.id,
          RequestIMG: imgs,
        });
        if (_resBk?.status === 2000) {
          setLoading(false);
          Alert.alert(
            "Thành công",
            "Ảnh chuyển khoản đã được gửi. Chúng tôi sẽ xác nhận thanh toán trong 15-30 phút.",
            [{ text: "OK", onPress: () => router.push("/bookings") }]
          );
        } else {
          setLoading(false);
          Alert.alert("Lỗi", "Lỗi thêm ảnh vào booking!");
        }
      } else {
        setLoading(false);
        Alert.alert("Lỗi", "Lỗi tải ảnh chuyển khoản");
      }
    } catch (error) {
      setLoading(false);
      console.log("Upload error:", error);
      Alert.alert("Lỗi", "Upload ảnh thất bại");
    }
  };

  if (!booking) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Chi tiết Booking" }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không tìm thấy booking</Text>
        </View>
      </View>
    );
  }

  const currentStatus = statusConfig[booking?.MaTT as number];
  const isActiveBooking = booking?.MaTT !== 6 && booking?.MaTT !== 16;

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconCircle}>{icon}</View>
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={styles.infoRowValue} numberOfLines={2}>{value || "—"}</Text>
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
                <Text style={styles.bookingIdText}>{booking.id}</Text>
              </View>
              {currentStatus && (
                <View style={[styles.statusChip, { backgroundColor: currentStatus.bg }]}>
                  <Text style={styles.statusIcon}>{currentStatus.icon}</Text>
                  <Text style={[styles.statusLabel, { color: currentStatus.color }]}>
                    {currentStatus.text}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.amountCard}>
              <View style={styles.amountCardInner}>
                <Banknote size={20} color="#fff" />
                <Text style={styles.amountTitle}>Giá trị hợp đồng</Text>
              </View>
              <Text style={styles.amountValue}>{booking.amount} <Text style={styles.amountCurrency}>VNĐ</Text></Text>
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
                icon={<Clock size={16} color={Colors.accent.cyan} />}
                label="Ngày booking"
                value={
                  booking.bookingDate
                    ? new Date(booking.bookingDate).toLocaleDateString("vi-VN")
                    : null
                }
              />
              <View style={styles.separator} />
              <InfoRow
                icon={<Calendar size={16} color={Colors.accent.orange} />}
                label="Ngày hết hạn"
                value={
                  booking.expiryDate
                    ? new Date(booking.expiryDate).toLocaleDateString("vi-VN")
                    : null
                }
              />
            </View>

            <TouchableOpacity
              style={styles.imageButton}
              activeOpacity={0.7}
              onPress={async () => {
                await loadImages();
                setShowImagesModal(true);
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
                  {loading ? (
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
                              params: { bookingId: booking.id },
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
                const uri = img.uri || img.Image || img.HinhAnh;
                return (
                  <TouchableOpacity
                    key={index}
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
