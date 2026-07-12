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
import { Settings, ChevronUp, ChevronDown } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const STORAGE_KEY = '@home_features_config';
const MAX_HOME_FEATURES = 6;

export default function AllManagementScreen() {
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [originalSelectedIds, setOriginalSelectedIds] = useState<string[]>([]);

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
  };

  const handleEditPress = () => {
    if (isEditMode) {
      setSelectedIds(originalSelectedIds);
    }
    setIsEditMode(!isEditMode);
  };

  const handleSavePress = async () => {
    try {
      const config = { selectedIds };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setOriginalSelectedIds(selectedIds);
      setIsEditMode(false);
      console.log('[AllManagement] Configuration saved', { selectedIds });
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
  };

  const handleMoveUp = (featureId: string) => {
    if (!isEditMode) return;
    const currentIndex = selectedIds.indexOf(featureId);
    if (currentIndex <= 0) return;
    
    const newOrder = [...selectedIds];
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    setSelectedIds(newOrder);
  };

  const handleMoveDown = (featureId: string) => {
    if (!isEditMode) return;
    const currentIndex = selectedIds.indexOf(featureId);
    if (currentIndex >= selectedIds.length - 1) return;
    
    const newOrder = [...selectedIds];
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
    setSelectedIds(newOrder);
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
        {isEditMode && (
          <View style={styles.editModeHeader}>
            <View style={styles.editModeHeaderContent}>
              <Settings color={Colors.primary} size={20} />
              <View style={styles.editModeTextContainer}>
                <Text style={styles.editModeText}>
                  Chọn {selectedIds.length}/{MAX_HOME_FEATURES} mục hiển thị trên trang chủ
                </Text>
                <Text style={styles.editModeSubText}>
                  Sử dụng nút mũi tên để thay đổi thứ tự hiển thị
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Các mục đã chọn ({selectedIds.length})</Text>
        <View style={styles.selectedItemsContainer}>
          {selectedIds.map((id, index) => {
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
                        index === selectedIds.length - 1 && styles.moveButtonDisabled,
                      ]}
                      onPress={() => handleMoveDown(feature.id)}
                      disabled={index === selectedIds.length - 1}
                    >
                      <ChevronDown 
                        color={index === selectedIds.length - 1 ? Colors.textLight : Colors.primary} 
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
          {features.map((feature) => {
            const isSelected = selectedIds.includes(feature.id);
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
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureCard: {
    width: (width - 40 - 32) / 3,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
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
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 13,
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
    gap: 12,
    marginBottom: 32,
  },
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  selectedItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
    gap: 4,
  },
  moveButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 111, 37, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButtonDisabled: {
    backgroundColor: Colors.background,
  },
});
