import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import Colors from '@/constants/colors';
import { TrendingUp, ShoppingBag } from 'lucide-react-native';
import {
  salesReportData,
  revenueByProjectData,
  summaryStats,
} from '@/mocks/reports';
import ReportFilterBar from '@/components/ReportFilterBar';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;

type TabType = 'transactions' | 'revenue' | 'projects';

export default function SalesReportScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const handleReset = useCallback(() => {
    setSelectedProject('all');
    setFromDate('');
    setToDate('');
  }, []);

  const chartConfig = {
    backgroundColor: Colors.white,
    backgroundGradientFrom: Colors.white,
    backgroundGradientTo: Colors.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(232, 111, 37, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: { borderRadius: 16 },
    propsForBackgroundLines: { strokeDasharray: '', stroke: Colors.border, strokeWidth: 1 },
    propsForLabels: { fontSize: 11 },
  };

  const salesChartData = {
    labels: salesReportData.map(d => d.month),
    datasets: [{ data: salesReportData.map(d => d.sales), color: (opacity = 1) => `rgba(232, 111, 37, ${opacity})`, strokeWidth: 3 }],
  };

  const revenueChartData = {
    labels: salesReportData.map(d => d.month),
    datasets: [{ data: salesReportData.map(d => d.revenue) }],
  };

  const projectRevenueChartData = {
    labels: revenueByProjectData.map(d => {
      const words = d.projectName.split(' ');
      return words.length > 2 ? words.slice(0, 2).join(' ') : d.projectName;
    }),
    datasets: [{ data: revenueByProjectData.map(d => d.revenue) }],
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Báo cáo bán hàng',
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
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <ShoppingBag color="#F59E0B" size={20} />
            <View>
              <Text style={styles.summaryValue}>{summaryStats.totalRevenue}</Text>
              <Text style={styles.summaryLabel}>Tổng doanh thu</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.primary }]}>
            <TrendingUp color={Colors.primary} size={20} />
            <View>
              <Text style={styles.summaryValue}>{summaryStats.totalSales}</Text>
              <Text style={styles.summaryLabel}>Giao dịch</Text>
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

        <View style={styles.tabsContainer}>
          {(['transactions', 'revenue', 'projects'] as TabType[]).map((tab) => {
            const labels: Record<TabType, string> = { transactions: 'Giao dịch', revenue: 'Doanh thu', projects: 'Dự án' };
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{labels[tab]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'transactions' && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Số giao dịch theo tháng</Text>
            <LineChart
              data={salesChartData}
              width={CHART_WIDTH - 32}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines
              withOuterLines
              withVerticalLabels
              withHorizontalLabels
              yAxisSuffix=""
              yAxisInterval={1}
              fromZero
            />
          </View>
        )}

        {activeTab === 'revenue' && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Doanh thu theo tháng (Triệu VNĐ)</Text>
            <BarChart
              data={revenueChartData}
              width={CHART_WIDTH - 32}
              height={220}
              chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})` }}
              style={styles.chart}
              showValuesOnTopOfBars={false}
              fromZero
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        )}

        {activeTab === 'projects' && (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Doanh thu theo dự án (Triệu VNĐ)</Text>
              <BarChart
                data={projectRevenueChartData}
                width={CHART_WIDTH - 32}
                height={240}
                chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(232, 111, 37, ${opacity})` }}
                style={styles.chart}
                showValuesOnTopOfBars={false}
                fromZero
                yAxisLabel=""
                yAxisSuffix=""
              />
            </View>

            <View style={styles.projectList}>
              <Text style={styles.projectListTitle}>Chi tiết doanh thu dự án</Text>
              {revenueByProjectData.map((project, index) => {
                const rankColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
                const rankColor = rankColors[index] || Colors.primary;
                return (
                  <View key={index} style={styles.projectItem}>
                    <View style={styles.projectItemLeft}>
                      <View style={[styles.projectRank, { backgroundColor: rankColor }]}>
                        <Text style={styles.projectRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.projectItemInfo}>
                        <Text style={styles.projectName}>{project.projectName}</Text>
                        <View style={styles.projectBar}>
                          <View style={[styles.projectBarFill, { width: `${project.percentage}%`, backgroundColor: rankColor }]} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.projectItemRight}>
                      <Text style={styles.projectRevenue}>{project.revenue} Tr</Text>
                      <Text style={styles.projectPercentage}>{project.percentage}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
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
  tabsContainer: {
    flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 12, padding: 4,
    marginBottom: 20, gap: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  chartCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, paddingTop: 20, marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },
  chartTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 16 },
  chart: { marginVertical: 8, borderRadius: 16 },
  projectList: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },
  projectListTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  projectItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  projectItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 16 },
  projectRank: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  projectRankText: { fontSize: 14, fontWeight: '700' as const, color: Colors.white },
  projectItemInfo: { flex: 1, gap: 8 },
  projectName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  projectBar: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  projectBarFill: { height: '100%', borderRadius: 3 },
  projectItemRight: { alignItems: 'flex-end' },
  projectRevenue: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 2 },
  projectPercentage: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary },
});
