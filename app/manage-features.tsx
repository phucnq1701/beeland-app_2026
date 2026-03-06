import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, GripVertical, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { features, Feature } from '@/mocks/features';

const STORAGE_KEY = '@home_features_config';
const MAX_HOME_FEATURES = 6;

export default function ManageFeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        setSelectedFeatures(config.selectedIds || features.slice(0, MAX_HOME_FEATURES).map(f => f.id));
      } else {
        setSelectedFeatures(features.slice(0, MAX_HOME_FEATURES).map(f => f.id));
      }
    } catch (error) {
      console.log('[ManageFeatures] Load config error:', error instanceof Error ? error.message : String(error));
      setSelectedFeatures(features.slice(0, MAX_HOME_FEATURES).map(f => f.id));
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev => {
      const isSelected = prev.includes(featureId);
      
      if (isSelected) {
        if (prev.length === 1) {
          if (Platform.OS === 'web') {
            alert('Phải có ít nhất 1 mục hiển thị trên trang chủ');
          } else {
            Alert.alert('Thông báo', 'Phải có ít nhất 1 mục hiển thị trên trang chủ');
          }
          return prev;
        }
        return prev.filter(id => id !== featureId);
      } else {
        if (prev.length >= MAX_HOME_FEATURES) {
          if (Platform.OS === 'web') {
            alert(`Chỉ được chọn tối đa ${MAX_HOME_FEATURES} mục`);
          } else {
            Alert.alert('Thông báo', `Chỉ được chọn tối đa ${MAX_HOME_FEATURES} mục`);
          }
          return prev;
        }
        return [...prev, featureId];
      }
    });
  };

  const moveFeature = (featureId: string, direction: 'up' | 'down') => {
    setSelectedFeatures(prev => {
      const index = prev.indexOf(featureId);
      if (index === -1) return prev;
      
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;
      
      const newArray = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [newArray[index], newArray[newIndex]] = [newArray[newIndex], newArray[index]];
      
      return newArray;
    });
  };

  const saveConfiguration = async () => {
    try {
      const config = {
        selectedIds: selectedFeatures,
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      
      if (Platform.OS === 'web') {
        alert('Đã lưu cấu hình');
      } else {
        Alert.alert('Thành công', 'Đã lưu cấu hình');
      }
      setIsEditMode(false);
    } catch (error) {
      console.log('[ManageFeatures] Save error:', error instanceof Error ? error.message : String(error));
      if (Platform.OS === 'web') {
        alert('Lỗi khi lưu cấu hình');
      } else {
        Alert.alert('Lỗi', 'Không thể lưu cấu hình');
      }
    }
  };

  const handleFeaturePress = (featureId: string) => {
    if (isEditMode) return;
    
    console.log('[ManageFeatures] Feature pressed', { featureId });
    if (featureId === '1') {
      router.push('/projects');
    } else if (featureId === '2') {
      router.push('/products');
    } else if (featureId === '4') {
      router.push('/locked-units');
    } else if (featureId === '5') {
      router.push('/bookings');
    } else if (featureId === '6') {
      router.push('/customers');
    } else if (featureId === '11') {
      router.push('/handovers');
    }
  };

  const selectedFeaturesData = selectedFeatures
    .map(id => features.find(f => f.id === id))
    .filter(Boolean) as Feature[];

  const unselectedFeaturesData = features.filter(
    f => !selectedFeatures.includes(f.id)
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Quản lý hiển thị',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <ChevronLeft color={Colors.text} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Quản lý hiển thị',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft color={Colors.text} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={isEditMode ? saveConfiguration : () => setIsEditMode(true)}>
              <Text style={styles.saveButton}>{isEditMode ? 'Lưu' : 'Chỉnh sửa'}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {isEditMode && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Chọn tối đa {MAX_HOME_FEATURES} mục để hiển thị trên trang chủ.
            </Text>
            <Text style={styles.infoSubtext}>
              Đã chọn: {selectedFeatures.length}/{MAX_HOME_FEATURES}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isEditMode ? `Đang hiển thị (${selectedFeatures.length})` : 'Tất cả chức năng'}
          </Text>
          {isEditMode && (
            <Text style={styles.sectionSubtitle}>Kéo để sắp xếp thứ tự</Text>
          )}

          {selectedFeaturesData.map((feature, index) => (
            <TouchableOpacity
              key={feature.id}
              style={styles.featureItem}
              onPress={() => handleFeaturePress(feature.id)}
              activeOpacity={isEditMode ? 1 : 0.7}
              disabled={isEditMode}
            >
              <View style={styles.featureLeft}>
                {isEditMode && (
                  <View style={styles.dragHandle}>
                    <GripVertical color={Colors.textSecondary} size={20} />
                  </View>
                )}
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: feature.backgroundColor },
                  ]}
                >
                  <feature.icon color={feature.iconColor} size={24} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
              </View>

              {isEditMode && (
                <View style={styles.featureRight}>
                  <View style={styles.orderButtons}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.orderButton}
                        onPress={() => moveFeature(feature.id, 'up')}
                      >
                        <Text style={styles.orderButtonText}>↑</Text>
                      </TouchableOpacity>
                    )}
                    {index < selectedFeaturesData.length - 1 && (
                      <TouchableOpacity
                        style={styles.orderButton}
                        onPress={() => moveFeature(feature.id, 'down')}
                      >
                        <Text style={styles.orderButtonText}>↓</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.checkButton}
                    onPress={() => toggleFeature(feature.id)}
                  >
                    <Check color={Colors.primary} size={20} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {isEditMode && unselectedFeaturesData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chưa hiển thị ({unselectedFeaturesData.length})</Text>
            <Text style={styles.sectionSubtitle}>Nhấn để thêm vào trang chủ</Text>

            {unselectedFeaturesData.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={styles.featureItem}
                onPress={() => toggleFeature(feature.id)}
              >
                <View style={styles.featureLeft}>
                  <View
                    style={[
                      styles.featureIcon,
                      { backgroundColor: feature.backgroundColor },
                    ]}
                  >
                    <feature.icon color={feature.iconColor} size={24} />
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                </View>

                <View style={styles.uncheckButton} />
              </TouchableOpacity>
            ))}
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: '500' as const,
  },
  infoSubtext: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  featureItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  featureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  dragHandle: {
    padding: 4,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  featureRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderButtons: {
    flexDirection: 'column',
    gap: 4,
  },
  orderButton: {
    width: 32,
    height: 24,
    backgroundColor: Colors.background,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  checkButton: {
    width: 32,
    height: 32,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
  },
});
