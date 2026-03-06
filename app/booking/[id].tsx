import React, { useState } from 'react';
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
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  Phone,
  Package,
  Clock,
  Upload,
  CreditCard,
  CheckCircle,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { bookings } from '@/mocks/bookings';

interface Bank {
  id: string;
  name: string;
  logo: string;
  accountNumber: string;
  accountName: string;
}

const banks: Bank[] = [
  {
    id: 'vcb',
    name: 'Vietcombank',
    logo: '🏦',
    accountNumber: '1234567890',
    accountName: 'CONG TY BDS ABC',
  },
  {
    id: 'tcb',
    name: 'Techcombank',
    logo: '🏦',
    accountNumber: '0987654321',
    accountName: 'CONG TY BDS ABC',
  },
  {
    id: 'mb',
    name: 'MB Bank',
    logo: '🏦',
    accountNumber: '5555666677',
    accountName: 'CONG TY BDS ABC',
  },
  {
    id: 'acb',
    name: 'ACB',
    logo: '🏦',
    accountNumber: '1112223334',
    accountName: 'CONG TY BDS ABC',
  },
];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = bookings.find((b) => b.id === id);

  const [showBankSelection, setShowBankSelection] = useState<boolean>(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  if (!booking) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chi tiết Booking' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không tìm thấy booking</Text>
        </View>
      </View>
    );
  }

  const statusColors = {
    waiting: '#F59E0B',
    paid: '#10B981',
    expired: '#EF4444',
  };

  const statusBgColors = {
    waiting: '#FEF3C7',
    paid: '#D1FAE5',
    expired: '#FEE2E2',
  };

  const statusLabels = {
    waiting: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    expired: 'Hết hạn',
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Thông báo', 'Cần cấp quyền truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setIsUploading(true);
      setTimeout(() => {
        setUploadedImage(result.assets[0].uri);
        setIsUploading(false);
        Alert.alert(
          'Thành công',
          'Chứng từ đã được tải lên. Chúng tôi sẽ xác nhận trong 24h.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }, 1500);
    }
  };

  const handleSelectBank = (bank: Bank) => {
    setSelectedBank(bank);
    setShowBankSelection(false);
    router.push(`/payment/${booking.id}`);
  };

  const generateQRCode = (bank: Bank) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Bank:${bank.name}%0AAccount:${bank.accountNumber}%0AAmount:${booking.amountValue}%0AContent:Thanh toan booking ${booking.id}`;
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
                  { backgroundColor: statusBgColors[booking.status] },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColors[booking.status] }]}>
                  {statusLabels[booking.status]}
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
                  {new Date(booking.bookingDate).toLocaleDateString('vi-VN')}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoIconWrapper}>
                  <Calendar color={Colors.primary} size={18} />
                </View>
                <Text style={styles.infoLabel}>Ngày hết hạn</Text>
                <Text style={styles.infoValue}>
                  {new Date(booking.expiryDate).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {booking.status === 'waiting' && (
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
                  {isUploading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Upload color={Colors.white} size={20} />
                  )}
                </View>
                <Text style={styles.actionTitleCompact}>Đã thanh toán</Text>
                <Text style={styles.actionSubtitleCompact}>Tải chứng từ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonHalf}
                activeOpacity={0.7}
                onPress={() => setShowBankSelection(true)}
              >
                <View style={styles.actionIconContainerCompact}>
                  <CreditCard color={Colors.white} size={20} />
                </View>
                <Text style={styles.actionTitleCompact}>Thanh toán ngay</Text>
                <Text style={styles.actionSubtitleCompact}>Chuyển khoản</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {uploadedImage && (
          <View style={styles.uploadedCard}>
            <View style={styles.uploadedHeader}>
              <CheckCircle color={Colors.success} size={24} />
              <Text style={styles.uploadedTitle}>Chứng từ đã tải lên</Text>
            </View>
            <Image source={{ uri: uploadedImage }} style={styles.uploadedImage} />
          </View>
        )}
      </ScrollView>

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

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {banks.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                style={styles.bankItem}
                onPress={() => handleSelectBank(bank)}
                activeOpacity={0.7}
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

      <Modal
        visible={showQRCode}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQRCode(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thanh toán</Text>
            <TouchableOpacity
              onPress={() => {
                setShowQRCode(false);
                setSelectedBank(null);
              }}
              style={styles.closeButton}
            >
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.qrContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedBank && (
              <>
                <View style={styles.bankInfoCard}>
                  <View style={styles.bankHeader}>
                    <Text style={styles.bankLogoLarge}>{selectedBank.logo}</Text>
                    <View>
                      <Text style={styles.bankNameLarge}>{selectedBank.name}</Text>
                      <Text style={styles.bankAccountLarge}>
                        {selectedBank.accountNumber}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.bankDetails}>
                    <Text style={styles.bankDetailLabel}>Chủ tài khoản</Text>
                    <Text style={styles.bankDetailValue}>{selectedBank.accountName}</Text>
                  </View>
                </View>

                <View style={styles.qrCodeCard}>
                  <Text style={styles.qrTitle}>Quét mã QR để thanh toán</Text>
                  <Image
                    source={{ uri: generateQRCode(selectedBank) }}
                    style={styles.qrCode}
                    resizeMode="contain"
                  />
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Số tiền:</Text>
                      <Text style={styles.paymentValue}>{booking.amount} VNĐ</Text>
                    </View>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Nội dung:</Text>
                      <Text style={styles.paymentValue}>
                        Thanh toan booking {booking.id}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>Lưu ý:</Text>
                  <Text style={styles.noteText}>
                    • Vui lòng chuyển đúng số tiền và nội dung
                  </Text>
                  <Text style={styles.noteText}>
                    • Sau khi chuyển khoản, vui lòng chờ xác nhận
                  </Text>
                  <Text style={styles.noteText}>
                    • Thời gian xác nhận: 15-30 phút
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  headerSection: {
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bookingId: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
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
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 32,
    fontWeight: '800' as const,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '48%',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emojiSmall: {
    fontSize: 16,
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700' as const,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonHalf: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionIconContainerCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitleCompact: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center' as const,
  },
  actionSubtitleCompact: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center' as const,
  },
  uploadedCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  uploadedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  uploadedTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600' as const,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bankLogoLarge: {
    fontSize: 48,
  },
  bankNameLarge: {
    fontSize: 18,
    fontWeight: '700' as const,
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
    fontWeight: '600' as const,
    color: Colors.text,
  },
  qrCodeCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  qrCode: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  paymentInfo: {
    width: '100%',
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  noteCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
});
