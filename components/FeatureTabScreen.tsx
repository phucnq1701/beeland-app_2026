import React, {
  useCallback,
  useState,
  type ComponentType,
} from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Puzzle } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { loadMenuTabIds } from '@/components/utils/menuTabs';

import ProjectsScreen from '@/app/projects';
import ProductsScreen from '@/app/products';
import AppointmentsScreen from '@/app/appointments';
import LockedUnitsScreen from '@/app/locked-units';
import BookingsScreen from '@/app/bookings';
import CustomersScreen from '@/app/customers';
import ContractsScreen from '@/app/contracts';
import ReportsScreen from '@/app/reports/index';
import DepositsScreen from '@/app/deposits';

/** Map feature id → màn hình tương ứng hiển thị trong tab menu */
const SCREEN_MAP: Record<string, ComponentType<{ embedded?: boolean }>> = {
  '1': ProjectsScreen,
  '2': ProductsScreen,
  '3': AppointmentsScreen,
  '4': LockedUnitsScreen,
  '5': BookingsScreen,
  '6': CustomersScreen,
  '8': ContractsScreen,
  '9': ReportsScreen,
  '13': DepositsScreen,
};

interface FeatureTabScreenProps {
  /** Vị trí tab menu: 0 = cạnh Home (bên trái), 1 = cạnh Tài khoản (bên phải) */
  slot: 0 | 1;
}

/**
 * Màn hình cho 2 tab menu động ở giữa tab bar.
 * Nội dung được quyết định bởi cấu hình "Cấu hình menu" trong "Tất cả quản lý"
 * (AsyncStorage: @menu_tabs_config). Mặc định: 2 mục đầu tiên (Dự án, Sản phẩm).
 */
export default function FeatureTabScreen({ slot }: FeatureTabScreenProps) {
  const [featureId, setFeatureId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Reload cấu hình mỗi khi tab được focus (sau khi thay đổi ở "Tất cả quản lý")
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadMenuTabIds()
        .then((ids) => {
          if (!alive) return;
          setFeatureId(ids[slot] ?? null);
          setLoaded(true);
        })
        .catch(() => {
          if (alive) setLoaded(true);
        });
      return () => {
        alive = false;
      };
    }, [slot])
  );

  if (!loaded) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  const ScreenComponent = featureId ? SCREEN_MAP[featureId] : undefined;

  if (!ScreenComponent) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Puzzle color={Colors.textTertiary} size={44} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Tính năng chưa khả dụng</Text>
        <Text style={styles.emptySubtitle}>
          {'Chọn mục khác trong "Tất cả quản lý" → "Cấu hình menu"'}
        </Text>
      </View>
    );
  }

  // key={featureId} → remount màn hình khi cấu hình thay đổi
  return <ScreenComponent key={featureId ?? 'empty'} embedded />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});