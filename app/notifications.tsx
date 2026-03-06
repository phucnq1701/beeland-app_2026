import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Bell, Package, FolderOpen, Settings as SettingsIcon, MessageCircle, ChevronDown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { notifications as initialNotifications, Notification } from '@/mocks/notifications';

type FilterType = 'all' | Notification['type'];

interface FilterOption {
  key: FilterType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'Tất cả', icon: <Bell color={Colors.textSecondary} size={18} />, color: Colors.textSecondary, bg: '#F3F4F6' },
  { key: 'project', label: 'Dự án', icon: <FolderOpen color={Colors.primary} size={18} />, color: Colors.primary, bg: '#FFF4ED' },
  { key: 'product', label: 'Sản phẩm', icon: <Package color="#10B981" size={18} />, color: '#10B981', bg: '#ECFDF5' },
  { key: 'message', label: 'Tin nhắn', icon: <MessageCircle color="#3B82F6" size={18} />, color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'system', label: 'Hệ thống', icon: <SettingsIcon color="#6366F1" size={18} />, color: '#6366F1', bg: '#EEF2FF' },
];

export default function NotificationsScreen() {
  const { showUnreadOnly } = useLocalSearchParams<{ showUnreadOnly?: string }>();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredByType = activeFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === activeFilter);

  const displayedNotifications = showUnreadOnly === 'true'
    ? filteredByType.filter((n) => !n.isRead)
    : filteredByType;

  const activeOption = FILTER_OPTIONS.find((o) => o.key === activeFilter) ?? FILTER_OPTIONS[0];
  const filteredCount = displayedNotifications.length;

  const toggleDropdown = () => {
    if (showDropdown) {
      Animated.timing(dropdownAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowDropdown(false));
    } else {
      setShowDropdown(true);
      Animated.spring(dropdownAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  };

  const selectFilter = (key: FilterType) => {
    setActiveFilter(key);
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setShowDropdown(false));
  };

  const handleNotificationPress = (notification: Notification) => {
    console.log('[Notifications] Notification pressed', { id: notification.id });
    
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, isRead: true } : n
      )
    );
  };

  const handleMarkAllAsRead = () => {
    console.log('[Notifications] Mark all as read');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const getIconByType = (type: Notification['type']) => {
    switch (type) {
      case 'project':
        return <FolderOpen color={Colors.primary} size={20} />;
      case 'product':
        return <Package color="#10B981" size={20} />;
      case 'message':
        return <MessageCircle color="#3B82F6" size={20} />;
      case 'system':
        return <SettingsIcon color="#6366F1" size={20} />;
      default:
        return <Bell color={Colors.textSecondary} size={20} />;
    }
  };

  const getIconBgByType = (type: Notification['type']) => {
    switch (type) {
      case 'project':
        return '#FFF4ED';
      case 'product':
        return '#ECFDF5';
      case 'message':
        return '#EFF6FF';
      case 'system':
        return '#EEF2FF';
      default:
        return Colors.background;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Thông báo',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Đánh dấu tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter !== 'all' && { borderColor: activeOption.color, backgroundColor: activeOption.bg },
          ]}
          activeOpacity={0.7}
          onPress={toggleDropdown}
        >
          {activeOption.icon}
          <Text
            style={[
              styles.filterButtonText,
              activeFilter !== 'all' && { color: activeOption.color, fontWeight: '600' as const },
            ]}
          >
            {activeOption.label}
          </Text>
          <ChevronDown
            color={activeFilter !== 'all' ? activeOption.color : Colors.textSecondary}
            size={16}
          />
        </TouchableOpacity>
        <Text style={styles.filterCount}>{filteredCount} thông báo</Text>
      </View>

      {showDropdown && (
        <>
          <Pressable style={styles.dropdownOverlay} onPress={toggleDropdown} />
          <Animated.View
            style={[
              styles.dropdownContainer,
              {
                opacity: dropdownAnim,
                transform: [
                  {
                    translateY: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {FILTER_OPTIONS.map((option, index) => {
              const isActive = activeFilter === option.key;
              const count = option.key === 'all'
                ? notifications.length
                : notifications.filter((n) => n.type === option.key).length;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.dropdownItem,
                    isActive && { backgroundColor: option.bg },
                    index < FILTER_OPTIONS.length - 1 && styles.dropdownItemBorder,
                  ]}
                  activeOpacity={0.6}
                  onPress={() => selectFilter(option.key)}
                >
                  <View style={[styles.dropdownItemIcon, { backgroundColor: option.bg }]}>
                    {option.icon}
                  </View>
                  <View style={styles.dropdownItemContent}>
                    <Text
                      style={[
                        styles.dropdownItemLabel,
                        isActive && { color: option.color, fontWeight: '700' as const },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.dropdownItemCount}>{count}</Text>
                  </View>
                  {isActive && <Check color={option.color} size={18} />}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {displayedNotifications.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            style={[
              styles.notificationCard,
              !notification.isRead && styles.notificationCardUnread,
            ]}
            activeOpacity={0.7}
            onPress={() => handleNotificationPress(notification)}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: getIconBgByType(notification.type) },
              ]}
            >
              {getIconByType(notification.type)}
            </View>

            <View style={styles.notificationContent}>
              <View style={styles.notificationHeader}>
                <Text
                  style={[
                    styles.notificationTitle,
                    !notification.isRead && styles.notificationTitleUnread,
                  ]}
                  numberOfLines={1}
                >
                  {notification.title}
                </Text>
                {!notification.isRead && <View style={styles.unreadBadge} />}
              </View>
              <Text style={styles.notificationDescription} numberOfLines={2}>
                {notification.description}
              </Text>
              <Text style={styles.notificationTime}>{notification.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F9FAFB',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterCount: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500' as const,
  },
  dropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  dropdownContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 152 : 148,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dropdownItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  dropdownItemCount: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '500' as const,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 16,
    gap: 16,
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
  notificationCardUnread: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 6,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  notificationTitleUnread: {
    fontWeight: '700' as const,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notificationDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
