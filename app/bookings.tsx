import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Search, Filter, X, ChevronRight, Calendar, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/colors';
import { bookings, BookingStatus, BookingPriority } from '@/mocks/bookings';
import { featuredProperties } from '@/mocks/properties';

export default function BookingsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const statusLabels: Record<BookingStatus | 'all', string> = {
    all: 'Tất cả',
    waiting: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    expired: 'Hết hạn',
  };

  const statusColors: Record<BookingStatus, string> = {
    waiting: '#F59E0B',
    paid: '#10B981',
    expired: '#EF4444',
  };

  const statusBgColors: Record<BookingStatus, string> = {
    waiting: 'rgba(245, 158, 11, 0.2)',
    paid: 'rgba(16, 185, 129, 0.2)',
    expired: 'rgba(239, 68, 68, 0.2)',
  };

  const priorityLabels: Record<BookingPriority, string> = {
    1: 'Ưu tiên 1',
    2: 'Ưu tiên 2',
    3: 'Ưu tiên 3',
  };

  const priorityColors: Record<BookingPriority, string> = {
    1: '#FCA5A5',
    2: '#FDBA74',
    3: '#93C5FD',
  };

  const priorityBgColors: Record<BookingPriority, string> = {
    1: 'rgba(252, 165, 165, 0.2)',
    2: 'rgba(253, 186, 116, 0.2)',
    3: 'rgba(147, 197, 253, 0.2)',
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesSearch =
        searchQuery === '' ||
        booking.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.customerPhone.includes(searchQuery) ||
        booking.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProject =
        selectedProject === 'all' || booking.projectId === selectedProject;

      const matchesStatus =
        selectedStatus === 'all' || booking.status === selectedStatus;

      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [searchQuery, selectedProject, selectedStatus]);

  const stats = useMemo(() => {
    return {
      total: bookings.length,
      waiting: bookings.filter((b) => b.status === 'waiting').length,
      paid: bookings.filter((b) => b.status === 'paid').length,
      expired: bookings.filter((b) => b.status === 'expired').length,
    };
  }, []);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProject('all');
    setSelectedStatus('all');
    setShowFilters(false);
  };

  const hasActiveFilters = selectedProject !== 'all' || selectedStatus !== 'all';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerTransparent: true,
        }}
      />

      {/* Background */}
      <LinearGradient
        colors={Colors.gradients.background}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetingRow}>
            <Sparkles size={14} color={Colors.accent.purple} />
            <Text style={styles.greeting}>Quản lý</Text>
          </View>
          <Text style={styles.headerTitle}>Booking</Text>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchSection}>
          <BlurView intensity={30} tint="dark" style={styles.searchContainer}>
            <Search color={Colors.textTertiary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm booking, khách hàng..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X color={Colors.textTertiary} size={20} />
              </TouchableOpacity>
            )}
          </BlurView>

          <TouchableOpacity
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <BlurView intensity={hasActiveFilters ? 0 : 30} tint="dark" style={StyleSheet.absoluteFill} />
            {hasActiveFilters && (
              <LinearGradient
                colors={Colors.gradients.primary}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Filter color={hasActiveFilters ? Colors.white : Colors.text} size={20} />
          </TouchableOpacity>
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <BlurView intensity={40} tint="dark" style={styles.filtersPanel}>
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
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
              <Text style={styles.filterLabel}>Trạng thái</Text>
              <View style={styles.filterOptions}>
                {(['all', 'waiting', 'paid', 'expired'] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      selectedStatus === status && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedStatus(status)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatus === status && styles.filterChipTextActive,
                      ]}
                    >
                      {statusLabels[status]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Xóa bộ lọc</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        )}

        {/* Stats Row - Clickable Status Tabs */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.statCardWrapper, selectedStatus === 'all' && styles.statCardSelected]}
            onPress={() => setSelectedStatus('all')}
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={selectedStatus === 'all' ? ['rgba(139, 92, 246, 0.45)', 'rgba(139, 92, 246, 0.2)'] : ['rgba(139, 92, 246, 0.3)', 'rgba(139, 92, 246, 0.1)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Tất cả</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.statCardWrapper, selectedStatus === 'waiting' && styles.statCardSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'waiting' ? 'all' : 'waiting')}
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={selectedStatus === 'waiting' ? ['rgba(245, 158, 11, 0.45)', 'rgba(245, 158, 11, 0.2)'] : ['rgba(245, 158, 11, 0.3)', 'rgba(245, 158, 11, 0.1)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.statValue, { color: Colors.iconYellow }]}>{stats.waiting}</Text>
              <Text style={styles.statLabel}>Chờ TT</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.statCardWrapper, selectedStatus === 'paid' && styles.statCardSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'paid' ? 'all' : 'paid')}
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={selectedStatus === 'paid' ? ['rgba(16, 185, 129, 0.45)', 'rgba(16, 185, 129, 0.2)'] : ['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.1)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.statValue, { color: Colors.iconGreen }]}>{stats.paid}</Text>
              <Text style={styles.statLabel}>Đã TT</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.statCardWrapper, selectedStatus === 'expired' && styles.statCardSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'expired' ? 'all' : 'expired')}
          >
            <BlurView intensity={30} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={selectedStatus === 'expired' ? ['rgba(239, 68, 68, 0.45)', 'rgba(239, 68, 68, 0.2)'] : ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.statValue, { color: Colors.error }]}>{stats.expired}</Text>
              <Text style={styles.statLabel}>Hết hạn</Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Active filter indicator */}
        {selectedStatus !== 'all' && (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterText}>
              Đang lọc: {statusLabels[selectedStatus]} ({filteredBookings.length})
            </Text>
            <TouchableOpacity onPress={() => setSelectedStatus('all')}>
              <X color={Colors.textSecondary} size={16} />
            </TouchableOpacity>
          </View>
        )}

        {/* Booking List */}
        <View style={styles.listContainer}>
          {filteredBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <BlurView intensity={30} tint="dark" style={styles.emptyIconContainer}>
                <Calendar color={Colors.textSecondary} size={48} />
              </BlurView>
              <Text style={styles.emptyText}>Không tìm thấy booking nào</Text>
              <Text style={styles.emptySubtext}>
                Thử thay đổi bộ lọc hoặc tìm kiếm khác
              </Text>
            </View>
          ) : (
            filteredBookings.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={styles.bookingCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/booking/${booking.id}`)}
              >
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                  style={StyleSheet.absoluteFill}
                />
                
                <View style={styles.cardLeft}>
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColors[booking.status] },
                      ]}
                    />
                    <Text style={styles.bookingId}>#{booking.id}</Text>
                    <BlurView intensity={30} tint="dark" style={[styles.priorityBadge, { backgroundColor: priorityBgColors[booking.priority] }]}>
                      <Text
                        style={[
                          styles.priorityText,
                          { color: priorityColors[booking.priority] },
                        ]}
                      >
                        {priorityLabels[booking.priority]}
                      </Text>
                    </BlurView>
                  </View>
                  
                  <Text style={styles.customerName}>{booking.customerName}</Text>
                  <Text style={styles.productCode}>{booking.productCode}</Text>
                  
                  <View style={styles.dateRow}>
                    <Text style={styles.dateText}>
                      {new Date(booking.expiryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </Text>
                    <Text style={styles.dateSeparator}>•</Text>
                    <Text style={styles.projectName} numberOfLines={1}>{booking.projectName}</Text>
                  </View>
                </View>
                
                <View style={styles.cardRight}>
                  <Text style={styles.amount}>{booking.amount}</Text>
                  <BlurView intensity={30} tint="dark" style={[styles.statusBadge, { backgroundColor: statusBgColors[booking.status] }]}>
                    <Text
                      style={[styles.statusText, { color: statusColors[booking.status] }]}
                    >
                      {statusLabels[booking.status]}
                    </Text>
                  </BlurView>
                  <ChevronRight color={Colors.textTertiary} size={20} style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    top: -50,
    right: -50,
    filter: Platform.OS === 'web' ? 'blur(60px)' : undefined,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(232, 111, 37, 0.1)',
    bottom: 100,
    left: -50,
    filter: Platform.OS === 'web' ? 'blur(50px)' : undefined,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  searchSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterButtonActive: {
    borderColor: Colors.primary,
  },
  filtersPanel: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.glass.light,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  clearButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.glass.light,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCardWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  statCardSelected: {
    borderColor: Colors.primary,
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
    }),
  },
  statCard: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  listContainer: {
    gap: 10,
  },
  bookingCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent.cyan,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bookingId: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  productCode: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  dateSeparator: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  projectName: {
    fontSize: 12,
    color: Colors.textTertiary,
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
