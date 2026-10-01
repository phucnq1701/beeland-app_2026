import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Search, MapPin, Calendar, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react-native';
import { colors } from "@/theme";
import { handovers, Handover, HandoverStatus } from '@/mocks/handovers';

const statusConfig: Record<HandoverStatus, { label: string; color: string; bg: string; icon: any }> = {
  pending: {
    label: 'Chờ xử lý',
    color: '#F59E0B',
    bg: '#FFFBEB',
    icon: Clock,
  },
  scheduled: {
    label: 'Đã lên lịch',
    color: '#3B82F6',
    bg: '#EFF6FF',
    icon: Calendar,
  },
  completed: {
    label: 'Hoàn thành',
    color: '#10B981',
    bg: '#ECFDF5',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Từ chối',
    color: '#EF4444',
    bg: '#FEF2F2',
    icon: XCircle,
  },
};

export default function HandoversScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<HandoverStatus | 'all'>('all');

  const filteredHandovers = useMemo(() => {
    let result = handovers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.apartmentCode.toLowerCase().includes(query) ||
          h.customerName.toLowerCase().includes(query) ||
          h.projectName.toLowerCase().includes(query)
      );
    }

    if (selectedStatus !== 'all') {
      result = result.filter((h) => h.status === selectedStatus);
    }

    return result;
  }, [searchQuery, selectedStatus]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleHandoverPress = (handover: Handover) => {
    console.log('[Handovers] Navigate to handover detail', { id: handover.id });
    router.push({
      pathname: '/handover/[id]',
      params: { id: handover.id },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Bàn giao',
          headerStyle: {
            backgroundColor: colors.surface,
          },
        }}
      />

      <View style={[styles.header, { paddingTop: 16 }]}>
        <View style={styles.searchContainer}>
          <Search color={colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm mã căn, khách hàng, dự án..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedStatus === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedStatus('all')}
          >
            <Text style={[styles.filterText, selectedStatus === 'all' && styles.filterTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>
          {Object.entries(statusConfig).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterChip,
                selectedStatus === key && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(key as HandoverStatus)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedStatus === key && styles.filterTextActive,
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredHandovers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CheckCircle color={colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>Không tìm thấy bàn giao</Text>
            <Text style={styles.emptyText}>Thử thay đổi bộ lọc hoặc tìm kiếm khác</Text>
          </View>
        ) : (
          filteredHandovers.map((handover) => {
            const config = statusConfig[handover.status];
            const StatusIcon = config.icon;

            return (
              <TouchableOpacity
                key={handover.id}
                style={styles.handoverCard}
                activeOpacity={0.7}
                onPress={() => handleHandoverPress(handover)}
              >
                <Image
                  source={{ uri: handover.image }}
                  style={styles.handoverImage}
                  contentFit="cover"
                />
                <View style={styles.handoverContent}>
                  <View style={styles.handoverHeader}>
                    <Text style={styles.apartmentCode}>{handover.apartmentCode}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                      <StatusIcon color={config.color} size={14} />
                      <Text style={[styles.statusText, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.projectName}>{handover.projectName}</Text>

                  <View style={styles.infoRow}>
                    <MapPin color={colors.textSecondary} size={16} />
                    <Text style={styles.infoText}>{handover.address}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.customerLabel}>Khách hàng:</Text>
                    <Text style={styles.customerName}>{handover.customerName}</Text>
                  </View>

                  {handover.scheduledDate && (
                    <View style={styles.infoRow}>
                      <Calendar color={colors.textSecondary} size={16} />
                      <Text style={styles.infoText}>
                        {handover.status === 'completed'
                          ? `Hoàn thành: ${formatDate(handover.completedDate!)}`
                          : `Lịch hẹn: ${formatDate(handover.scheduledDate)}`}
                      </Text>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.areaInfo}>
                      <Text style={styles.areaLabel}>Diện tích:</Text>
                      <Text style={styles.areaValue}>{handover.clearArea} m²</Text>
                    </View>
                    <ChevronRight color={colors.primary} size={20} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  filterTextActive: {
    color: colors.surface,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  handoverCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  handoverImage: {
    width: '100%',
    height: 160,
  },
  handoverContent: {
    padding: 16,
  },
  handoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  apartmentCode: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  customerLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  areaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  areaLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  areaValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
