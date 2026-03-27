import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ChatMember } from '@/mocks/chatGroups';

const availableUsers: ChatMember[] = [
  { id: 'user-2', name: 'Trần Thị B', role: 'member' },
  { id: 'user-3', name: 'Lê Văn C', role: 'member' },
  { id: 'user-4', name: 'Phạm Thị D', role: 'member' },
  { id: 'user-5', name: 'Hoàng Văn E', role: 'member' },
  { id: 'user-6', name: 'Đỗ Thị F', role: 'member' },
  { id: 'user-7', name: 'Võ Văn G', role: 'member' },
  { id: 'user-8', name: 'Mai Thị H', role: 'member' },
];

export default function CreateGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = availableUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một thành viên');
      return;
    }

    Alert.alert(
      'Thành công',
      `Đã tạo nhóm "${groupName}" với ${selectedMembers.length} thành viên`,
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const renderUserItem = ({ item }: { item: ChatMember }) => {
    const isSelected = selectedMembers.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleMember(item.id)}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{item.name}</Text>
        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
          ]}
        >
          {isSelected && <Check color={Colors.white} size={18} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
        <TouchableOpacity
          style={[
            styles.createButton,
            (!groupName.trim() || selectedMembers.length === 0) &&
              styles.createButtonDisabled,
          ]}
          onPress={handleCreateGroup}
          disabled={!groupName.trim() || selectedMembers.length === 0}
        >
          <Text
            style={[
              styles.createButtonText,
              (!groupName.trim() || selectedMembers.length === 0) &&
                styles.createButtonTextDisabled,
            ]}
          >
            Tạo
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.groupInfoSection}>
          <View style={styles.groupIconContainer}>
            <Users color={Colors.primary} size={32} />
          </View>
          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Nhập tên nhóm..."
            placeholderTextColor={Colors.textLight}
            maxLength={50}
          />
        </View>

        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>
            Chọn thành viên ({selectedMembers.length} đã chọn)
          </Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm thành viên..."
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Không tìm thấy thành viên</Text>
              </View>
            }
          />
        </View>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  createButtonTextDisabled: {
    color: Colors.textLight,
  },
  content: {
    flex: 1,
  },
  groupInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 20,
    gap: 16,
    marginBottom: 8,
  },
  groupIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF4ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupNameInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  membersSection: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 80,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  searchInput: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textLight,
  },
});
