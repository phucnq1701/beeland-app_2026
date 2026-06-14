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
import { FileText, CheckCircle, Clock, ChevronDown, X, Calendar } from 'lucide-react-native';
import { contractReportData } from '@/mocks/reports';
import ReportFilterBar, { filterByProjectAndDate } from '@/components/ReportFilterBar';

type FilterType = 'all' | 'active' | 'completed' | 'pending' | 'cancelled';

const filterOptions: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang hiệu lực' },
  { id: 'completed', label: 'Hoàn tất' },
  { id: 'pending', label: 'Chờ ký' },
  { id: 'cancelled', label: 'Đã hủy' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Đang hiệu lực', color: '#3B82F6', bg: '#EFF6FF' },
  completed: { label: 'Hoàn tất', color: '#10B981', bg: '#ECFDF5' },
  pending: { label: 'Chờ ký', color: '#F59E0B', bg: '#FFFBEB' },
  cancelled: { label: 'Đã hủy', color: '#EF4444', bg: '#FEF2F2' },
};

export default function ContractReportScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    let data = filter === 'all'
      ? contractReportData
      : contractReportData.filter(item => item.status === filter);

    data = filterByProjectAndDate(data, selectedProject, fromDate, toDate, (item) => item.signDate);
    return data;
  }, [filter, selectedProject, fromDate, toDate]);

  const activeCount = filtered.filter(c => c.status === 'active').length;
  const completedCount = filtered.filter(c => c.status === 'completed').length;
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
          title: 'Báo cáo hợp đồng',
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
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
              <FileText color="#3B82F6" size={18} />
            </View>
            <Text style={styles.statValue}>{filtered.length}</Text>
            <Text style={styles.statLabel}>Tổng HĐ</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
              <CheckCircle color="#10B981" size={18} />
            </View>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Hoàn tất</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#FFFBEB' }]}>
              <Clock color="#F59E0B" size={18} />
            </View>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Hiệu lực</Text>
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
            return (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.contractCode}>{item.contractCode}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{item.customerName}</Text>
                <Text style={styles.projectText}>{item.projectName} • {item.productCode}</Text>
                <View style={styles.contractFooter}>
                  <View style={styles.footerItem}>
                    <FileText color={Colors.primary} size={14} />
                    <Text style={styles.contractValue}>{item.contractValue}</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Calendar color={Colors.textSecondary} size={14} />
                    <Text style={styles.signDate}>{item.signDate}</Text>
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
  statsRow: {
    flexDirection: 'row', gap: 10, marginBottom: 16,
  },
  statItem: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.05)' },
    }),
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const },
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
  contractCode: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' as const },
  customerName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  projectText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  contractFooter: { flexDirection: 'row', gap: 16 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contractValue: { fontSize: 13, fontWeight: '700' as const, color: Colors.primary },
  signDate: { fontSize: 12, color: Colors.textSecondary },
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
