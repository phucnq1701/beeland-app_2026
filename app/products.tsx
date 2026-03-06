import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Search, List, Grid3x3, Filter, ChevronLeft, ChevronDown, ChevronUp, ChevronRight, LayoutDashboard } from 'lucide-react-native';
import { overviewBlocks, statusConfig, getOverviewStats, UnitStatus } from '@/mocks/overviewUnits';
import Colors from '@/constants/colors';
import { products, Product } from '@/mocks/properties';

type ViewMode = 'list' | 'grid' | 'overview';

type Unit = {
  id: string;
  floor: string;
  column: string;
  status: 'available' | 'locked' | 'sold' | 'deposit';
};

type Block = {
  name: string;
  units: Unit[];
  stats: {
    total: number;
    available: number;
    deposit: number;
  };
};

export default function ProductsScreen() {
  const { showFavorites } = useLocalSearchParams<{ showFavorites?: string }>();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterExpanded, setFilterExpanded] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<Product['status'] | 'all'>('all');
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number>(0);
  const [selectedOverviewStatus, setSelectedOverviewStatus] = useState<UnitStatus | 'all'>('all');
  const [onlyShowFavorites, setOnlyShowFavorites] = useState<boolean>(showFavorites === 'true');
  const router = useRouter();

  const blocks: Block[] = [
    {
      name: 'Block A1',
      units: [
        { id: '01-19', floor: 'T19', column: '01', status: 'deposit' },
        { id: '04-18', floor: 'T18', column: '04', status: 'sold' },
        { id: '05-17', floor: 'T17', column: '05', status: 'sold' },
        { id: '03-16', floor: 'T16', column: '03', status: 'locked' },
        { id: '01-15', floor: 'T15', column: '01', status: 'deposit' },
        { id: '01-14', floor: 'T14', column: '01', status: 'locked' },
        { id: '02-14', floor: 'T14', column: '02', status: 'available' },
        { id: '04-13', floor: 'T13', column: '04', status: 'available' },
        { id: '03-12', floor: 'T12', column: '03', status: 'available' },
      ],
      stats: { total: 10, available: 4, deposit: 3 },
    },
    {
      name: 'Block B2',
      units: [
        { id: '01-26', floor: 'T26', column: '01', status: 'available' },
        { id: '05-24', floor: 'T24', column: '05', status: 'available' },
        { id: '03-23', floor: 'T23', column: '03', status: 'deposit' },
        { id: '01-22', floor: 'T22', column: '01', status: 'locked' },
        { id: '02-21', floor: 'T21', column: '02', status: 'available' },
        { id: '04-20', floor: 'T20', column: '04', status: 'sold' },
        { id: '01-19', floor: 'T19', column: '01', status: 'deposit' },
        { id: '04-18', floor: 'T18', column: '04', status: 'sold' },
      ],
      stats: { total: 10, available: 4, deposit: 2 },
    },
  ];

  const projects = ['Masteri Thảo Điền', 'Vinhomes Central Park', 'The Sun Avenue'];
  const statuses: Array<{value: Product['status'] | 'all', label: string}> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'available', label: 'Đã cọc' },
    { value: 'pending', label: 'HĐMB chờ...' },
    { value: 'cancelled', label: 'Hủy bỏ' },
  ];

  const getStatusLabel = (status: Product['status']) => {
    switch (status) {
      case 'available':
        return 'Đã cọc';
      case 'cancelled':
        return 'Hủy bỏ';
      case 'pending':
        return 'HĐMB chờ...';
      default:
        return '';
    }
  };

  const getStatusColor = (status: Product['status']) => {
    switch (status) {
      case 'available':
        return '#10B981';
      case 'cancelled':
        return '#9CA3AF';
      case 'pending':
        return '#F59E0B';
      default:
        return '#9CA3AF';
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery
      ? product.code.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesStatus = selectedStatus === 'all' || product.status === selectedStatus;
    
    const matchesFavorites = onlyShowFavorites ? false : true;
    
    return matchesSearch && matchesStatus && matchesFavorites;
  });

  const handlePressProduct = (id: string) => {
    console.log('[Products] Navigate to product detail', { id });
    router.push({ pathname: '/product/[id]', params: { id } });
  };



  const getUnitStatusColor = (status: Unit['status']) => {
    switch (status) {
      case 'deposit':
        return '#10B981';
      case 'locked':
        return '#F59E0B';
      case 'sold':
        return '#EF4444';
      case 'available':
        return '#3B82F6';
      default:
        return '#9CA3AF';
    }
  };

  const _getUnitStatusLabel = (status: Unit['status']) => {
    switch (status) {
      case 'deposit':
        return 'Cọc';
      case 'locked':
        return 'Lock';
      case 'sold':
        return 'Đã bán';
      case 'available':
        return 'Còn trống';
      default:
        return '';
    }
  };

  const currentBlock = blocks[currentBlockIndex];
  const floors = ['T19', 'T18', 'T17', 'T16', 'T15', 'T14', 'T13', 'T12'];
  const columns = ['01', '02', '03', '04', '05'];

  const currentOverviewBlock = overviewBlocks[0];
  const overviewStats = getOverviewStats(currentOverviewBlock);

  const statusSummaryItems: Array<{ key: UnitStatus | 'all'; label: string; count: number; color: string }> = [
    { key: 'all', label: 'TỔNG', count: overviewStats.total, color: '#3B82F6' },
    { key: 'available', label: 'TRỐNG', count: overviewStats.available, color: '#22C55E' },
    { key: 'holding', label: 'GIỮ CHỖ', count: overviewStats.holding, color: '#F59E0B' },
    { key: 'pending_kitchen', label: 'BẾP CHỜ', count: overviewStats.pendingKitchen, color: '#F97316' },
    { key: 'sold', label: 'ĐÃ BÁN', count: overviewStats.sold, color: '#EF4444' },
    { key: 'deposit', label: 'ĐÃ CỌC', count: overviewStats.deposit, color: '#3B82F6' },
  ];

  const renderOverviewView = () => (
    <View style={styles.overviewContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusSummaryScroll} contentContainerStyle={styles.statusSummaryContent}>
        {statusSummaryItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.statusSummaryItem,
              { backgroundColor: item.color },
              selectedOverviewStatus === item.key && styles.statusSummaryItemActive,
            ]}
            onPress={() => setSelectedOverviewStatus(item.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.statusSummaryLabel}>{item.label}</Text>
            <Text style={styles.statusSummaryCount}>{item.count}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {currentOverviewBlock.floors.map((floor) => {
        const filteredUnits = selectedOverviewStatus === 'all'
          ? floor.units
          : floor.units.filter((u) => u.status === selectedOverviewStatus);

        if (filteredUnits.length === 0) return null;

        return (
          <View key={floor.name} style={styles.floorSection}>
            <View style={styles.floorHeader}>
              <Text style={styles.floorName}>{floor.name}</Text>
              <Text style={styles.floorCount}>({floor.totalUnits} CĂN)</Text>
            </View>
            <View style={styles.unitsGrid}>
              {filteredUnits.map((unit) => {
                const config = statusConfig[unit.status];
                return (
                  <TouchableOpacity
                    key={unit.id}
                    style={[styles.unitCard, { backgroundColor: config.bgColor }]}
                    onPress={() => handlePressProduct(unit.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.unitCode} numberOfLines={1}>{unit.code}</Text>
                    <Text style={styles.unitPrice}>{unit.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderGridView = () => (
    <View style={styles.gridContainer}>
      <View style={styles.statusLegend}>
        <Text style={styles.legendTitle}>Trạng thái:</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Cọc</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Lock</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Đã bán</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>Còn trống</Text>
          </View>
        </View>
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.blockTitle}>{currentBlock.name}</Text>
        
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.headerCell]}>
              <Text style={styles.headerCellText}>T\V</Text>
            </View>
            {columns.map((col) => (
              <View key={col} style={[styles.gridCell, styles.headerCell]}>
                <Text style={styles.headerCellText}>{col}</Text>
              </View>
            ))}
          </View>

          {floors.map((floor) => (
            <View key={floor} style={styles.gridRow}>
              <View style={[styles.gridCell, styles.floorCell]}>
                <Text style={styles.floorCellText}>{floor}</Text>
              </View>
              {columns.map((col) => {
                const unit = currentBlock.units.find(
                  (u) => u.floor === floor && u.column === col
                );
                return (
                  <View key={`${floor}-${col}`} style={styles.gridCell}>
                    {unit ? (
                      <TouchableOpacity
                        style={[
                          styles.unitCell,
                          { backgroundColor: getUnitStatusColor(unit.status) },
                        ]}
                        onPress={() => handlePressProduct(unit.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.unitCellText}>{unit.id}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.emptyCell}>
                        <Text style={styles.emptyCellText}>-</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.blockNavigation}>
          <TouchableOpacity
            onPress={() => setCurrentBlockIndex(Math.max(0, currentBlockIndex - 1))}
            disabled={currentBlockIndex === 0}
            style={[
              styles.navButton,
              currentBlockIndex === 0 && styles.navButtonDisabled,
            ]}
            activeOpacity={0.7}
          >
            <ChevronLeft
              color={currentBlockIndex === 0 ? '#D1D5DB' : Colors.text}
              size={20}
            />
          </TouchableOpacity>

          <View style={styles.progressBar}>
            {blocks.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentBlockIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={() =>
              setCurrentBlockIndex(Math.min(blocks.length - 1, currentBlockIndex + 1))
            }
            disabled={currentBlockIndex === blocks.length - 1}
            style={[
              styles.navButton,
              currentBlockIndex === blocks.length - 1 && styles.navButtonDisabled,
            ]}
            activeOpacity={0.7}
          >
            <ChevronRight
              color={currentBlockIndex === blocks.length - 1 ? '#D1D5DB' : Colors.text}
              size={20}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.blockStats}>
          {currentBlock.name}: {currentBlock.stats.total} căn • {currentBlock.stats.available} trống • {currentBlock.stats.deposit} cọc
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Sản phẩm',
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.headerBackButton}
            >
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerViewMode}>
              <TouchableOpacity
                style={[styles.headerViewBtn, viewMode === 'list' && styles.headerViewBtnActive]}
                onPress={() => setViewMode('list')}
                activeOpacity={0.8}
              >
                <List color={viewMode === 'list' ? Colors.white : 'rgba(255,255,255,0.5)'} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerViewBtn, viewMode === 'grid' && styles.headerViewBtnActive]}
                onPress={() => setViewMode('grid')}
                activeOpacity={0.8}
              >
                <Grid3x3 color={viewMode === 'grid' ? Colors.white : 'rgba(255,255,255,0.5)'} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerViewBtn, viewMode === 'overview' && styles.headerViewBtnActive]}
                onPress={() => setViewMode('overview')}
                activeOpacity={0.8}
              >
                <LayoutDashboard color={viewMode === 'overview' ? Colors.white : 'rgba(255,255,255,0.5)'} size={18} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchAndFilterRow}>
          <View style={styles.searchContainer}>
            <Search color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm theo tên dự án, mã căn, loại..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity 
            style={styles.filterButton} 
            activeOpacity={0.7}
            onPress={() => setFilterExpanded(!filterExpanded)}
          >
            <Filter color={Colors.primary} size={18} />
            <Text style={styles.filterText}>Bộ lọc</Text>
            {filterExpanded ? (
              <ChevronUp color={Colors.primary} size={18} />
            ) : (
              <ChevronDown color={Colors.primary} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {filterExpanded && (
          <View style={styles.filterPanel}>
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Dự án</Text>
              <View style={styles.filterOptionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    selectedProject === 'all' && styles.filterOptionActive,
                  ]}
                  onPress={() => setSelectedProject('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedProject === 'all' && styles.filterOptionTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {projects.map((project) => (
                  <TouchableOpacity
                    key={project}
                    style={[
                      styles.filterOption,
                      selectedProject === project && styles.filterOptionActive,
                    ]}
                    onPress={() => setSelectedProject(project)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedProject === project && styles.filterOptionTextActive,
                      ]}
                    >
                      {project}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Trạng thái</Text>
              <View style={styles.filterOptionsGrid}>
                {statuses.map((status) => (
                  <TouchableOpacity
                    key={status.value}
                    style={[
                      styles.filterOption,
                      selectedStatus === status.value && styles.filterOptionActive,
                    ]}
                    onPress={() => setSelectedStatus(status.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedStatus === status.value && styles.filterOptionTextActive,
                      ]}
                    >
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Yêu thích</Text>
              <View style={styles.filterOptionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    !onlyShowFavorites && styles.filterOptionActive,
                  ]}
                  onPress={() => setOnlyShowFavorites(false)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      !onlyShowFavorites && styles.filterOptionTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    onlyShowFavorites && styles.filterOptionActive,
                  ]}
                  onPress={() => setOnlyShowFavorites(true)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      onlyShowFavorites && styles.filterOptionTextActive,
                    ]}
                  >
                    Chỉ yêu thích
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {viewMode === 'list' ? (
          <>
            <View style={styles.productTable}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colStatus]}>Trạng thái</Text>
            <Text style={[styles.tableHeaderText, styles.colCode]}>Mã sản phẩm</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>Tổng giá trị gốm PBT</Text>
          </View>

          {filteredProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.tableRow}
              activeOpacity={0.7}
              onPress={() => handlePressProduct(product.id)}
            >
              <View style={[styles.colStatus, styles.statusBadgeContainer]}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(product.status) },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(product.status)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.tableText, styles.colCode]}>{product.code}</Text>
              <Text style={[styles.tableText, styles.colPrice, styles.priceText]}>
                {product.price}
              </Text>
            </TouchableOpacity>
          ))}
            </View>
          </>
        ) : viewMode === 'grid' ? (
          renderGridView()
        ) : (
          renderOverviewView()
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
  headerBackButton: {
    marginLeft: 8,
  },
  headerViewMode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  headerViewBtn: {
    padding: 6,
    borderRadius: 6,
  },
  headerViewBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewModeLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  viewModeContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.white,
  },
  viewModeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  viewModeButtonMiddle: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  viewModeButtonRight: {},
  viewModeButtonActive: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  viewModeTextActive: {
    color: Colors.white,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  productCount: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  productCountBold: {
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  productTable: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
    position: 'relative' as const,
  },
  tableText: {
    fontSize: 14,
    color: Colors.text,
  },
  colStatus: {
    width: 110,
  },
  colCode: {
    flex: 1,
  },
  colPrice: {
    width: 90,
    textAlign: 'right' as const,
    paddingRight: 4,
  },
  statusBadgeContainer: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  priceText: {
    fontWeight: '500' as const,
  },
  filterPanel: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  filterOptionTextActive: {
    color: Colors.white,
  },
  gridContainer: {
    gap: 20,
  },
  statusLegend: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: Colors.text,
  },
  blockCard: {
    backgroundColor: '#FEF7F3',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  grid: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: '#F3E8DC',
    borderRadius: 6,
  },
  headerCellText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  floorCell: {
    backgroundColor: '#E8EAF6',
    borderRadius: 6,
  },
  floorCellText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  unitCell: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  unitCellText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  emptyCell: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyCellText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  blockNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    flex: 1,
    maxWidth: 60,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  blockStats: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  overviewContainer: {
    gap: 16,
  },
  statusSummaryScroll: {
    marginBottom: 4,
  },
  statusSummaryContent: {
    gap: 8,
    paddingVertical: 2,
  },
  statusSummaryItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center' as const,
    minWidth: 72,
  },
  statusSummaryItemActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  statusSummaryLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statusSummaryCount: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  floorSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  floorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  floorName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  floorCount: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
  },
  unitCard: {
    width: '23%' as unknown as number,
    flexBasis: '23%' as unknown as number,
    flexGrow: 0,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  unitCode: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  unitPrice: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.85)',
  },
});
