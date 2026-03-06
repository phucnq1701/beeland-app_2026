import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import Colors from '@/constants/colors';
import { TrendingUp, DollarSign, FileCheck, AlertCircle, ChevronDown, X } from 'lucide-react-native';
import {
  salesReportData,
  revenueByProjectData,
  monthlyRevenueData,
  summaryStats,
} from '@/mocks/reports';
import { featuredProperties } from '@/mocks/properties';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;

type TabType = 'sales' | 'revenue' | 'projects';
type TimePeriod = 'all' | 'month' | 'quarter' | 'year';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('sales');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const projects = useMemo(() => [
    { id: 'all', name: 'Tất cả dự án' },
    ...featuredProperties.map(p => ({ id: p.id, name: p.title }))
  ], []);

  const timePeriods: { id: TimePeriod; name: string }[] = [
    { id: 'all', name: 'Tất cả thời gian' },
    { id: 'month', name: 'Tháng này' },
    { id: 'quarter', name: 'Quý này' },
    { id: 'year', name: 'Năm nay' },
  ];

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || 'Tất cả dự án';
  const selectedPeriodName = timePeriods.find(p => p.id === selectedPeriod)?.name || 'Tất cả thời gian';

  const chartConfig = {
    backgroundColor: Colors.white,
    backgroundGradientFrom: Colors.white,
    backgroundGradientTo: Colors.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(232, 111, 37, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: Colors.border,
      strokeWidth: 1,
    },
    propsForLabels: {
      fontSize: 11,
    },
  };

  const salesChartData = {
    labels: salesReportData.map(d => d.month),
    datasets: [
      {
        data: salesReportData.map(d => d.sales),
        color: (opacity = 1) => `rgba(232, 111, 37, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  const revenueChartData = {
    labels: salesReportData.map(d => d.month),
    datasets: [
      {
        data: salesReportData.map(d => d.revenue),
      },
    ],
  };

  const monthlyRevenueChartData = {
    labels: monthlyRevenueData.map(d => d.month),
    datasets: [
      {
        data: monthlyRevenueData.map(d => d.booking),
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
      },
      {
        data: monthlyRevenueData.map(d => d.contract),
        color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
      },
      {
        data: monthlyRevenueData.map(d => d.collected),
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
      },
    ],
    legend: ['Booking', 'Hợp đồng', 'Thu tiền'],
  };

  const projectRevenueChartData = {
    labels: revenueByProjectData.map(d => {
      const words = d.projectName.split(' ');
      return words.length > 2 ? words.slice(0, 2).join(' ') : d.projectName;
    }),
    datasets: [
      {
        data: revenueByProjectData.map(d => d.revenue),
      },
    ],
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          title: 'Báo cáo',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filtersContainer}>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowProjectModal(true)}
          >
            <Text style={styles.filterLabel}>Dự án</Text>
            <View style={styles.filterValueRow}>
              <Text style={styles.filterValue} numberOfLines={1}>{selectedProjectName}</Text>
              <ChevronDown color={Colors.textSecondary} size={18} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowPeriodModal(true)}
          >
            <Text style={styles.filterLabel}>Thời gian</Text>
            <View style={styles.filterValueRow}>
              <Text style={styles.filterValue} numberOfLines={1}>{selectedPeriodName}</Text>
              <ChevronDown color={Colors.textSecondary} size={18} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#ECFDF5' }]}>
              <DollarSign color="#10B981" size={24} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>Tổng doanh thu</Text>
              <Text style={styles.statValue}>{summaryStats.totalRevenue}</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#EFF6FF' }]}>
              <TrendingUp color="#3B82F6" size={24} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>Tổng giao dịch</Text>
              <Text style={styles.statValue}>{summaryStats.totalSales}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#FEF2F2' }]}>
              <AlertCircle color="#EF4444" size={24} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>Chờ thanh toán</Text>
              <Text style={styles.statValue}>{summaryStats.pendingPayments}</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#F0FDF4' }]}>
              <FileCheck color="#22C55E" size={24} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>Hợp đồng hoàn tất</Text>
              <Text style={styles.statValue}>{summaryStats.completedContracts}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sales' && styles.tabActive]}
            onPress={() => setActiveTab('sales')}
          >
            <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>
              Bán hàng
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'revenue' && styles.tabActive]}
            onPress={() => setActiveTab('revenue')}
          >
            <Text style={[styles.tabText, activeTab === 'revenue' && styles.tabTextActive]}>
              Thu tiền
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'projects' && styles.tabActive]}
            onPress={() => setActiveTab('projects')}
          >
            <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>
              Dự án
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'sales' && (
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Báo cáo bán hàng theo tháng</Text>
              <Text style={styles.chartSubtitle}>Số lượng giao dịch và doanh thu</Text>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>Số giao dịch theo tháng</Text>
              <LineChart
                data={salesChartData}
                width={CHART_WIDTH - 32}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                yAxisSuffix=""
                yAxisInterval={1}
                fromZero={true}
              />
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.legendText}>Số giao dịch</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartCardTitle}>Doanh thu theo tháng (Triệu VNĐ)</Text>
              <BarChart
                data={revenueChartData}
                width={CHART_WIDTH - 32}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                }}
                style={styles.chart}
                showValuesOnTopOfBars={false}
                fromZero={true}
                yAxisLabel=""
                yAxisSuffix=""
              />
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Doanh thu (Triệu VNĐ)</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'revenue' && (
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Báo cáo thu tiền</Text>
              <Text style={styles.chartSubtitle}>Booking, hợp đồng và tiền thu (Triệu VNĐ)</Text>
            </View>
            <View style={styles.chartCard}>
              <LineChart
                data={monthlyRevenueChartData}
                width={CHART_WIDTH - 32}
                height={240}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                }}
                bezier
                style={styles.chart}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                yAxisSuffix=""
                yAxisInterval={1}
                fromZero={true}
              />
            </View>

            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Tổng kết thu tiền (Triệu VNĐ)</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <View style={[styles.summaryDot, { backgroundColor: '#3B82F6' }]} />
                  </View>
                  <Text style={styles.summaryLabel}>Tổng Booking</Text>
                  <Text style={styles.summaryValue}>
                    {monthlyRevenueData.reduce((sum, d) => sum + d.booking, 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconBg, { backgroundColor: '#FFFBEB' }]}>
                    <View style={[styles.summaryDot, { backgroundColor: '#F59E0B' }]} />
                  </View>
                  <Text style={styles.summaryLabel}>Tổng hợp đồng</Text>
                  <Text style={styles.summaryValue}>
                    {monthlyRevenueData.reduce((sum, d) => sum + d.contract, 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <View style={[styles.summaryIconBg, { backgroundColor: '#ECFDF5' }]}>
                    <View style={[styles.summaryDot, { backgroundColor: '#10B981' }]} />
                  </View>
                  <Text style={styles.summaryLabel}>Đã thu tiền</Text>
                  <Text style={styles.summaryValue}>
                    {monthlyRevenueData.reduce((sum, d) => sum + d.collected, 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'projects' && (
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Doanh thu theo dự án</Text>
              <Text style={styles.chartSubtitle}>Top dự án có doanh thu cao nhất (Triệu VNĐ)</Text>
            </View>
            <View style={styles.chartCard}>
              <BarChart
                data={projectRevenueChartData}
                width={CHART_WIDTH - 32}
                height={240}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(232, 111, 37, ${opacity})`,
                }}
                style={styles.chart}
                showValuesOnTopOfBars={false}
                fromZero={true}
                yAxisLabel=""
                yAxisSuffix=""
              />
            </View>

            <View style={styles.projectList}>
              <Text style={styles.projectListTitle}>Chi tiết doanh thu dự án</Text>
              {revenueByProjectData.map((project, index) => (
                <View key={index} style={styles.projectItem}>
                  <View style={styles.projectItemLeft}>
                    <View style={[styles.projectRank, { backgroundColor: getProjectRankColor(index) }]}>
                      <Text style={styles.projectRankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.projectItemInfo}>
                      <Text style={styles.projectName}>{project.projectName}</Text>
                      <View style={styles.projectBar}>
                        <View
                          style={[
                            styles.projectBarFill,
                            { width: `${project.percentage}%`, backgroundColor: getProjectRankColor(index) },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.projectItemRight}>
                    <Text style={styles.projectRevenue}>{project.revenue} Tr</Text>
                    <Text style={styles.projectPercentage}>{project.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showProjectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn dự án</Text>
              <TouchableOpacity onPress={() => setShowProjectModal(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.modalItem,
                    selectedProject === project.id && styles.modalItemActive
                  ]}
                  onPress={() => {
                    setSelectedProject(project.id);
                    setShowProjectModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedProject === project.id && styles.modalItemTextActive
                  ]}>
                    {project.name}
                  </Text>
                  {selectedProject === project.id && (
                    <View style={styles.modalCheckmark} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPeriodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPeriodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn thời gian</Text>
              <TouchableOpacity onPress={() => setShowPeriodModal(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {timePeriods.map((period) => (
                <TouchableOpacity
                  key={period.id}
                  style={[
                    styles.modalItem,
                    selectedPeriod === period.id && styles.modalItemActive
                  ]}
                  onPress={() => {
                    setSelectedPeriod(period.id);
                    setShowPeriodModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedPeriod === period.id && styles.modalItemTextActive
                  ]}>
                    {period.name}
                  </Text>
                  {selectedPeriod === period.id && (
                    <View style={styles.modalCheckmark} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getProjectRankColor = (index: number) => {
  const colors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
  return colors[index] || Colors.primary;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  filterButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  filterLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  filterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalList: {
    padding: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemActive: {
    backgroundColor: Colors.background,
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
  modalCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
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
  statIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
    marginBottom: 20,
    gap: 4,
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
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  chartSection: {
    gap: 20,
  },
  chartHeader: {
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
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
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 20,
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
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  summarySection: {
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
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
  summaryIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  projectList: {
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
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  projectListTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  projectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  projectItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 16,
  },
  projectRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectRankText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  projectItemInfo: {
    flex: 1,
    gap: 8,
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  projectBar: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  projectBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  projectItemRight: {
    alignItems: 'flex-end',
  },
  projectRevenue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  projectPercentage: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
