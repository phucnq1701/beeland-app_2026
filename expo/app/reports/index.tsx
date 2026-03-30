import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { DollarSign, AlertTriangle, FileText, ShoppingBag, ChevronRight, TrendingUp, BarChart3 } from 'lucide-react-native';
import { reportCategories, summaryStats } from '@/mocks/reports';

const iconMap: Record<string, React.ReactNode> = {
  payment: <DollarSign color="#10B981" size={26} />,
  debt: <AlertTriangle color="#EF4444" size={26} />,
  contract: <FileText color="#3B82F6" size={26} />,
  sales: <ShoppingBag color="#F59E0B" size={26} />,
};

export default function ReportsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Báo cáo',
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
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.overviewIconWrap}>
              <BarChart3 color={Colors.primary} size={22} />
            </View>
            <Text style={styles.overviewTitle}>Tổng quan</Text>
          </View>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{summaryStats.totalRevenue}</Text>
              <Text style={styles.overviewLabel}>Tổng doanh thu</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{summaryStats.totalSales}</Text>
              <Text style={styles.overviewLabel}>Giao dịch</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{summaryStats.pendingPayments}</Text>
              <Text style={styles.overviewLabel}>Chờ thanh toán</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Danh mục báo cáo</Text>

        <View style={styles.categoriesContainer}>
          {reportCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryCard}
              activeOpacity={0.7}
              onPress={() => router.push(cat.route as any)}
              testID={`report-category-${cat.id}`}
            >
              <View style={styles.categoryLeft}>
                <View style={[styles.categoryIcon, { backgroundColor: cat.bgColor }]}>
                  {iconMap[cat.id]}
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{cat.title}</Text>
                  <Text style={styles.categorySubtitle}>{cat.subtitle}</Text>
                  <View style={styles.categoryMeta}>
                    <View style={[styles.metaBadge, { backgroundColor: cat.bgColor }]}>
                      <Text style={[styles.metaBadgeText, { color: cat.color }]}>{cat.count} mục</Text>
                    </View>
                    <Text style={styles.metaAmount}>{cat.totalAmount}</Text>
                  </View>
                </View>
              </View>
              <ChevronRight color={Colors.textTertiary} size={20} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.quickStatsSection}>
          <Text style={styles.sectionTitle}>Thống kê nhanh</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: '#ECFDF5' }]}>
                <TrendingUp color="#10B981" size={20} />
              </View>
              <Text style={styles.quickStatValue}>{summaryStats.completedContracts}</Text>
              <Text style={styles.quickStatLabel}>HĐ hoàn tất</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: '#FEF2F2' }]}>
                <AlertTriangle color="#EF4444" size={20} />
              </View>
              <Text style={styles.quickStatValue}>8</Text>
              <Text style={styles.quickStatLabel}>Công nợ</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: '#EFF6FF' }]}>
                <FileText color="#3B82F6" size={20} />
              </View>
              <Text style={styles.quickStatValue}>10</Text>
              <Text style={styles.quickStatLabel}>Hợp đồng</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: '#FFFBEB' }]}>
                <DollarSign color="#F59E0B" size={20} />
              </View>
              <Text style={styles.quickStatValue}>10</Text>
              <Text style={styles.quickStatLabel}>Phiếu thu</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  overviewCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
    }),
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  overviewIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 111, 37, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  overviewGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  categoriesContainer: {
    gap: 12,
    marginBottom: 28,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }),
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    gap: 4,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  categorySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  metaAmount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  quickStatsSection: {
    marginBottom: 20,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStatCard: {
    width: '47%' as any,
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.04)' },
    }),
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  quickStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
