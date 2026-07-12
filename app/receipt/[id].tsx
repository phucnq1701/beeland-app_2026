import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  Phone,
  CreditCard,
  FileText,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { receipts, ReceiptType } from '@/mocks/receipts';

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receipt = receipts.find((r) => r.id === id);

  if (!receipt) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chi tiết phiếu thu' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không tìm thấy phiếu thu</Text>
        </View>
      </View>
    );
  }

  const typeLabels: Record<ReceiptType, string> = {
    booking: 'Phí booking',
    deposit: 'Đặt cọc',
    installment: 'Trả góp',
    final: 'Thanh toán cuối',
    other: 'Khác',
  };

  const typeColors: Record<ReceiptType, string> = {
    booking: '#F59E0B',
    deposit: '#3B82F6',
    installment: '#10B981',
    final: '#8B5CF6',
    other: '#6B7280',
  };

  const typeBgColors: Record<ReceiptType, string> = {
    booking: '#FEF3C7',
    deposit: '#DBEAFE',
    installment: '#D1FAE5',
    final: '#EDE9FE',
    other: '#F3F4F6',
  };

  const statusLabels = {
    completed: 'Hoàn thành',
    pending: 'Chờ xử lý',
    cancelled: 'Đã hủy',
  };

  const statusColors = {
    completed: '#10B981',
    pending: '#F59E0B',
    cancelled: '#EF4444',
  };

  const statusBgColors = {
    completed: '#D1FAE5',
    pending: '#FEF3C7',
    cancelled: '#FEE2E2',
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Phiếu thu #${receipt.id}`,
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
            <View style={styles.headerRow}>
              <Text style={styles.receiptId}>#{receipt.id}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusBgColors[receipt.status] },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColors[receipt.status] }]}>
                  {statusLabels[receipt.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.amount}>{receipt.amount} VNĐ</Text>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: typeBgColors[receipt.receiptType] },
              ]}
            >
              <Text style={[styles.typeText, { color: typeColors[receipt.receiptType] }]}>
                {typeLabels[receipt.receiptType]}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Thông tin phiếu thu</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Text style={styles.emoji}>👤</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Khách hàng</Text>
                <Text style={styles.infoValue}>{receipt.customerName}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Phone color={Colors.textSecondary} size={20} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Số điện thoại</Text>
                <Text style={styles.infoValue}>{receipt.customerPhone}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Calendar color={Colors.textSecondary} size={20} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ngày thu</Text>
                <Text style={styles.infoValue}>
                  {new Date(receipt.receiptDate).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <CreditCard color={Colors.textSecondary} size={20} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phương thức thanh toán</Text>
                <Text style={styles.infoValue}>{receipt.paymentMethod}</Text>
              </View>
            </View>
          </View>

          {receipt.notes && (
            <>
              <View style={styles.divider} />
              <View style={styles.notesSection}>
                <View style={styles.notesTitleRow}>
                  <FileText color={Colors.text} size={20} />
                  <Text style={styles.sectionTitle}>Ghi chú</Text>
                </View>
                <Text style={styles.notesText}>{receipt.notes}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tóm tắt thanh toán</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dự án</Text>
            <Text style={styles.summaryValue}>{receipt.projectName}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mã căn</Text>
            <Text style={styles.summaryValue}>{receipt.unitCode}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Loại thu</Text>
            <Text style={styles.summaryValue}>{typeLabels[receipt.receiptType]}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Số tiền</Text>
            <Text style={styles.summaryValue}>{receipt.amount} VNĐ</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phương thức</Text>
            <Text style={styles.summaryValue}>{receipt.paymentMethod}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng tiền thu</Text>
            <Text style={styles.totalValue}>{receipt.amount} VNĐ</Text>
          </View>
        </View>

        {receipt.status === 'completed' && (
          <View style={styles.completedCard}>
            <CheckCircle color={Colors.success} size={32} />
            <View style={styles.completedInfo}>
              <Text style={styles.completedTitle}>Đã hoàn thành</Text>
              <Text style={styles.completedText}>
                Phiếu thu đã được xác nhận và hoàn thành vào ngày{' '}
                {new Date(receipt.receiptDate).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          </View>
        )}

        {receipt.status === 'pending' && (
          <View style={styles.pendingCard}>
            <Clock color="#F59E0B" size={32} />
            <View style={styles.pendingInfo}>
              <Text style={styles.pendingTitle}>Đang chờ xử lý</Text>
              <Text style={styles.pendingText}>
                Phiếu thu đang được xử lý và sẽ được cập nhật sớm nhất có thể
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 16,
    padding: 20,
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
  headerSection: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptId: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  typeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  infoSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  notesSection: {
    gap: 12,
  },
  notesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#D1FAE5',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
  },
  completedInfo: {
    flex: 1,
    gap: 4,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#065F46',
  },
  completedText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FEF3C7',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
  },
  pendingInfo: {
    flex: 1,
    gap: 4,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  pendingText: {
    fontSize: 14,
    color: '#B45309',
    lineHeight: 20,
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
});
