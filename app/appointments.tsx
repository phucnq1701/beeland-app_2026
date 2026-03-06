import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  List,
  Clock,
  MapPin,
  Phone,
  FileText,
  ChevronRight,
  Eye,
  MessageSquare,
  Users,
  FileSignature,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { appointments, Appointment } from '@/mocks/appointments';

type ViewMode = 'list' | 'calendar';

const typeConfig = {
  viewing: {
    label: 'Xem nhà',
    icon: Eye,
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  },
  consultation: {
    label: 'Tư vấn',
    icon: MessageSquare,
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  signing: {
    label: 'Ký HĐ',
    icon: FileSignature,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
  },
  meeting: {
    label: 'Họp',
    icon: Users,
    color: '#EC4899',
    bgColor: '#FDF2F8',
  },
};

const statusConfig = {
  pending: { label: 'Chờ xác nhận', color: '#F59E0B' },
  confirmed: { label: 'Đã xác nhận', color: '#10B981' },
  completed: { label: 'Hoàn thành', color: '#6B7280' },
  cancelled: { label: 'Đã hủy', color: '#EF4444' },
};

export default function AppointmentsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<string>('all');
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const getCardAnim = (id: string) => {
    if (!cardAnimations[id]) {
      cardAnimations[id] = new Animated.Value(1);
    }
    return cardAnimations[id];
  };

  const animatePress = (id: string, callback: () => void) => {
    const scale = getCardAnim(id);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 100);
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const week = getCurrentWeek();

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(apt => apt.type === filterType);
    }

    if (viewMode === 'calendar') {
      filtered = filtered.filter(apt => apt.date === selectedDate);
    }

    return filtered.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [filterType, selectedDate, viewMode]);

  const appointmentsByDate = useMemo(() => {
    const grouped: { [key: string]: Appointment[] } = {};
    filteredAppointments.forEach(apt => {
      if (!grouped[apt.date]) {
        grouped[apt.date] = [];
      }
      grouped[apt.date].push(apt);
    });
    return grouped;
  }, [filteredAppointments]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Ngày mai';
    }
    
    return date.toLocaleDateString('vi-VN', { 
      weekday: 'long',
      day: 'numeric',
      month: 'numeric'
    });
  };

  const renderAppointmentCard = (appointment: Appointment, index: number) => {
    const config = typeConfig[appointment.type];
    const status = statusConfig[appointment.status];
    const IconComponent = config.icon;
    const scale = getCardAnim(appointment.id);

    return (
      <Animated.View
        key={appointment.id}
        style={{
          transform: [
            { scale },
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              })
            }
          ],
          opacity: slideAnim,
        }}
      >
        <TouchableOpacity
          style={styles.appointmentCard}
          activeOpacity={1}
          onPress={() => animatePress(appointment.id, () => {
            console.log('[Appointments] Navigate to detail', appointment.id);
          })}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.typeIcon, { backgroundColor: config.bgColor }]}>
              <IconComponent color={config.color} size={20} />
            </View>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.appointmentTitle} numberOfLines={1}>
                {appointment.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              </View>
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.infoRow}>
                <Clock color={Colors.textSecondary} size={14} />
                <Text style={styles.infoText}>
                  {appointment.startTime} - {appointment.endTime}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <MapPin color={Colors.textSecondary} size={14} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {appointment.location}
                </Text>
              </View>

              {appointment.clientName && (
                <View style={styles.infoRow}>
                  <Phone color={Colors.textSecondary} size={14} />
                  <Text style={styles.infoText}>
                    {appointment.clientName}
                  </Text>
                </View>
              )}
            </View>

            {appointment.notes && (
              <View style={styles.notesContainer}>
                <FileText color={Colors.textLight} size={12} />
                <Text style={styles.notesText} numberOfLines={1}>
                  {appointment.notes}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardRight}>
            <ChevronRight color={Colors.textLight} size={20} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Lịch hẹn',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <List 
              color={viewMode === 'list' ? Colors.white : Colors.textSecondary} 
              size={18} 
            />
            <Text style={[
              styles.viewModeText,
              viewMode === 'list' && styles.viewModeTextActive
            ]}>
              Danh sách
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'calendar' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Calendar 
              color={viewMode === 'calendar' ? Colors.white : Colors.textSecondary} 
              size={18} 
            />
            <Text style={[
              styles.viewModeText,
              viewMode === 'calendar' && styles.viewModeTextActive
            ]}>
              Lịch
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[
                styles.filterChipText,
                filterType === 'all' && styles.filterChipTextActive
              ]}>
                Tất cả
              </Text>
            </TouchableOpacity>

            {Object.entries(typeConfig).map(([key, config]) => {
              const IconComponent = config.icon;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, filterType === key && styles.filterChipActive]}
                  onPress={() => setFilterType(key)}
                >
                  <IconComponent 
                    color={filterType === key ? Colors.white : config.color} 
                    size={16} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    filterType === key && styles.filterChipTextActive
                  ]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {viewMode === 'calendar' && (
        <View style={styles.weekContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekScroll}
          >
            {week.map((date, index) => {
              const dateStr = date.toISOString().split('T')[0];
              const isSelected = dateStr === selectedDate;
              const dayAppointments = appointments.filter(apt => apt.date === dateStr);
              const hasAppointments = dayAppointments.length > 0;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayCard, isSelected && styles.dayCardActive]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                    {date.toLocaleDateString('vi-VN', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dayNumberActive]}>
                    {date.getDate()}
                  </Text>
                  {hasAppointments && (
                    <View style={[
                      styles.dayIndicator,
                      isSelected && styles.dayIndicatorActive
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'list' ? (
          Object.keys(appointmentsByDate).length > 0 ? (
            Object.entries(appointmentsByDate).map(([date, apts]) => (
              <View key={date} style={styles.dateSection}>
                <View style={styles.dateSectionHeader}>
                  <Text style={styles.dateTitle}>{formatDate(date)}</Text>
                  <Text style={styles.dateCount}>{apts.length} lịch hẹn</Text>
                </View>
                {apts.map((apt, index) => renderAppointmentCard(apt, index))}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Calendar color={Colors.textLight} size={64} />
              <Text style={styles.emptyTitle}>Không có lịch hẹn</Text>
              <Text style={styles.emptyDescription}>
                Bạn chưa có lịch hẹn nào trong thời gian tới
              </Text>
            </View>
          )
        ) : (
          filteredAppointments.length > 0 ? (
            filteredAppointments.map((apt, index) => renderAppointmentCard(apt, index))
          ) : (
            <View style={styles.emptyState}>
              <Calendar color={Colors.textLight} size={64} />
              <Text style={styles.emptyTitle}>Không có lịch hẹn</Text>
              <Text style={styles.emptyDescription}>
                Không có lịch hẹn nào trong ngày này
              </Text>
            </View>
          )
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Thêm lịch hẹn</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewModeContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  viewModeTextActive: {
    color: Colors.white,
  },
  filterContainer: {
    paddingLeft: 24,
  },
  filterScroll: {
    paddingRight: 24,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  weekContainer: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weekScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  dayCardActive: {
    backgroundColor: Colors.primary,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dayLabelActive: {
    color: Colors.white,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  dayNumberActive: {
    color: Colors.white,
  },
  dayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  dayIndicatorActive: {
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  dateCount: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  cardLeft: {
    marginRight: 12,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardInfo: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    flex: 1,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic' as const,
    flex: 1,
  },
  cardRight: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
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
        boxShadow: '0 4px 12px rgba(232, 111, 37, 0.3)',
      },
    }),
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
