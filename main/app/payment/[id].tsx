import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, RefreshCw, Upload, X } from 'lucide-react-native';
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

type PaymentStatus = 'checking' | 'success' | 'processing' | null;

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = bookings.find((b) => b.id === id);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const selectedBank: Bank = {
    id: 'vcb',
    name: 'Vietcombank',
    logo: '🏦',
    accountNumber: '1234567890',
    accountName: 'CONG TY BDS ABC',
  };

  if (!booking) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không tìm thấy booking</Text>
        </View>
      </View>
    );
  }

  const generateQRCode = (bank: Bank) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=Bank:${bank.name}%0AAccount:${bank.accountNumber}%0AAmount:${booking.amountValue}%0AContent:Thanh toan booking ${booking.id}`;
  };

  const handleCheckPayment = () => {
    setIsChecking(true);
    
    setTimeout(() => {
      setIsChecking(false);
      
      if (booking.id === 'BK001') {
        setPaymentStatus('success');
        setTimeout(() => {
          Alert.alert(
            'Thanh toán thành công',
            'Booking của bạn đã được thanh toán thành công!',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          );
        }, 500);
      } else if (booking.id === 'BK004') {
        setPaymentStatus('processing');
        setTimeout(() => {
          Alert.alert(
            'Hệ thống đang xử lý',
            'Bạn có muốn upload ảnh đã thanh toán không?',
            [
              {
                text: 'Không',
                style: 'cancel',
              },
              {
                text: 'Upload ảnh',
                onPress: () => setShowUploadModal(true),
              },
            ]
          );
        }, 500);
      } else {
        Alert.alert(
          'Chưa nhận được thanh toán',
          'Vui lòng kiểm tra lại sau vài phút'
        );
      }
    }, 2000);
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
        setShowUploadModal(false);
        Alert.alert(
          'Thành công',
          'Chứng từ đã được tải lên. Chúng tôi sẽ xác nhận trong 24h.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Thanh toán QR',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {paymentStatus === 'success' ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconContainer}>
              <CheckCircle color={Colors.success} size={80} strokeWidth={2} />
            </View>
            <Text style={styles.successTitle}>Thanh toán thành công!</Text>
            <Text style={styles.successMessage}>
              Booking #{booking.id} đã được thanh toán thành công
            </Text>
            <View style={styles.successAmountCard}>
              <Text style={styles.successAmountLabel}>Số tiền đã thanh toán</Text>
              <Text style={styles.successAmountValue}>{booking.amount} VNĐ</Text>
            </View>
          </View>
        ) : paymentStatus === 'processing' ? (
          <View style={styles.processingContainer}>
            <View style={styles.processingIconContainer}>
              <RefreshCw color={Colors.primary} size={60} strokeWidth={2} />
            </View>
            <Text style={styles.processingTitle}>Hệ thống đang xử lý</Text>
            <Text style={styles.processingMessage}>
              Giao dịch của bạn đang được xử lý. Vui lòng chờ trong giây lát.
            </Text>
            <View style={styles.processingCard}>
              <Text style={styles.processingCardTitle}>
                Bạn có muốn upload ảnh đã thanh toán không?
              </Text>
              <Text style={styles.processingCardText}>
                Upload chứng từ thanh toán giúp chúng tôi xử lý nhanh hơn
              </Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => setShowUploadModal(true)}
                activeOpacity={0.7}
              >
                <Upload color={Colors.white} size={20} />
                <Text style={styles.uploadButtonText}>Upload ảnh thanh toán</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.bankInfoCard}>
              <View style={styles.bankHeader}>
                <Text style={styles.bankLogoLarge}>{selectedBank.logo}</Text>
                <View style={styles.bankHeaderContent}>
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
              <View style={styles.qrCodeContainer}>
                <Image
                  source={{ uri: generateQRCode(selectedBank) }}
                  style={styles.qrCode}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Booking:</Text>
                  <Text style={styles.paymentValue}>#{booking.id}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Số tiền:</Text>
                  <Text style={styles.paymentValueHighlight}>{booking.amount} VNĐ</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Nội dung:</Text>
                  <Text style={styles.paymentValue}>
                    Thanh toan booking {booking.id}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.checkButton,
                isChecking && styles.checkButtonDisabled,
              ]}
              onPress={handleCheckPayment}
              disabled={isChecking}
              activeOpacity={0.7}
            >
              {isChecking ? (
                <>
                  <ActivityIndicator size="small" color={Colors.white} />
                  <Text style={styles.checkButtonText}>Đang kiểm tra...</Text>
                </>
              ) : (
                <>
                  <RefreshCw color={Colors.white} size={20} />
                  <Text style={styles.checkButtonText}>Kiểm tra thanh toán</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Lưu ý quan trọng:</Text>
              <Text style={styles.noteText}>
                • Vui lòng chuyển đúng số tiền và nội dung chuyển khoản
              </Text>
              <Text style={styles.noteText}>
                • Sau khi chuyển khoản, nhấn "Kiểm tra thanh toán"
              </Text>
              <Text style={styles.noteText}>
                • Thời gian xác nhận: 15-30 phút
              </Text>
              <Text style={styles.noteText}>
                • Nếu không nhận được xác nhận, vui lòng liên hệ hỗ trợ
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showUploadModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload chứng từ thanh toán</Text>
            <TouchableOpacity
              onPress={() => setShowUploadModal(false)}
              style={styles.closeButton}
            >
              <X color={Colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.uploadIconContainer}>
              <Upload color={Colors.primary} size={48} />
            </View>
            <Text style={styles.uploadTitle}>Tải lên ảnh chứng từ</Text>
            <Text style={styles.uploadDescription}>
              Upload ảnh chứng từ thanh toán để chúng tôi xử lý nhanh hơn
            </Text>

            <TouchableOpacity
              style={styles.selectImageButton}
              onPress={handlePickImage}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color={Colors.white} />
                  <Text style={styles.selectImageButtonText}>Đang tải lên...</Text>
                </>
              ) : (
                <>
                  <Upload color={Colors.white} size={20} />
                  <Text style={styles.selectImageButtonText}>Chọn ảnh</Text>
                </>
              )}
            </TouchableOpacity>

            {uploadedImage && (
              <View style={styles.uploadedPreview}>
                <Image
                  source={{ uri: uploadedImage }}
                  style={styles.uploadedPreviewImage}
                />
              </View>
            )}
          </View>
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
  contentContainer: {
    padding: 24,
    gap: 20,
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
  bankInfoCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bankHeaderContent: {
    flex: 1,
  },
  bankLogoLarge: {
    fontSize: 56,
  },
  bankNameLarge: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  bankAccountLarge: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  bankDetails: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  bankDetailLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  bankDetailValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  qrCodeCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  qrCodeContainer: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  qrCode: {
    width: 280,
    height: 280,
  },
  paymentInfo: {
    width: '100%',
    gap: 12,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  paymentValueHighlight: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  checkButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 8px rgba(124, 58, 237, 0.3)',
      },
    }),
  },
  checkButtonDisabled: {
    opacity: 0.7,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
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
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  successIconContainer: {
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.success,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  successAmountCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  successAmountLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  successAmountValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  processingIconContainer: {
    marginBottom: 32,
    backgroundColor: Colors.background,
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  processingMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  processingCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  processingCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  processingCardText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
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
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  uploadDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  selectImageButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
  },
  selectImageButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  uploadedPreview: {
    marginTop: 24,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadedPreviewImage: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.background,
  },
});
