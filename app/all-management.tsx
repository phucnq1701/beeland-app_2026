import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { features } from '@/mocks/features';
import { Settings, ChevronUp, ChevronDown, House, LayoutGrid } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadMenuTabIds,
  saveMenuTabIds,
  MAX_MENU_TABS,
  MENU_TAB_FEATURE_IDS,
  DEFAULT_MENU_TAB_IDS,
} from '@/components/utils/menuTabs';

const { width } = Dimensions.get('window');
const STORAGE_KEY = '@home_features_config';
const MAX_HOME_FEATURES = 6;

type ConfigTab = 'home' | 'menu';

export default function AllManagementScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ConfigTab>('home');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Cấu hình các mục trên trang chủ (tối đa 6)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [originalSelectedIds, setOriginalSelectedIds] = useState<string[]>([]);

  // Cấu hình 2 tab menu ở giữa tab bar (mặc định: 2 mục đầu tiên)
  const [menuSelectedIds, setMenuSelectedIds] =
    useState<string[]>(DEFAULT_MENU_TAB_IDS);
  const [menuOriginalIds, setMenuOriginalIds] =
    useState<string[]>(DEFAULT_MENU_TAB_IDS);

  useEffect(() => {
    loadConfiguration();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConfiguration();
    }, [])
  );

  const loadConfiguration = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        const ids = config.selectedIds || [];
        setSelectedIds(ids);
        setOriginalSelectedIds(ids);
      } else {
        const defaultIds = features.slice(0, MAX_HOME_FEATURES).map(f => f.id);
        setSelectedIds(defaultIds);
        setOriginalSelectedIds(defaultIds);
      }
    } catch (error) {
      console.log('[AllManagement] Load config error:', error instanceof Error ? error.message : String(error));
      const defaultIds = features.slice(0, MAX_HOME_FEATURES).map(f => f.id);
      setSelectedIds(defaultIds);
      setOriginalSelectedIds(defaultIds);
    }

    // Cấu hình tab menu
    try {
      const menuIds = await loadMenuTabIds();
      setMenuSelectedIds(menuIds);
      setMenuOriginalIds(menuIds);
    } catch (error) {
      console.log('[AllManagement] Load menu tabs error:', error instanceof Error ? error.message : String(error));
      setMenuSelectedIds(DEFAULT_MENU_TAB_IDS);
      setMenuOriginalIds(DEFAULT_MENU_TAB_IDS);
    }
  };

  // Danh sách đang cấu hình theo tab hiện tại
  const activeSelectedIds = activeTab === 'home' ? selectedIds : menuSelectedIds;

  // Tab menu chỉ cho chọn các mục có màn hình tương ứng
  const selectableFeatures =
    activeTab === 'menu'
      ? features.filter(f => MENU_TAB_FEATURE_IDS.includes(f.id))
      : features;

  const handleTabSwitch = (tab: ConfigTab) => {
    if (tab === activeTab) return;
    // Huỷ các thay đổi chưa lưu khi chuyển tab
    setSelectedIds(originalSelectedIds);
    setMenuSelectedIds(menuOriginalIds);
    setIsEditMode(false);
    setActiveTab(tab);
  };

  const handleEditPress = () => {
    if (isEditMode) {
      setSelectedIds(originalSelectedIds);
      setMenuSelectedIds(menuOriginalIds);
    }
    setIsEditMode(!isEditMode);
  };

  const handleSavePress = async () => {
    try {
      if (activeTab === 'home') {
        const config = { selectedIds };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        setOriginalSelectedIds(selectedIds);
        console.log('[AllManagement] Home configuration saved', { selectedIds });
      } else {
        await saveMenuTabIds(menuSelectedIds);
        setMenuOriginalIds(menuSelectedIds);
        console.log('[AllManagement] Menu tabs configuration saved', { menuSelectedIds });
      }
      setIsEditMode(false);
      if (Platform.OS === 'web') {
        alert('Đã lưu cấu hình thành công!');
      } else {
        Alert.alert('Thành công', 'Đã lưu cấu hình thành công!');
      }
    } catch (error) {
      console.log('[AllManagement] Save config error:', error instanceof Error ? error.message : String(error));
      if (Platform.OS === 'web') {
        alert('Lỗi khi lưu cấu hình');
      } else {
        Alert.alert('Lỗi', 'Không thể lưu cấu hình');
      }
    }
  };

  const handleFeatureToggle = (featureId: string) => {
    if (!isEditMode) return;

    if (activeTab === 'home') {
      const isSelected = selectedIds.includes(featureId);
      if (isSelected) {
        setSelectedIds(selectedIds.filter(id => id !== featureId));
      } else {
        if (selectedIds.length >= MAX_HOME_FEATURES) {
          if (Platform.OS === 'web') {
            alert(`Bạn chỉ có thể chọn tối đa ${MAX_HOME_FEATURES} mục`);
          } else {
            Alert.alert('Giới hạn', `Bạn chỉ có thể chọn tối đa ${MAX_HOME_FEATURES} mục`);
          }
          return;
        }
        setSelectedIds([...selectedIds, featureId]);
      }
    } else {
      const isSelected = menuSelectedIds.includes(featureId);
      if (isSelected) {
        if (menuSelectedIds.length <= 1) {
          if (Platform.OS === 'web') {
            alert('Cần chọn ít nhất 1 mục cho tab menu');
          } else {
            Alert.alert('Giới hạn', 'Cần chọn ít nhất 1 mục cho tab menu');
          }
          return;
        }
        setMenuSelectedIds(menuSelectedIds.filter(id => id !== featureId));
      } else {
        if (menuSelectedIds.length >= MAX_MENU_TABS) {
          if (Platform.OS === 'web') {
            alert(`Bạn chỉ có thể chọn tối đa ${MAX_MENU_TABS} mục cho tab menu`);
          } else {
            Alert.alert('Giới hạn', `Bạn chỉ có thể chọn tối đa ${MAX_MENU_TABS} mục cho tab menu`);
          }
          return;
        }
        setMenuSelectedIds([...menuSelectedIds, featureId]);
      }
    }
  };

  const handleMoveUp = (featureId: string) => {
    if (!isEditMode) return;
    const list = activeSelectedIds;
    const setter = activeTab === 'home' ? setSelectedIds : setMenuSelectedIds;
    const currentIndex = list.indexOf(featureId);
    if (currentIndex <= 0) return;

    const newOrder = [...list];
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    setter(newOrder);
  };

  const handleMoveDown = (featureId: string) => {
    if (!isEditMode) return;
    const list = activeSelectedIds;
    const setter = activeTab === 'home' ? setSelectedIds : setMenuSelectedIds;
    const currentIndex = list.indexOf(featureId);
    if (currentIndex >= list.length - 1) return;

    const newOrder = [...list];
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
    setter(newOrder);
  };

  const handleFeaturePress = (featureId: string) => {
    if (isEditMode) {
      handleFeatureToggle(featureId);
      return;
    }

    console.log('[AllManagement] Feature pressed', { featureId });

    if (featureId === '1') {
      router.push('/projects');
    } else if (featureId === '2') {
      router.push('/products');
    } else if (featureId === '3') {
      router.push('/appointments');
    } else if (featureId === '4') {
      router.push('/locked-units');
    } else if (featureId === '5') {
      router.push('/bookings');
    } else if (featureId === '6') {
      router.push('/customers');
    } else if (featureId === '7') {
      console.log('[AllManagement] Hoa hồng - route not implemented');
    } else if (featureId === '8') {
      console.log('[AllManagement] Navigating to contracts');
      router.push('/contracts');
    } else if (featureId === '9') {
      console.log('[AllManagement] Navigating to reports');
      router.push('/reports');
    } else if (featureId === '13') {
      console.log('[AllManagement] Navigating to deposits');
      router.push('/deposits');
    } else {
      console.log('[AllManagement] No route defined for feature', { featureId });
    }
  };

  const editModeHintText =
    activeTab === 'home'
      ? `Chọn ${selectedIds.length}/${MAX_HOME_FEATURES} mục hiển thị trên trang chủ`
      : `Chọn ${menuSelectedIds.length}/${MAX_MENU_TABS} mục hiển thị trên thanh tab (giữa Home và Tài khoản)`;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tất cả quản lý',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={isEditMode ? handleSavePress : handleEditPress}
              style={styles.headerButton}
            >
              <Text style={[styles.headerButtonText, isEditMode && styles.headerButtonTextSave]}>
                {isEditMode ? 'Lưu' : 'Chỉnh sửa'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented control: Trang chủ | Cấu hình menu */}
        <View style={styles.tabSwitchContainer}>
          <TouchableOpacity
            style={[styles.tabSwitchButton, activeTab === 'home' && styles.tabSwitchButtonActive]}
            onPress={() => handleTabSwitch('home')}
            activeOpacity={0.8}
          >
            <House
              color={activeTab === 'home' ? Colors.white : Colors.textSecondary}
              size={16}
              strokeWidth={2.5}
            />
            <Text style={[styles.tabSwitchText, activeTab === 'home' && styles.tabSwitchTextActive]}>
              Trang chủ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabSwitchButton, activeTab === 'menu' && styles.tabSwitchButtonActive]}
            onPress={() => handleTabSwitch('menu')}
            activeOpacity={0.8}
          >
            <LayoutGrid
              color={activeTab === 'menu' ? Colors.white : Colors.textSecondary}
              size={16}
              strokeWidth={2.5}
            />
            <Text style={[styles.tabSwitchText, activeTab === 'menu' && styles.tabSwitchTextActive]}>
              Cấu hình menu
            </Text>
          </TouchableOpacity>
        </View>

        {isEditMode && (
          <View style={styles.editModeHeader}>
            <View style={styles.editModeHeaderContent}>
              <Settings color={Colors.primary} size={20} />
              <View style={styles.editModeTextContainer}>
                <Text style={styles.editModeText}>{editModeHintText}</Text>
                <Text style={styles.editModeSubText}>
                  Sử dụng nút mũi tên để thay đổi thứ tự hiển thị
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {activeTab === 'home' ? 'Các mục đã chọn' : 'Tab menu hiển thị'} ({activeSelectedIds.length})
        </Text>
        <View style={styles.selectedItemsContainer}>
          {activeSelectedIds.map((id, index) => {
            const feature = features.find(f => f.id === id);
            if (!feature) return null;

            return (
              <View key={feature.id} style={styles.selectedItemRow}>
                <View style={styles.selectedItemLeft}>
                  <View style={styles.orderNumberBadge}>
                    <Text style={styles.orderNumberText}>{index + 1}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.selectedItemContent}
                    activeOpacity={0.7}
                    onPress={() => isEditMode ? handleFeatureToggle(feature.id) : handleFeaturePress(feature.id)}
                  >
                    <View
                      style={[
                        styles.selectedIconContainer,
                        { backgroundColor: feature.backgroundColor },
                      ]}
                    >
                      <feature.icon color={feature.iconColor} size={24} />
                    </View>
                    <Text style={styles.selectedItemTitle}>{feature.title}</Text>
                  </TouchableOpacity>
                </View>
                {isEditMode && (
                  <View style={styles.moveButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.moveButton,
                        index === 0 && styles.moveButtonDisabled,
                      ]}
                      onPress={() => handleMoveUp(feature.id)}
                      disabled={index === 0}
                    >
                      <ChevronUp
                        color={index === 0 ? Colors.textLight : Colors.primary}
                        size={22}
                        strokeWidth={2.5}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.moveButton,
                        index === activeSelectedIds.length - 1 && styles.moveButtonDisabled,
                      ]}
                      onPress={() => handleMoveDown(feature.id)}
                      disabled={index === activeSelectedIds.length - 1}
                    >
                      <ChevronDown
                        color={index === activeSelectedIds.length - 1 ? Colors.textLight : Colors.primary}
                        size={22}
                        strokeWidth={2.5}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Tất cả các mục</Text>
        <View style={styles.featuresGrid}>
          {selectableFeatures.map((feature) => {
            const isSelected = activeSelectedIds.includes(feature.id);
            if (isSelected) return null;
            return (
              <TouchableOpacity
                key={feature.id}
                style={styles.featureCard}
                activeOpacity={0.7}
                onPress={() => handleFeaturePress(feature.id)}
              >
                <View
                  style={[
                    styles.featureIconContainer,
                    { backgroundColor: feature.backgroundColor },
                  ]}
                >
                  <feature.icon color={feature.iconColor} size={28} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
              </TouchableOpacity>
            );
          })}
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  tabSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabSwitchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabSwitchButtonActive: {
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tabSwitchText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabSwitchTextActive: {
    color: Colors.white,
  },
  // Grid 4 mục trên 1 hàng — gọn gàng
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: (width - 40 - 30) / 4,
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
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
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  headerButtonTextSave: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  editModeHeader: {
    backgroundColor: '#FFF4ED',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE5D3',
  },
  editModeHeaderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  editModeTextContainer: {
    flex: 1,
    gap: 4,
  },
  editModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  editModeSubText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  featureCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  checkmarkContainer: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(232, 111, 37, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  featureCardDragging: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  selectedItemsContainer: {
    gap: 10,
    marginBottom: 32,
  },
  // Card hiện đại: nền trắng, bo tròn lớn, đổ bóng mềm — không viền
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
      },
    }),
  },
  selectedItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(232, 111, 37, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderNumberText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  selectedItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedItemTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  moveButtonsContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  moveButton: {
    width: 34,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 111, 37, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
});