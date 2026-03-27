import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Search, Filter, X, Receipt, CreditCard, Calendar, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { receipts, ReceiptType } from '@/mocks/receipts';
import { featuredProperties } from '@/mocks/properties';

type TimeFilterType = 'all' | 'today' | '7days' | '30days' | 'custom';

export default function ReceiptsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

  const typeLabels: Record<ReceiptType | 'all', string> = {
    all: 'Tất cả',
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

  const getTimeFilterDates = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFilter) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return { start: sevenDaysAgo, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return { start: thirtyDaysAgo, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { start: customStartDate, end: new Date(customEndDate.getTime() + 24 * 60 * 60 * 1000) };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const matchesSearch =
        searchQuery === '' ||
        receipt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receipt.customerPhone.includes(searchQuery) ||
        receipt.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProject =
        selectedProject === 'all' || receipt.projectId === selectedProject;

      const dates = getTimeFilterDates();
      let matchesTime = true;
      if (dates) {
        const receiptDate = new Date(receipt.receiptDate);
        matchesTime = receiptDate >= dates.start && receiptDate < dates.end;
      }

      return matchesSearch && matchesProject && matchesTime;
    });
  }, [searchQuery, selectedProject, timeFilter, customStartDate, customEndDate]);

  const stats = useMemo(() => {
    const totalAmount = receipts
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + r.amountValue, 0);
    
    return {
      total: receipts.length,
      completed: receipts.filter((r) => r.status === 'completed').length,
      pending: receipts.filter((r) => r.status === 'pending').length,
      totalAmount: new Intl.NumberFormat('vi-VN').format(totalAmount),
    };
  }, []);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProject('all');
    setTimeFilter('all');
    setCustomStartDate(null);
    setCustomEndDate(null);
    setShowFilters(false);
  };

  const hasActiveFilters = selectedProject !== 'all' || timeFilter !== 'all';

  const timeFilterLabels: Record<TimeFilterType, string> = {
    all: 'Tất cả',
    today: 'Hôm nay',
    '7days': '7 ngày qua',
    '30days': '30 ngày qua',
    custom: 'Tùy chỉnh',
  };

  const handleCustomDatePress = () => {
    if (!customStartDate) {
      const now = new Date();
      setCustomStartDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      setCustomEndDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    }
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: Date) => {
    if (datePickerMode === 'start') {
      setCustomStartDate(date);
      if (customEndDate && date > customEndDate) {
        setCustomEndDate(date);
      }
    } else {
      if (customStartDate && date < customStartDate) {
        setCustomEndDate(customStartDate);
        setCustomStartDate(date);
      } else {
        setCustomEndDate(date);
      }
    }
    setShowDatePicker(false);
  };

  const formatDateRange = () => {
    if (!customStartDate || !customEndDate) return '';
    return `${customStartDate.toLocaleDateString('vi-VN')} - ${customEndDate.toLocaleDateString('vi-VN')}`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Quản lý phiếu thu',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm phiếu thu, khách hàng..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter color={hasActiveFilters ? Colors.white : Colors.text} size={20} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Dự án</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterOptions}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedProject === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setSelectedProject('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedProject === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              {featuredProperties.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.filterChip,
                    selectedProject === project.id && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedProject(project.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedProject === project.id && styles.filterChipTextActive,
                    ]}
                  >
                    {project.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Thời gian</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterOptions}
            >
              {(['all', 'today', '7days', '30days', 'custom'] as TimeFilterType[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChip,
                    timeFilter === filter && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setTimeFilter(filter);
                    if (filter === 'custom') {
                      handleCustomDatePress();
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      timeFilter === filter && styles.filterChipTextActive,
                    ]}
                  >
                    {timeFilterLabels[filter]}
                  </Text>
                  {filter === 'custom' && timeFilter === 'custom' && (
                    <ChevronRight
                      color={Colors.white}
                      size={14}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {timeFilter === 'custom' && customStartDate && customEndDate && (
              <TouchableOpacity
                style={styles.dateRangeDisplay}
                onPress={handleCustomDatePress}
              >
                <Calendar color={Colors.primary} size={16} />
                <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Xóa bộ lọc</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Chọn khoảng thời gian</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <X color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerBody}>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  datePickerMode === 'start' && styles.dateButtonActive,
                ]}
                onPress={() => setDatePickerMode('start')}
              >
                <Text style={styles.dateButtonLabel}>Từ ngày</Text>
                <Text
                  style={[
                    styles.dateButtonValue,
                    datePickerMode === 'start' && styles.dateButtonValueActive,
                  ]}
                >
                  {customStartDate?.toLocaleDateString('vi-VN') || 'Chọn ngày'}
                </Text>
              </TouchableOpacity>

              <View style={styles.dateSeparator}>
                <View style={styles.dateSeparatorLine} />
              </View>

              <TouchableOpacity
                style={[
                  styles.dateButton,
                  datePickerMode === 'end' && styles.dateButtonActive,
                ]}
                onPress={() => setDatePickerMode('end')}
              >
                <Text style={styles.dateButtonLabel}>Đến ngày</Text>
                <Text
                  style={[
                    styles.dateButtonValue,
                    datePickerMode === 'end' && styles.dateButtonValueActive,
                  ]}
                >
                  {customEndDate?.toLocaleDateString('vi-VN') || 'Chọn ngày'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickDateOptions}>
              <Text style={styles.quickDateLabel}>Chọn nhanh</Text>
              <View style={styles.quickDateButtons}>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const sevenDaysAgo = new Date(today);
                    sevenDaysAgo.setDate(today.getDate() - 7);
                    setCustomStartDate(sevenDaysAgo);
                    setCustomEndDate(today);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>7 ngày qua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(today.getDate() - 30);
                    setCustomStartDate(thirtyDaysAgo);
                    setCustomEndDate(today);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>30 ngày qua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    setCustomStartDate(firstDayOfMonth);
                    setCustomEndDate(today);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>Tháng này</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.calendarPlaceholder}>
              <Calendar color={Colors.textSecondary} size={48} />
              <Text style={styles.calendarPlaceholderText}>
                Sử dụng nút "Chọn nhanh" hoặc nhập ngày thủ công
              </Text>
            </View>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.applyButtonText}>Áp dụng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Tổng số</Text>
        </View>
        <View style={[styles.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={[styles.statValue, { color: statusColors.completed }]}>
            {stats.completed}
          </Text>
          <Text style={styles.statLabel}>Hoàn thành</Text>
        </View>
        <View style={[styles.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={[styles.statValue, { color: statusColors.pending }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Chờ xử lý</Text>
        </View>
      </View>

      <View style={styles.totalAmountCard}>
        <View style={styles.totalAmountIcon}>
          <CreditCard color={Colors.primary} size={24} />
        </View>
        <View style={styles.totalAmountInfo}>
          <Text style={styles.totalAmountLabel}>Tổng thu đã hoàn thành</Text>
          <Text style={styles.totalAmountValue}>{stats.totalAmount} VNĐ</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredReceipts.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt color={Colors.textSecondary} size={48} />
            <Text style={styles.emptyText}>Không tìm thấy phiếu thu nào</Text>
            <Text style={styles.emptySubtext}>
              Thử thay đổi bộ lọc hoặc tìm kiếm khác
            </Text>
          </View>
        ) : (
          filteredReceipts.map((receipt) => (
            <TouchableOpacity
              key={receipt.id}
              style={styles.receiptCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/receipt/${receipt.id}`)}
            >
              <View style={styles.receiptHeader}>
                <View style={styles.receiptHeaderLeft}>
                  <View style={styles.receiptIconContainer}>
                    <Receipt color={Colors.primary} size={20} />
                  </View>
                  <View>
                    <Text style={styles.receiptId}>#{receipt.id}</Text>
                  </View>
                </View>
                <View style={styles.receiptHeaderRight}>
                  <Text style={styles.receiptAmount}>{receipt.amount}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColors[receipt.status] },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.receiptInfo}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Text style={styles.unitIcon}>🏢</Text>
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Tên dự án</Text>
                    <Text style={styles.infoValue}>{receipt.projectName}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Text style={styles.customerIcon}>👤</Text>
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Khách hàng</Text>
                    <Text style={styles.infoValue}>{receipt.customerName}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Calendar color={Colors.textSecondary} size={16} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Ngày thu</Text>
                    <Text style={styles.infoValue}>
                      {new Date(receipt.receiptDate).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
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
  header: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filtersPanel: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  clearButton: {
    marginHorizontal: 24,
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  statBox: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  totalAmountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  totalAmountIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFF4ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalAmountInfo: {
    flex: 1,
    gap: 4,
  },
  totalAmountLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  totalAmountValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 16,
  },
  receiptCard: {
    backgroundColor: Colors.white,
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
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  receiptIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF4ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptId: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  receiptHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  receiptInfo: {
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitIcon: {
    fontSize: 16,
  },
  customerIcon: {
    fontSize: 16,
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginHorizontal: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerContainer: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  datePickerBody: {
    padding: 24,
    gap: 16,
  },
  dateButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF4ED',
  },
  dateButtonLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  dateButtonValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  dateButtonValueActive: {
    color: Colors.primary,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSeparatorLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
  },
  quickDateOptions: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  quickDateLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  quickDateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickDateButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  quickDateButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  calendarPlaceholder: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  calendarPlaceholderText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  applyButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
