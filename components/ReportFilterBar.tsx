import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import Colors from '@/constants/colors';
import { ChevronDown, X, Calendar, Building2, RotateCcw } from 'lucide-react-native';
import { featuredProperties } from '@/mocks/properties';

interface ProjectOption {
  id: string;
  name: string;
}

interface ReportFilterBarProps {
  selectedProject: string;
  onProjectChange: (projectId: string) => void;
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onReset?: () => void;
}

const projects: ProjectOption[] = [
  { id: 'all', name: 'Tất cả dự án' },
  ...featuredProperties.map(p => ({ id: p.id, name: p.title })),
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: `Tháng ${i + 1}`,
}));

const YEARS = Array.from({ length: 5 }, (_, i) => ({
  value: String(2024 + i),
  label: String(2024 + i),
}));

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

type DatePickerTarget = 'from' | 'to';

export default function ReportFilterBar({
  selectedProject,
  onProjectChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onReset,
}: ReportFilterBarProps) {
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateTarget, setDateTarget] = useState<DatePickerTarget>('from');

  const [tempDay, setTempDay] = useState('');
  const [tempMonth, setTempMonth] = useState('');
  const [tempYear, setTempYear] = useState('');

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || 'Tất cả dự án';

  const hasActiveFilter = selectedProject !== 'all' || fromDate !== '' || toDate !== '';

  const openDatePicker = useCallback((target: DatePickerTarget) => {
    setDateTarget(target);
    const currentDate = target === 'from' ? fromDate : toDate;
    if (currentDate) {
      const parts = currentDate.split('/');
      if (parts.length === 3) {
        setTempDay(parts[0]);
        setTempMonth(parts[1]);
        setTempYear(parts[2]);
      } else {
        setTempDay('01');
        setTempMonth('01');
        setTempYear('2026');
      }
    } else {
      setTempDay('01');
      setTempMonth('01');
      setTempYear('2026');
    }
    setShowDateModal(true);
  }, [fromDate, toDate]);

  const confirmDate = useCallback(() => {
    const month = parseInt(tempMonth, 10);
    const year = parseInt(tempYear, 10);
    const maxDay = getDaysInMonth(month, year);
    let day = parseInt(tempDay, 10);
    if (day > maxDay) day = maxDay;
    if (day < 1) day = 1;

    const dateStr = `${String(day).padStart(2, '0')}/${tempMonth}/${tempYear}`;
    if (dateTarget === 'from') {
      onFromDateChange(dateStr);
    } else {
      onToDateChange(dateStr);
    }
    setShowDateModal(false);
  }, [tempDay, tempMonth, tempYear, dateTarget, onFromDateChange, onToDateChange]);

  const clearDate = useCallback(() => {
    if (dateTarget === 'from') {
      onFromDateChange('');
    } else {
      onToDateChange('');
    }
    setShowDateModal(false);
  }, [dateTarget, onFromDateChange, onToDateChange]);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => setShowProjectModal(true)}
          activeOpacity={0.7}
          testID="report-filter-project"
        >
          <Building2 color={selectedProject !== 'all' ? Colors.primary : Colors.textSecondary} size={14} />
          <Text
            style={[styles.filterChipText, selectedProject !== 'all' && styles.filterChipTextActive]}
            numberOfLines={1}
          >
            {selectedProjectName}
          </Text>
          <ChevronDown color={Colors.textSecondary} size={14} />
        </TouchableOpacity>

        {hasActiveFilter && onReset && (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={onReset}
            activeOpacity={0.7}
            testID="report-filter-reset"
          >
            <RotateCcw color={Colors.primary} size={14} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateChip}
          onPress={() => openDatePicker('from')}
          activeOpacity={0.7}
          testID="report-filter-from-date"
        >
          <Calendar color={fromDate ? Colors.primary : Colors.textSecondary} size={14} />
          <Text style={[styles.dateChipText, fromDate ? styles.dateChipTextActive : null]}>
            {fromDate || 'Từ ngày'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>→</Text>
        </View>

        <TouchableOpacity
          style={styles.dateChip}
          onPress={() => openDatePicker('to')}
          activeOpacity={0.7}
          testID="report-filter-to-date"
        >
          <Calendar color={toDate ? Colors.primary : Colors.textSecondary} size={14} />
          <Text style={[styles.dateChipText, toDate ? styles.dateChipTextActive : null]}>
            {toDate || 'Đến ngày'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showProjectModal} transparent animationType="slide" onRequestClose={() => setShowProjectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn dự án</Text>
              <TouchableOpacity onPress={() => setShowProjectModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[styles.modalItem, selectedProject === project.id && styles.modalItemActive]}
                  onPress={() => { onProjectChange(project.id); setShowProjectModal(false); }}
                >
                  <Text style={[styles.modalItemText, selectedProject === project.id && styles.modalItemTextActive]}>
                    {project.name}
                  </Text>
                  {selectedProject === project.id && <View style={styles.modalCheck} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showDateModal} transparent animationType="slide" onRequestClose={() => setShowDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dateModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {dateTarget === 'from' ? 'Chọn từ ngày' : 'Chọn đến ngày'}
              </Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerRow}>
              <View style={styles.datePickerCol}>
                <Text style={styles.datePickerLabel}>Ngày</Text>
                <TextInput
                  style={styles.datePickerInput}
                  value={tempDay}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    if (num.length <= 2) setTempDay(num);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="01"
                  placeholderTextColor={Colors.textTertiary}
                  testID="date-picker-day"
                />
              </View>

              <View style={styles.datePickerColLarge}>
                <Text style={styles.datePickerLabel}>Tháng</Text>
                <ScrollView style={styles.monthScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {MONTHS.map((m) => (
                    <TouchableOpacity
                      key={m.value}
                      style={[styles.monthItem, tempMonth === m.value && styles.monthItemActive]}
                      onPress={() => setTempMonth(m.value)}
                    >
                      <Text style={[styles.monthItemText, tempMonth === m.value && styles.monthItemTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.datePickerCol}>
                <Text style={styles.datePickerLabel}>Năm</Text>
                <ScrollView style={styles.yearScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {YEARS.map((y) => (
                    <TouchableOpacity
                      key={y.value}
                      style={[styles.yearItem, tempYear === y.value && styles.yearItemActive]}
                      onPress={() => setTempYear(y.value)}
                    >
                      <Text style={[styles.yearItemText, tempYear === y.value && styles.yearItemTextActive]}>
                        {y.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.dateActions}>
              <TouchableOpacity style={styles.dateClearBtn} onPress={clearDate}>
                <Text style={styles.dateClearBtnText}>Xóa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateConfirmBtn} onPress={confirmDate}>
                <Text style={styles.dateConfirmBtnText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

export function filterByProjectAndDate<T extends { projectName?: string }>(
  data: T[],
  selectedProject: string,
  fromDate: string,
  toDate: string,
  getDateStr: (item: T) => string,
): T[] {
  let result = data;

  if (selectedProject !== 'all') {
    const projectName = projects.find(p => p.id === selectedProject)?.name;
    if (projectName) {
      result = result.filter(item => item.projectName === projectName);
    }
  }

  const from = parseDate(fromDate);
  const to = parseDate(toDate);

  if (from || to) {
    result = result.filter(item => {
      const itemDate = parseDate(getDateStr(item));
      if (!itemDate) return true;
      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
      return true;
    });
  }

  return result;
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
    }),
  },
  filterChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  resetBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 111, 37, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
    }),
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
  dateChipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  dateSeparator: {
    paddingHorizontal: 2,
  },
  dateSeparatorText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  dateModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalList: {
    padding: 8,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalItemActive: {
    backgroundColor: '#F8F8F8',
  },
  modalItemText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  modalItemTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  modalCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  datePickerRow: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  datePickerCol: {
    flex: 1,
    gap: 8,
  },
  datePickerColLarge: {
    flex: 1.5,
    gap: 8,
  },
  datePickerLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  datePickerInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthScroll: {
    maxHeight: 180,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  monthItemActive: {
    backgroundColor: Colors.primary,
  },
  monthItemText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  monthItemTextActive: {
    color: Colors.white,
    fontWeight: '700' as const,
  },
  yearScroll: {
    maxHeight: 180,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  yearItemActive: {
    backgroundColor: Colors.primary,
  },
  yearItemText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  yearItemTextActive: {
    color: Colors.white,
    fontWeight: '700' as const,
  },
  dateActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dateClearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  dateClearBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dateConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  dateConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
