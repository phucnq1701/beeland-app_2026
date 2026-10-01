import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FeatureGrid } from '@/components/home/FeatureGrid';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import {
  AppHeader,
  BottomActionBar,
  Button,
  IconButton,
  ListItem,
  Screen,
  SegmentedControl,
  Text,
  useToast,
} from '@/components/ui';
import { getScopedKey } from '@/components/utils/accountScope';
import {
  loadMenuTabIds,
  saveMenuTabIds,
  MAX_MENU_TABS,
  MENU_TAB_FEATURE_IDS,
  DEFAULT_MENU_TAB_IDS,
} from '@/components/utils/menuTabs';
import {
  moveItem,
  resolveHomeFeatureIds,
  routeForFeature,
  toggleSelection,
  visibleFeatureIds,
} from '@/lib/featureConfig';
import { features } from '@/mocks/features';
import { colors, elevation, radius, space } from '@/theme';

const STORAGE_KEY = '@home_features_config';
const MAX_HOME_FEATURES = 6;
const ALL_IDS = features.map((f) => f.id);

type ConfigTab = 'home' | 'menu';

export default function AllManagementScreen() {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ConfigTab>('home');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Cấu hình các mục trên trang chủ (tối đa 6)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [originalSelectedIds, setOriginalSelectedIds] = useState<string[]>([]);

  // Cấu hình 2 tab menu ở giữa tab bar (mặc định: 2 mục đầu tiên)
  const [menuSelectedIds, setMenuSelectedIds] = useState<string[]>(DEFAULT_MENU_TAB_IDS);
  const [menuOriginalIds, setMenuOriginalIds] = useState<string[]>(DEFAULT_MENU_TAB_IDS);

  const [isAgency, setIsAgency] = useState<boolean>(false);

  const loadConfiguration = async () => {
    // Không đọc được loại tài khoản → null (coi như đại lý cho an toàn)
    let agency: boolean | null = null;
    try {
      agency = (await AsyncStorage.getItem('@type_account')) === 'AGENCY';
    } catch (error) {
      console.log('[AllManagement] Read account type error:', error instanceof Error ? error.message : String(error));
    }
    setIsAgency(agency !== false);
    let stored: unknown = undefined;
    try {
      const raw = await AsyncStorage.getItem(await getScopedKey(STORAGE_KEY));
      stored = raw ? JSON.parse(raw) : undefined;
    } catch (error) {
      console.log('[AllManagement] Load config error:', error instanceof Error ? error.message : String(error));
      stored = null;
    }
    const ids = resolveHomeFeatureIds({
      stored,
      isAgency: agency,
      allIds: ALL_IDS,
      menuEligible: MENU_TAB_FEATURE_IDS,
      max: MAX_HOME_FEATURES,
    });
    setSelectedIds(ids);
    setOriginalSelectedIds(ids);

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

  useEffect(() => {
    loadConfiguration();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConfiguration();
    }, [])
  );

  // Các mục được phép theo tab đang cấu hình (đại lý, tab menu, ẩn mục chưa có màn)
  const selectableIds = visibleFeatureIds(ALL_IDS, {
    isAgency,
    menuOnly: activeTab === 'menu',
    menuEligible: MENU_TAB_FEATURE_IDS,
  });
  const activeSelectedIds = (activeTab === 'home' ? selectedIds : menuSelectedIds).filter((id) =>
    selectableIds.includes(id)
  );
  const setActiveSelected = activeTab === 'home' ? setSelectedIds : setMenuSelectedIds;

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
    if (saving) return;
    setSaving(true);
    try {
      if (activeTab === 'home') {
        const config = { selectedIds };
        await AsyncStorage.setItem(await getScopedKey(STORAGE_KEY), JSON.stringify(config));
        setOriginalSelectedIds(selectedIds);
      } else {
        await saveMenuTabIds(menuSelectedIds);
        setMenuOriginalIds(menuSelectedIds);
      }
      setIsEditMode(false);
      toast.show({ type: 'success', message: 'Đã lưu cấu hình' });
    } catch (error) {
      console.log('[AllManagement] Save config error:', error instanceof Error ? error.message : String(error));
      toast.show({ type: 'error', message: 'Không thể lưu cấu hình' });
    } finally {
      setSaving(false);
    }
  };

  const handleFeatureToggle = (featureId: string) => {
    if (!isEditMode) return;
    const result =
      activeTab === 'home'
        ? toggleSelection(selectedIds, featureId, {
            min: 0,
            max: MAX_HOME_FEATURES,
            tooManyMessage: `Bạn chỉ có thể chọn tối đa ${MAX_HOME_FEATURES} mục`,
            tooFewMessage: '',
          })
        : toggleSelection(menuSelectedIds, featureId, {
            min: 1,
            max: MAX_MENU_TABS,
            tooManyMessage: `Bạn chỉ có thể chọn tối đa ${MAX_MENU_TABS} mục cho tab menu`,
            tooFewMessage: 'Cần chọn ít nhất 1 mục cho tab menu',
          });
    if (result.error) {
      toast.show({ type: 'info', message: result.error });
      return;
    }
    setActiveSelected(result.next);
  };

  const handleMove = (featureId: string, dir: -1 | 1) => {
    if (!isEditMode) return;
    setActiveSelected(moveItem(activeSelectedIds, featureId, dir));
  };

  const handleFeaturePress = (featureId: string) => {
    if (isEditMode) {
      handleFeatureToggle(featureId);
      return;
    }
    const route = routeForFeature(featureId);
    if (route) router.push(route as never);
  };

  const editModeHintText =
    activeTab === 'home'
      ? `Chọn ${selectedIds.length}/${MAX_HOME_FEATURES} mục hiển thị trên trang chủ`
      : `Chọn ${menuSelectedIds.length}/${MAX_MENU_TABS} mục hiển thị trên thanh tab (giữa Trang chủ và Tài khoản)`;

  const unselected = features.filter((f) => selectableIds.includes(f.id) && !activeSelectedIds.includes(f.id));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={
          <AppHeader
            variant="soft"
            title="Tất cả quản lý"
            actions={
              isEditMode ? null : (
                <Button variant="ghost" title="Sửa" onPress={handleEditPress} style={styles.pill} />
              )
            }
          />
        }
        footer={
          isEditMode ? (
            <BottomActionBar>
              <Button variant="secondary" title="Huỷ" onPress={handleEditPress} style={styles.pill} />
              <Button title="Lưu cấu hình" loading={saving} onPress={handleSavePress} style={[styles.flex, styles.pill]} />
            </BottomActionBar>
          ) : null
        }
        padded={false}
      >
        <View style={styles.body}>
          <SegmentedControl
            variant="soft"
            value={activeTab}
            onChange={handleTabSwitch}
            options={[
              { value: 'home', label: 'Trang chủ' },
              { value: 'menu', label: 'Tab menu' },
            ]}
          />

          {isEditMode ? (
            <View style={styles.hint}>
              <Settings2 size={18} color={colors.onPrimarySubtle} />
              <View style={styles.flex}>
                <Text variant="caption" weight="semibold" color="onPrimarySubtle">
                  {editModeHintText}
                </Text>
                <Text variant="caption" color="onPrimarySubtle">
                  Chạm để chọn/bỏ chọn, dùng mũi tên để đổi thứ tự.
                </Text>
              </View>
            </View>
          ) : null}

          <HomeSectionHeader
            title={`${activeTab === 'home' ? 'Các mục đã chọn' : 'Tab menu hiển thị'} (${activeSelectedIds.length})`}
          />
          {/* Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng) */}
          <View style={styles.card}>
            <View style={styles.clip}>
              {activeSelectedIds.length === 0 ? (
                <Text variant="caption" color="textSecondary" style={styles.empty}>
                  Chưa chọn mục nào.
                </Text>
              ) : null}
              {activeSelectedIds.map((id, index) => {
                const feature = features.find((f) => f.id === id);
                if (!feature) return null;
                const Icon = feature.icon;
                return (
                  <View key={id} style={index > 0 ? styles.divider : null}>
                    <ListItem
                      leading={
                        <View style={styles.rowIcon}>
                          <Icon size={20} color={colors.brand} strokeWidth={2} />
                        </View>
                      }
                      title={`${index + 1}. ${feature.title}`}
                      subtitle={isEditMode ? 'Chạm để bỏ chọn' : undefined}
                      chevron={!isEditMode}
                      onPress={() => handleFeaturePress(id)}
                      trailing={
                        isEditMode ? (
                          <View style={styles.moves}>
                            <IconButton
                              icon={ChevronUp}
                              accessibilityLabel={`Đưa ${feature.title} lên trên`}
                              disabled={index === 0}
                              onPress={() => handleMove(id, -1)}
                            />
                            <IconButton
                              icon={ChevronDown}
                              accessibilityLabel={`Đưa ${feature.title} xuống dưới`}
                              disabled={index === activeSelectedIds.length - 1}
                              onPress={() => handleMove(id, 1)}
                            />
                          </View>
                        ) : undefined
                      }
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {unselected.length > 0 ? (
            <>
              <HomeSectionHeader title="Tất cả các mục" />
              <FeatureGrid
                columns={4}
                compact
                items={unselected.map((f) => ({
                  key: f.id,
                  feature: f,
                  editing: isEditMode,
                  onPress: () => handleFeaturePress(f.id),
                }))}
              />
            </>
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  pill: { borderRadius: radius.full },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: 'hidden' },
  hint: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md + 2,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySubtle,
  },
  empty: { padding: space.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySubtle,
  },
  moves: { flexDirection: 'row' },
});
