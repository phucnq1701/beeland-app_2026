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
import { AlertTriangle, Clock, CheckCircle, ChevronDown, X } from 'lucide-react-native';
import { debtReportData } from '@/mocks/reports';
import ReportFilterBar, { filterByProjectAndDate } from '@/components/ReportFilterBar';

type FilterType = 'all' | 'overdue' | 'upcoming' | 'on_time';

const filterOptions: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'overdue', label: 'Quá hạn' },
  { id: 'upcoming', label: 'Sắp đến hạn' },
  { id: 'on_time', label: 'Đúng hạn' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  overdue: { label: 'Quá hạn', color: '#EF4444', bg: '#FEF2F2', icon: AlertTriangle },
  upcoming: { label: 'Sắp đến hạn', color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
  on_time: { label: 'Đúng hạn', color: '#10B981', bg: '#ECFDF5', icon: CheckCircle },
};

export default function DebtReportScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    let data = filter === 'all'
      ? debtReportData
      : debtReportData.filter(item => item.status === filter);

    data = filterByProjectAndDate(data, selectedProject, fromDate, toDate, (item) => item.dueDate);
    return data;
  }, [filter, selectedProject, fromDate, toDate]);

  const overdueCount = filtered.filter(d => d.status === 'overdue').length;
  const totalDebt = '18.1 tỷ';
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
          title: 'Báo cáo công nợ',
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
          <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
            <AlertTriangle color="#EF4444" size={20} />
            <View>
              <Text style={styles.summaryValue}>{totalDebt}</Text>
              <Text style={styles.summaryLabel}>Tổng công nợ</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <Clock color="#F59E0B" size={20} />
            <View>
              <Text style={styles.summaryValue}>{overdueCount}</Text>
              <Text style={styles.summaryLabel}>Quá hạn</Text>
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
          <Text style={styles.filterBtnLabel}>Trạng thái: </Text>
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
            const status = statusConfig[item.status];
            const StatusIcon = status.icon;
            return (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.productCode}>{item.productCode}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <StatusIcon color={status.color} size={12} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{item.customerName}</Text>
                <Text style={styles.projectText}>{item.projectName}</Text>

                <View style={styles.debtDetails}>
                  <View style={styles.debtRow}>
                    <Text style={styles.debtLabel}>Giá trị HĐ</Text>
                    <Text style={styles.debtValue}>{item.contractValue}</Text>
                  </View>
                  <View style={styles.debtRow}>
                    <Text style={styles.debtLabel}>Đã thanh toán</Text>
                    <Text style={[styles.debtValue, { color: '#10B981' }]}>{item.paidAmount}</Text>
                  </View>
                  <View style={styles.debtRow}>
                    <Text style={styles.debtLabel}>Còn nợ</Text>
                    <Text style={[styles.debtValue, { color: '#EF4444', fontWeight: '800' as const }]}>{item.debtAmount}</Text>
                  </View>
                  <View style={[styles.debtRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 }]}>
                    <Text style={styles.debtLabel}>Hạn thanh toán</Text>
                    <Text style={[styles.debtValue, { color: item.status === 'overdue' ? '#EF4444' : Colors.text }]}>{item.dueDate}</Text>
                  </View>
                </View>

                {item.status === 'overdue' && (
                  <View style={styles.overdueBar}>
                    <AlertTriangle color="#EF4444" size={14} />
                    <Text style={styles.overdueText}>Đã quá hạn thanh toán</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lọc trạng thái</Text>
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
    backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderLeftWidth: 4,
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
    marginBottom: 16, gap: 4, borderWidth: 1, borderColor: Colors.border,
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
  productCode: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' as const },
  customerName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  projectText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  debtDetails: { gap: 6, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12 },
  debtRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  debtLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' as const },
  debtValue: { fontSize: 14, fontWeight: '700' as const, color: Colors.text },
  overdueBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10,
  },
  overdueText: { fontSize: 12, color: '#EF4444', fontWeight: '600' as const },
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
