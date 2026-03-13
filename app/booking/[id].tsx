import React, { useEffect, useState } from "react";
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
  TextInput,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Phone,
  Package,
  Clock,
  Upload,
  CreditCard,
  CheckCircle,
  X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { bookings } from "@/mocks/bookings";
import { ProductService } from "../sevices/ProductService";
import { BookingService } from "../sevices/BookingService";
import { CartService } from "../sevices/CartServices";

interface Bank {
  id: string;
  name: string;
  logo: string;
  accountNumber: string;
  accountName: string;
}

const banks: Bank[] = [
  {
    id: "vcb",
    name: "Vietcombank",
    logo: "🏦",
    accountNumber: "1234567890",
    accountName: "CONG TY BDS ABC",
  },
  {
    id: "tcb",
    name: "Techcombank",
    logo: "🏦",
    accountNumber: "0987654321",
    accountName: "CONG TY BDS ABC",
  },
  {
    id: "mb",
    name: "MB Bank",
    logo: "🏦",
    accountNumber: "5555666677",
    accountName: "CONG TY BDS ABC",
  },
  {
    id: "acb",
    name: "ACB",
    logo: "🏦",
    accountNumber: "1112223334",
    accountName: "CONG TY BDS ABC",
  },
];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const mockBooking = bookings?.[0];

  const [data, setData] = useState<any>(null);

  const [showBankSelection, setShowBankSelection] = useState<boolean>(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isDuyet, setIsDuyet] = useState<boolean | null>(null);
  const [dienGiai, setDienGiai] = useState("");
  const [err, setErr] = useState("");

  const [showImagesModal, setShowImagesModal] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await ProductService.getGiuCho({ MaPGC: id });
      setData(res?.data ?? null);
    } catch (error) {
      console.log("load booking error", error);
    }
    setLoading(false)
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const statusConfig = {
    1: {
      text: "Chờ duyệt",
      color: "#B45309",
      bg: "#FEF3C7",
    },
    6: {
      text: "Đã duyệt",
      color: "#047857",
      bg: "#D1FAE5",
    },
    8: {
      text: "Đặt cọc chờ duyệt",
      color: "#92400E",
      bg: "#FEF3C7",
    },
    9: {
      text: "Góp vốn chờ duyệt",
      color: "#374151",
      bg: "#F3F4F6",
    },
    10: {
      text: "HĐMB chờ duyệt",
      color: "#1D4ED8",
      bg: "#DBEAFE",
    },
    11: {
      text: "Đã thanh lý",
      color: "#374151",
      bg: "#F3F4F6",
    },
    12: {
      text: "Thanh lý chờ duyệt",
      color: "#92400E",
      bg: "#FEF3C7",
    },
    13: {
      text: "Đặt cọc đã duyệt",
      color: "#B91C1C",
      bg: "#FEE2E2",
    },
    14: {
      text: "HĐMB đã duyệt",
      color: "#B91C1C",
      bg: "#FEE2E2",
    },
    15: {
      text: "Góp vốn đã duyệt",
      color: "#374151",
      bg: "#F3F4F6",
    },
    16: {
      text: "Hủy booking",
      color: "#991B1B",
      bg: "#FEE2E2",
    },
    17: {
      text: "Bàn giao chờ duyệt",
      color: "#0E7490",
      bg: "#CFFAFE",
    },
    18: {
      text: "Đã duyệt bàn giao",
      color: "#0E7490",
      bg: "#CFFAFE",
    },
    19: {
      text: "Đã cấp sổ đỏ",
      color: "#374151",
      bg: "#F3F4F6",
    },
    20: {
      text: "Thanh lý tất toán chờ duyệt",
      color: "#92400E",
      bg: "#FEF3C7",
    },
    21: {
      text: "Thanh lý tất toán đã duyệt",
      color: "#374151",
      bg: "#E5E7EB",
    },
    22: {
      text: "Kế toán duyệt",
      color: "#1D4ED8",
      bg: "#DBEAFE",
    },
  };

  const statusLabels = {
    waiting: "Chờ thanh toán",
    paid: "Đã thanh toán",
    expired: "Hết hạn",
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
  
      // upload luôn
      handleUploadComplete(uri);
    }
  };
  const handleUploadComplete = async (imageUri: string) => {
    if (!imageUri) {
      Alert.alert("Lỗi", "Vui lòng chọn ảnh chuyển khoản");
      return;
    }
  
    try {
      // setLoading(true);
  
      const formData = new FormData();
  
      formData.append("Image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "payment.jpg",
      } as any);
  
      // upload ảnh
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
            [
              {
                text: "OK",
                onPress: () => router.push("/bookings"),
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
      console.log("Upload error:", error);
      Alert.alert("Lỗi", "Upload ảnh thất bại");
    }
  };
  // const handlePickImage = async () => {
  //   const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  //   if (status !== "granted") {
  //     Alert.alert("Thông báo", "Cần cấp quyền truy cập thư viện ảnh");
  //     return;
  //   }

  //   const result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //     allowsEditing: true,
  //     aspect: [4, 3],
  //     quality: 0.8,
  //   });

  //   if (!result.canceled) {
  //     const uri = result.assets[0].uri;
  //     setUploadedImage(uri);

  //     setTimeout(() => {
  //       handleUploadComplete();
  //     }, 300);
  //   }
  // };

  // const handleUploadComplete = async () => {
  //   if (!uploadedImage) {
  //     Alert.alert("Lỗi", "Vui lòng chọn ảnh chuyển khoản");
  //     return;
  //   }

  //   try {
  //     // setLoading(true);

  //     const formData = new FormData();

  //     formData.append("Image", {
  //       uri: uploadedImage,
  //       type: "image/jpeg",
  //       name: "payment.jpg",
  //     } as any);

  //     // upload ảnh
  //     let res = await CartService.confirmReceiptUpload(formData);

  //     if (res?.length > 0) {
  //       let imgs: any[] = [];

  //       res.map((link: string) => {
  //         imgs.push({ Image: link });
  //       });

  //       let _resBk = await BookingService.addImageBooking({
  //         MaPGC: booking.id,
  //         RequestIMG: imgs,
  //       });

  //       if (_resBk?.status === 2000) {
  //         setLoading(false);

  //         Alert.alert(
  //           "Thành công",
  //           "Ảnh chuyển khoản đã được gửi. Chúng tôi sẽ xác nhận thanh toán trong 15-30 phút.",
  //           [
  //             {
  //               text: "OK",
  //               onPress: () => router.push("/bookings"),
  //             },
  //           ]
  //         );
  //       } else {
  //         setLoading(false);
  //         Alert.alert("Lỗi", "Lỗi thêm ảnh vào booking!");
  //       }
  //     } else {
  //       setLoading(false);
  //       Alert.alert("Lỗi", "Lỗi tải ảnh chuyển khoản");
  //     }
  //   } catch (error) {
  //     setLoading(false);
  //     console.log("Upload error:", error);
  //     Alert.alert("Lỗi", "Upload ảnh thất bại");
  //   }
  // };

  const handleSelectBank = (bank: Bank) => {
    setSelectedBank(bank);
    setShowBankSelection(false);
    setShowQRCode(true);
  };

  const generateQRCode = (bank: Bank) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Bank:${bank.name}%0AAccount:${bank.accountNumber}%0AAmount:${booking.amountValue}%0AContent:Thanh toan booking ${booking.id}`;
  };

  const onSubmit = async () => {
    try {
      const res = await ProductService.postDuyet({
        DienGiai: dienGiai,
        isDuyet: isDuyet,
        MaPGC: booking.id,
      });

      if (res.status === 2000) {
        setShowApproveModal(false);
        router.push("/bookings");
      } else {
        setErr(res.message);
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Booking #${booking.id}`,
          headerStyle: {
            backgroundColor: Colors.white,
          },
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.headerSection}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.bookingLabel}>Mã Booking</Text>
                  <Text style={styles.bookingId}>#{booking.id}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusConfig[booking?.MaTT]?.bg || "#F3F4F6",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: statusConfig[booking?.MaTT]?.color || "#6B7280",
                      },
                    ]}
                  >
                    {statusConfig[booking?.MaTT]?.text || "Không xác định"}
                  </Text>
                </View>
              </View>

              <View style={styles.amountSection}>
                <Text style={styles.amountLabel}>Số tiền</Text>
                <Text style={styles.amount}>{booking.amount} VNĐ</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoSection}>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Package color={Colors.primary} size={18} />
                  </View>
                  <Text style={styles.infoLabel}>Sản phẩm</Text>
                  <Text style={styles.infoValue}>{booking.productCode}</Text>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Text style={styles.emojiSmall}>👤</Text>
                  </View>
                  <Text style={styles.infoLabel}>Khách hàng</Text>
                  <Text style={styles.infoValue}>{booking.customerName}</Text>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Phone color={Colors.primary} size={18} />
                  </View>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValue}>{booking.customerPhone}</Text>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Text style={styles.emojiSmall}>🏢</Text>
                  </View>
                  <Text style={styles.infoLabel}>Dự án</Text>
                  <Text style={styles.infoValue}>{booking.projectName}</Text>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Clock color={Colors.primary} size={18} />
                  </View>
                  <Text style={styles.infoLabel}>Ngày booking</Text>
                  <Text style={styles.infoValue}>
                    {booking.bookingDate
                      ? new Date(booking.bookingDate).toLocaleDateString(
                          "vi-VN"
                        )
                      : ""}
                  </Text>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Calendar color={Colors.primary} size={18} />
                  </View>
                  <Text style={styles.infoLabel}>Ngày hết hạn</Text>
                  <Text style={styles.infoValue}>
                    {booking.expiryDate
                      ? new Date(booking.expiryDate).toLocaleDateString("vi-VN")
                      : ""}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Hình ảnh</Text>

              <TouchableOpacity
                onPress={async () => {
                  await loadImages();
                  setShowImagesModal(true);
                }}
              >
                <Text style={{ color: Colors.primary, fontWeight: "600" }}>
                  Xem hình ảnh
                </Text>
              </TouchableOpacity>
            </View>

            {booking?.MaTT !== 6 && booking?.MaTT !== 16 && (
              <View style={styles.approveRow}>
                <TouchableOpacity
                  style={styles.rejectButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsDuyet(false);
                    setShowApproveModal(true);
                    setErr("");
                  }}
                >
                  <Text style={styles.rejectText}>Hủy duyệt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsDuyet(true);
                    setShowApproveModal(true);
                    setErr("");
                  }}
                >
                  <Text style={styles.approveText}>Duyệt</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {booking?.MaTT !== 6 && booking?.MaTT !== 16 && (
            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>Xác nhận thanh toán</Text>

              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.actionButtonHalf}
                  activeOpacity={0.7}
                  onPress={handlePickImage}
                  disabled={isUploading}
                >
                  <View style={styles.actionIconContainerCompact}>
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Upload color={Colors.white} size={20} />
                    )}
                  </View>

                  <Text style={styles.actionTitleCompact}>Đã thanh toán</Text>
                  <Text style={styles.actionSubtitleCompact}>Tải chứng từ</Text>
                </TouchableOpacity>

                {/* <TouchableOpacity
                style={styles.actionButtonHalf}
                activeOpacity={0.7}
                onPress={() => setShowBankSelection(true)}
              >
                <View style={styles.actionIconContainerCompact}>
                  <CreditCard color={Colors.white} size={20} />
                </View>

                <Text style={styles.actionTitleCompact}>Thanh toán ngay</Text>
                <Text style={styles.actionSubtitleCompact}>Chuyển khoản</Text>
              </TouchableOpacity> */}
              </View>
            </View>
          )}

          {uploadedImage && (
            <View style={styles.uploadedCard}>
              <View style={styles.uploadedHeader}>
                <CheckCircle color={Colors.success} size={24} />
                <Text style={styles.uploadedTitle}>Chứng từ đã tải lên</Text>
              </View>

              <Image
                // source={{ uri: uploadedImage }}

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
        </ScrollView>
      )}

      <Modal
        visible={showBankSelection}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBankSelection(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn ngân hàng</Text>

            <TouchableOpacity
              onPress={() => setShowBankSelection(false)}
              style={styles.closeButton}
            >
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {banks.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                style={styles.bankItem}
                onPress={() => handleSelectBank(bank)}
              >
                <View style={styles.bankLogo}>
                  <Text style={styles.bankLogoText}>{bank.logo}</Text>
                </View>

                <View style={styles.bankInfo}>
                  <Text style={styles.bankName}>{bank.name}</Text>
                  <Text style={styles.bankAccount}>{bank.accountNumber}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showQRCode} animationType="slide">
        <View style={styles.modalContainer}>
          {selectedBank && (
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.qrContent}
            >
              <Image
                source={{ uri: generateQRCode(selectedBank) }}
                style={styles.qrCode}
              />
            </ScrollView>
          )}
        </View>
      </Modal>
      <Modal
        visible={showApproveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApproveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.approveModal}>
            <Text style={styles.modalTitle}>
              {isDuyet ? "Duyệt booking" : "Hủy duyệt booking"}
            </Text>

            <TextInput
              placeholder="Nhập diễn giải..."
              value={dienGiai}
              onChangeText={setDienGiai}
              multiline
              style={styles.input}
            />

            {err ? <Text style={{ color: "red" }}>{err}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowApproveModal(false)}
              >
                <Text style={{ color: "#333" }}>Huỷ</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmBtn} onPress={onSubmit}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Xác nhận
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showImagesModal}
        animationType="slide"
        onRequestClose={() => setShowImagesModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 20,
              borderBottomWidth: 1,
              borderColor: Colors.border,
              paddingTop: 80,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Hình ảnh giao dịch
            </Text>

            <TouchableOpacity onPress={() => setShowImagesModal(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {loadingImages ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : images.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 30,
              }}
            >
              <Text style={{ fontSize: 16, color: Colors.textSecondary }}>
                Đã tải lên tất cả hình ảnh
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: Colors.textSecondary,
                  textAlign: "center",
                }}
              >
                Hiện chưa có chứng từ thanh toán nào
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                padding: 16,
                gap: 10,
              }}
            >
              {/* {images.map((img: any, index: number) => (
                <Image
                  key={index}
                  source={{ uri: img.uri || img.Image || img.HinhAnh }}
                  style={{
                    width: "30%",
                    height: 100,
                    borderRadius: 8,
                  }}
                />
              ))} */}
              {images.map((img: any, index: number) => {
                const uri = img.uri || img.Image || img.HinhAnh;

                return (
                  <TouchableOpacity
                    key={index}
                    // onPress={() => setPreviewImage(uri)}
                    onPress={() => {
                      setShowImagesModal(false);

                      // setTimeout(() => {
                      setPreviewImage(uri);
                      // }, 250);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: 110,
                        height: 100,
                        borderRadius: 8,
                      }}
                    />
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
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.95)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* nút đóng */}
          <TouchableOpacity
            onPress={() => {
              setPreviewImage(null);
              setShowImagesModal(true);
            }}
            style={{
              position: "absolute",
              top: 50,
              right: 20,
              zIndex: 10,
            }}
          >
            <X size={30} color="#fff" />
          </TouchableOpacity>

          {/* ảnh phóng to */}
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={{
                width: "100%",
                height: "80%",
              }}
              contentFit="contain"
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
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 16px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  headerSection: {
    gap: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bookingLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bookingId: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  amountSection: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  dividerSmall: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  infoSection: {
    gap: 12,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoItem: {
    width: "48%",
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 12,
    gap: 6,
  },
  infoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emojiSmall: {
    fontSize: 16,
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "700" as const,
    lineHeight: 18,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 16px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 16,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButtonHalf: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  actionIconContainerCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTitleCompact: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
    textAlign: "center" as const,
  },
  actionSubtitleCompact: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center" as const,
  },
  uploadedCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 2px 16px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  uploadedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  uploadedTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  uploadedImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.white,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  bankItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bankLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  bankLogoText: {
    fontSize: 32,
  },
  bankInfo: {
    flex: 1,
    gap: 4,
  },
  bankName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  bankAccount: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  qrContent: {
    padding: 24,
    gap: 20,
  },
  bankInfoCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  bankHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bankLogoLarge: {
    fontSize: 48,
  },
  bankNameLarge: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  bankAccountLarge: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  bankDetails: {
    gap: 4,
  },
  bankDetailLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bankDetailValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  qrCodeCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 20,
  },
  qrCode: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  paymentInfo: {
    width: "100%",
    gap: 12,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  noteCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },

  approveRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  approveButton: {
    flex: 1,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  rejectButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  approveText: {
    color: "#fff",
    fontWeight: "700" as const,
    fontSize: 14,
  },

  rejectText: {
    color: "#fff",
    fontWeight: "700" as const,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  approveModal: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    marginTop: 12,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 10,
  },

  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
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
