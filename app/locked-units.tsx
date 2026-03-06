import React, { useState, useMemo, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Filter, X, Clock, Calendar, Timer } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { lockedUnits } from '@/mocks/lockedUnits';

export default function LockedUnitsScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const projects = useMemo(() => {
    const uniqueProjects = Array.from(
      new Set(lockedUnits.map((unit) => unit.projectId))
    ).map((id) => {
      const unit = lockedUnits.find((u) => u.projectId === id);
      return {
        id,
        name: unit?.projectName || '',
      };
    });

    return [{ id: 'all', name: 'Tất cả dự án' }, ...uniqueProjects];
  }, []);

  const getRemainingMinutes = (unit: typeof lockedUnits[0]): number => {
    const elapsedMinutes = Math.floor(
      (currentTime.getTime() - unit.lockTime.getTime()) / (1000 * 60)
    );
    const remaining = unit.lockDurationMinutes - elapsedMinutes;
    return Math.max(0, remaining);
  };

  const filteredUnits = useMemo(() => {
    const filtered = lockedUnits.filter((unit) => {
      const matchesSearch =
        unit.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.projectName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProject =
        selectedProject === 'all' || unit.projectId === selectedProject;

      const remainingMinutes = getRemainingMinutes(unit);
      const isActive = remainingMinutes > 0;

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && isActive) ||
        (selectedStatus === 'expired' && !isActive);

      return matchesSearch && matchesProject && matchesStatus;
    });

    return filtered.sort((a, b) => {
      const remainingA = getRemainingMinutes(a);
      const remainingB = getRemainingMinutes(b);
      return remainingB - remainingA;
    });
  }, [searchQuery, selectedProject, selectedStatus, currentTime, getRemainingMinutes]);

  function formatLockTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  }

  function formatRemainingTime(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes} phút`;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Căn đã lock',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm theo mã căn, dự án..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            (selectedProject !== 'all' || selectedStatus !== 'active') && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilter(!showFilter)}
        >
          <Filter
            color={(selectedProject !== 'all' || selectedStatus !== 'active') ? Colors.white : Colors.text}
            size={20}
          />
        </TouchableOpacity>
      </View>

      {showFilter && (
        <View style={styles.filterContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Trạng thái</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedStatus === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setSelectedStatus('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatus === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedStatus === 'active' && styles.filterChipActive,
                ]}
                onPress={() => setSelectedStatus('active')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatus === 'active' && styles.filterChipTextActive,
                  ]}
                >
                  Còn hạn
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedStatus === 'expired' && styles.filterChipActive,
                ]}
                onPress={() => setSelectedStatus('expired')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatus === 'expired' && styles.filterChipTextActive,
                  ]}
                >
                  Hết hạn
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Dự án</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {projects.map((project) => (
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
                      selectedProject === project.id &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {project.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Text style={styles.resultText}>
          {filteredUnits.length} căn {selectedStatus === 'active' ? 'còn hạn' : selectedStatus === 'expired' ? 'hết hạn' : ''}
        </Text>

        {filteredUnits.map((unit) => {
          const remainingMinutes = getRemainingMinutes(unit);
          const progress = remainingMinutes / unit.lockDurationMinutes;

          return (
            <TouchableOpacity
              key={unit.id}
              style={styles.unitCard}
              activeOpacity={0.7}
              onPress={() => {
                const remaining = getRemainingMinutes(unit);
                router.push({
                  pathname: '/product/[id]',
                  params: { 
                    id: unit.id,
                    lockMinutes: remaining.toString(),
                  },
                });
              }}
            >
              <View style={styles.unitHeader}>
                <View style={styles.unitHeaderLeft}>
                  <Text style={styles.projectName}>{unit.projectName}</Text>
                  <Text style={styles.productCode}>{unit.productCode}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: remainingMinutes > 0 ? getStatusColor(progress) : '#6B7280' },
                  ]}
                >
                  <Clock color={Colors.white} size={14} />
                  <Text style={styles.statusBadgeText}>
                    {remainingMinutes > 0 ? 'Còn hạn' : 'Hết hạn'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.unitDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <Calendar color={Colors.textSecondary} size={16} />
                    <Text style={styles.detailLabel}>Thời gian lock</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {formatLockTime(unit.lockTime)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <Timer color={Colors.textSecondary} size={16} />
                    <Text style={styles.detailLabel}>
                      {remainingMinutes > 0 ? 'Thời gian còn lại' : 'Trạng thái'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.detailValue,
                      styles.remainingTime,
                      { color: remainingMinutes > 0 ? getStatusColor(progress) : '#6B7280' },
                    ]}
                  >
                    {remainingMinutes > 0 ? formatRemainingTime(remainingMinutes) : 'Đã hết hạn'}
                  </Text>
                </View>
              </View>

              {remainingMinutes > 0 && (
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${progress * 100}%`,
                        backgroundColor: getStatusColor(progress),
                      },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {filteredUnits.length === 0 && (
          <View style={styles.emptyContainer}>
            <Clock color={Colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>Không có căn đang lock</Text>
            <Text style={styles.emptyDescription}>
              {searchQuery || selectedProject !== 'all'
                ? 'Không tìm thấy căn nào phù hợp với bộ lọc'
                : 'Bạn chưa lock căn nào'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStatusColor(progress: number): string {
  if (progress > 0.5) return '#10B981';
  if (progress > 0.25) return '#F59E0B';
  return '#EF4444';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
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
  filterContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    gap: 12,
  },
  filterSection: {
    gap: 8,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    paddingHorizontal: 24,
  },
  filterScrollContent: {
    paddingHorizontal: 24,
    gap: 8,
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
    fontWeight: '600' as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  resultText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontWeight: '500' as const,
  },
  unitCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  unitHeaderLeft: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  productCode: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  unitDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  remainingTime: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 32,
  },
});
