import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { DollarSign, Calendar, CreditCard, Banknote, ChevronDown, X } from 'lucide-react-native';
import { paymentReportData } from '@/mocks/reports';
import ReportFilterBar, { filterByProjectAndDate } from '@/components/ReportFilterBar';

type FilterType = 'all' | 'booking' | 'deposit' | 'contract' | 'installment';

const filterOptions: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'booking', label: 'Booking' },
  { id: 'deposit', label: 'Đặt cọc' },
  { id: 'contract', label: 'Hợp đồng' },
  { id: 'installment', label: 'Đóng góp' },
];

const typeLabels: Record<string, { label: string; color: string; bg: string }> = {
  booking: { label: 'Booking', color: '#3B82F6', bg: '#EFF6FF' },
  deposit: { label: 'Đặt cọc', color: '#8B5CF6', bg: '#F5F3FF' },
  contract: { label: 'Hợp đồng', color: '#F59E0B', bg: '#FFFBEB' },
  installment: { label: 'Đóng góp', color: '#10B981', bg: '#ECFDF5' },
};

export default function PaymentReportScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    let data = filter === 'all'
      ? paymentReportData
      : paymentReportData.filter(item => item.type === filter);

    data = filterByProjectAndDate(data, selectedProject, fromDate, toDate, (item) => item.paymentDate);
    return data;
  }, [filter, selectedProject, fromDate, toDate]);

  const selectedLabel = filterOptions.find(f => f.id === filter)?.label || 'Tất cả';

  const handleReset = useCallback(() => {
    setSelectedProject('all');
    setFromDate('');
    setToDate('');
    setFilter('all');
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Báo cáo thu tiền',
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <DollarSign color="#10B981" size={20} />
            <View>
              <Text style={styles.summaryValue}>11.15 tỷ</Text>
              <Text style={styles.summaryLabel}>Tổng thu</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#3B82F6' }]}>
            <CreditCard color="#3B82F6" size={20} />
            <View>
              <Text style={styles.summaryValue}>{filtered.length}</Text>
              <Text style={styles.summaryLabel}>Phiếu thu</Text>
            </View>
          </View>
        </View>

        <ReportFilterBar
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onReset={handleReset}
        />

        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFilter(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterBtnLabel}>Loại: </Text>
          <Text style={styles.filterBtnValue}>{selectedLabel}</Text>
          <ChevronDown color={Colors.textSecondary} size={16} />
        </TouchableOpacity>

        <View style={styles.listContainer}>
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Không có dữ liệu phù hợp</Text>
            </View>
          )}
          {filtered.map((item) => {
            const typeInfo = typeLabels[item.type];
            return (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.receiptCode}>{item.receiptCode}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{item.customerName}</Text>
                <Text style={styles.projectText}>{item.projectName}</Text>
                <View style={styles.listItemFooter}>
                  <View style={styles.footerItem}>
                    <DollarSign color={Colors.primary} size={14} />
                    <Text style={styles.amountText}>{item.amount}</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Calendar color={Colors.textSecondary} size={14} />
                    <Text style={styles.dateText}>{item.paymentDate}</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Banknote color={Colors.textSecondary} size={14} />
                    <Text style={styles.methodText}>{item.paymentMethod}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lọc loại phiếu thu</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            {filterOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.modalItem, filter === opt.id && styles.modalItemActive]}
                onPress={() => { setFilter(opt.id); setShowFilter(false); }}
              >
                <Text style={[styles.modalItemText, filter === opt.id && styles.modalItemTextActive]}>{opt.label}</Text>
                {filter === opt.id && <View style={styles.modalCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.05)' },
    }),
  },
  summaryValue: { fontSize: 18, fontWeight: '800' as const, color: Colors.text },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  filterBtnValue: { fontSize: 13, color: Colors.text, fontWeight: '600' as const },
  listContainer: { gap: 10 },
  listItem: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
    }),
  },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  receiptCode: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' as const },
  customerName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  projectText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  listItemFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountText: { fontSize: 13, fontWeight: '700' as const, color: Colors.primary },
  dateText: { fontSize: 12, color: Colors.textSecondary },
  methodText: { fontSize: 12, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  modalItemActive: { backgroundColor: '#F8F8F8' },
  modalItemText: { fontSize: 15, color: Colors.text, fontWeight: '500' as const },
  modalItemTextActive: { color: Colors.primary, fontWeight: '600' as const },
  modalCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary },
});
