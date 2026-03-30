import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Alert,
  Share,
  Modal,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Copy, Share2, Check, ArrowLeft, Upload, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import { customers } from "@/mocks/customers";
import { CartService } from "@/sevices/CartServices";
import { CustomerService } from "@/sevices/CustomerService";
import { BookingService } from "@/sevices/BookingService";



export default function QRPaymentScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{
    customerId: string;
  }>();
  const { bookingId } = useLocalSearchParams();
  const [selectedBank, setSelectedBank] = useState<any>({});
  const [copied, setCopied] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [nganHang, setNganHang] = useState<any[]>([]);
  const [imgQR, setImgQR] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    const result = await CartService.getBanks();
    setNganHang(result.data ?? []);
    setSelectedBank(result?.data[0]);

    let _payload = {
      accountNo: result?.data[0]?.SoTK,
      accountName: result?.data[0]?.ChuTaiKhoan,
      acqId: 970436,
      addInfo: "Thanh toán booking",
      amount: 50000000,
      template: "compact",
    };

    let _resQR = await CustomerService.getQRCode(_payload);
    setImgQR(_resQR.data);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const customer = customers.find((c) => c.id === customerId);
  const bookingAmount = 50000000;

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const bookingIdStr = String(bookingId ?? "");



  const handleCopyAccount = async () => {
    await Clipboard.setStringAsync(selectedBank.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyContent = async () => {
    await Clipboard.setStringAsync(`Thanh toan booking ${bookingIdStr}`);
    Alert.alert("Thành công", "Đã sao chép nội dung chuyển khoản");
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Thông tin chuyển khoản:\nNgân hàng: ${String(
          selectedBank.name ?? ""
        )}\nSố TK: ${String(selectedBank.accountNumber ?? "")}\nChủ TK: ${String(
          selectedBank.accountName ?? ""
        )}\nSố tiền: ${formatCurrency(
          bookingAmount
        )}\nNội dung: Thanh toan booking ${bookingIdStr}`,
      });
    } catch (error) {
      console.error("[QRPayment] Share error:", error);
    }
  };

  const handleCheckPayment = async () => {
    setIsChecking(true);

    setTimeout(() => {
      setIsChecking(false);

      Alert.alert(
        "Xác nhận thanh toán",
        "Booking đang xác nhận chuyển khoản, nếu bạn đã thanh toán bạn có thể upload ảnh chuyển khoản?",
        [
          {
            text: "Không",
            style: "cancel",
            onPress: () => {
              router.push("/bookings");
            },
          },
          {
            text: "Có",
            onPress: () => {
              setShowUploadModal(true);
            },
          },
        ]
      );
    }, 1500);
  };

  const handleSelectImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Lỗi", "Bạn cần cấp quyền truy cập thư viện ảnh!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadedImage(result.assets[0].uri);
    }
  };

  const handleUploadComplete = async () => {
    if (!uploadedImage) {
      Alert.alert("Lỗi", "Vui lòng chọn ảnh chuyển khoản");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("Image", {
        uri: uploadedImage,
        type: "image/jpeg",
        name: "payment.jpg",
      } as any);

      // upload ảnh
      let res = await CartService.confirmReceiptUpload(formData);

      if (res?.length > 0) {
        const imgs: { Image: string }[] = [];

        res.map((link: string) => {
          imgs.push({ Image: link });
        });

        // bookingId chính là maPGC
        let _resBk = await BookingService.addImageBooking({
          MaPGC: bookingIdStr,
          RequestIMG: imgs,
        });

        if (_resBk?.status === 2000) {
          setShowUploadModal(false);
          setLoading(false);

          Alert.alert(
            "Thành công",
            "Ảnh chuyển khoản đã được gửi. Chúng tôi sẽ xác nhận thanh toán trong 15-30 phút.",
            [
              {
                text: "OK",
                onPress: () => {
                  router.dismissAll();
                  router.push("/bookings");
                },
              },
            ]
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
      Alert.alert("Lỗi", "Upload ảnh thất bại");
      console.log("Upload error:", error);
    }
  };

  const handleSelectBank = async (bank: any) => {
    setLoading(true);
    let _payload = {
      accountNo: bank?.SoTK,
      accountName: bank?.ChuTaiKhoan,
      acqId: 970436,
      addInfo: "Thanh toán booking",
      amount: 50000000,
      template: "compact",
    };

    let _resQR = await CustomerService.getQRCode(_payload);
    setImgQR(_resQR.data);
    setSelectedBank(bank);
    setLoading(false);
  };

  return (
    <>
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#f5ca1c" />
          <Text style={{ marginTop: 10 }}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <Stack.Screen
            options={{
              title: "Thanh toán QR Code",
              headerStyle: {
                backgroundColor: Colors.white,
              },
              headerTintColor: Colors.text,
              headerShadowVisible: false,
            }}
          />

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerSection}>
              <Text style={styles.headerTitle}>Quét mã QR để thanh toán</Text>
              <Text style={styles.headerSubtitle}>
                Sử dụng ứng dụng ngân hàng để quét mã QR
              </Text>
            </View>

            {customer && (
              <View style={styles.customerInfoCard}>
                <View style={styles.customerInfoRow}>
                  <Text style={styles.customerInfoLabel}>Khách hàng:</Text>
                  <Text style={styles.customerInfoValue}>{customer.name}</Text>
                </View>
                <View style={styles.customerInfoRow}>
                  <Text style={styles.customerInfoLabel}>Mã booking:</Text>
                  <Text style={styles.customerInfoValue}>#{bookingIdStr}</Text>
                </View>
              </View>
            )}
            <View style={styles.bankSelector}>
              <Text style={styles.sectionTitle}>Chọn ngân hàng</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {nganHang.map((bank) => {
                  const isSelected = selectedBank?.MaNH === bank.MaNH;

                  return (
                    <TouchableOpacity
                      key={bank.MaNH}
                      style={[
                        styles.bankButton,
                        isSelected && styles.bankButtonSelected,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectBank(bank)}
                    >
                      {/* Logo placeholder */}
                      <Text style={styles.bankLogo}>🏦</Text>

                      <Text
                        style={[
                          styles.bankName,
                          isSelected && styles.bankNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {bank.TeNH}
                      </Text>

                      {bank.SoTK ? (
                        <Text style={styles.bankAccount} numberOfLines={1}>
                          {bank.SoTK}
                        </Text>
                      ) : (
                        <Text style={styles.bankAccountEmpty}>
                          Chưa cấu hình
                        </Text>
                      )}

                      {isSelected && (
                        <View style={styles.bankCheck}>
                          <Check color={Colors.white} size={16} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            {/* 
        <View style={styles.bankSelector}>
          <Text style={styles.sectionTitle}>Chọn ngân hàng</Text>
          <View style={styles.bankList}>
            {nganHang.map((bank) => (
              <TouchableOpacity
                key={bank.MaNH}
                style={[
                  styles.bankButton,
                  selectedBank.MaNH === bank.MaNH && styles.bankButtonSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedBank(bank)}
              >
                <Text style={styles.bankLogo}>{bank.logo}</Text>
                <Text
                  style={[
                    styles.bankName,
                    selectedBank.MaNH === bank.MaNH && styles.bankNameSelected,
                  ]}
                >
                  {bank.TeNH}
                </Text>
                {selectedBank.MaNH === bank.MaNH && (
                  <View style={styles.bankCheck}>
                    <Check color={Colors.white} size={16} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View> */}

            <View style={styles.qrContainer}>
              <View style={styles.qrCard}>
                <Image
                  source={{ uri: imgQR?.qrDataURL }}
                  style={styles.qrCode}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrHint}>
                Quét mã này bằng app ngân hàng của bạn
              </Text>
            </View>

            <View style={styles.bankInfoCard}>
              <View style={styles.bankInfoHeader}>
                <Text style={styles.bankInfoLogo}>🏦</Text>

                <View style={styles.bankInfoTextContainer}>
                  <Text style={styles.bankInfoName}>{selectedBank.TeNH}</Text>
                  <Text style={styles.bankInfoCode}>{selectedBank.TruSo}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Số tài khoản:</Text>
                  <View style={styles.infoValueContainer}>
                    <Text style={styles.infoValue}>{selectedBank.SoTK}</Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={handleCopyAccount}
                      activeOpacity={0.7}
                    >
                      {copied ? (
                        <Check color={Colors.primary} size={18} />
                      ) : (
                        <Copy color={Colors.primary} size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Chủ tài khoản:</Text>
                  <Text style={styles.infoValue}>
                    {selectedBank.ChuTaiKhoan}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Số tiền:</Text>
                  <Text style={[styles.infoValue, styles.amountValue]}>
                    {formatCurrency(bookingAmount)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nội dung:</Text>
                  <View style={styles.infoValueContainer}>
                    <Text style={styles.infoValue}>
                      Thanh toan booking {bookingIdStr}
                    </Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={handleCopyContent}
                      activeOpacity={0.7}
                    >
                      <Copy color={Colors.primary} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={handleShare}
              >
                <Share2 color={Colors.primary} size={20} />
                <Text style={styles.actionButtonText}>Chia sẻ</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>📝 Lưu ý quan trọng:</Text>
              <Text style={styles.noteText}>
                • Vui lòng chuyển khoản ĐÚNG SỐ TIỀN và NỘI DUNG
              </Text>
              <Text style={styles.noteText}>
                • Nội dung chuyển khoản phải chính xác để hệ thống tự động xác
                nhận
              </Text>
              <Text style={styles.noteText}>
                • Thời gian xác nhận: 15-30 phút sau khi chuyển khoản
              </Text>
              <Text style={styles.noteText}>
                • Nếu chuyển sai thông tin, vui lòng liên hệ: 1900 xxxx
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.completeButton,
                isChecking && styles.completeButtonDisabled,
              ]}
              activeOpacity={0.8}
              onPress={handleCheckPayment}
              disabled={isChecking}
            >
              {isChecking ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.completeButtonText}>
                  Kiểm tra thanh toán
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <ArrowLeft color={Colors.text} size={20} />
              <Text style={styles.backButtonText}>Quay lại</Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={showUploadModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowUploadModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Upload ảnh chuyển khoản</Text>
                  <TouchableOpacity
                    onPress={() => setShowUploadModal(false)}
                    style={styles.closeButton}
                  >
                    <X color={Colors.text} size={24} />
                  </TouchableOpacity>
                </View>

                <View style={styles.uploadSection}>
                  {uploadedImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: uploadedImage }}
                        style={styles.imagePreview}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setUploadedImage(null)}
                      >
                        <X color={Colors.white} size={20} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={handleSelectImage}
                      activeOpacity={0.7}
                    >
                      <Upload color={Colors.primary} size={40} />
                      <Text style={styles.uploadButtonText}>
                        Chọn ảnh từ thư viện
                      </Text>
                      <Text style={styles.uploadButtonHint}>
                        Chụp hoặc chọn ảnh xác nhận chuyển khoản
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowUploadModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalConfirmButton,
                      !uploadedImage && styles.modalConfirmButtonDisabled,
                    ]}
                    onPress={handleUploadComplete}
                    activeOpacity={0.7}
                    disabled={!uploadedImage}
                  >
                    <Text style={styles.modalConfirmButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 140,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  customerInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  customerInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerInfoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  customerInfoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: "700" as const,
  },
  bankSelector: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 12,
  },
  bankList: {
    flexDirection: "row",
    gap: 12,
  },
  bankButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    position: "relative" as const,
  },
  bankButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#F0F9FF",
  },
  bankLogo: {
    fontSize: 32,
  },
  bankName: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
    textAlign: "center",
  },
  bankNameSelected: {
    color: Colors.primary,
  },
  bankAccount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  bankAccountEmpty: {
    fontSize: 12,
    color: "#ef4444",
    fontStyle: "italic",
  },
  bankCheck: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
      },
    }),
  },
  qrCode: {
    width: 280,
    height: 280,
  },
  qrHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic" as const,
  },
  bankInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
      },
    }),
  },
  bankInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  bankInfoLogo: {
    fontSize: 48,
  },
  bankInfoTextContainer: {
    flex: 1,
  },
  bankInfoName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  bankInfoCode: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  infoSection: {
    gap: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
    flex: 1,
  },
  infoValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end",
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "600" as const,
    textAlign: "right",
  },
  amountValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "700" as const,
  },
  copyButton: {
    padding: 4,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  noteCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 20,
  },
  bottomContainer: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  completeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: "dashed" as const,
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  uploadButtonHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  imagePreviewContainer: {
    position: "relative" as const,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.background,
  },
  imagePreview: {
    width: "100%",
    height: 400,
  },
  removeImageButton: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmButtonDisabled: {
    opacity: 0.5,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
