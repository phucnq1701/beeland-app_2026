import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  UserPlus,
  UserX,
  Shield,
  User,
  Check,
  X as XIcon,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { chatGroups, ChatMember, currentUserId } from '@/mocks/chatGroups';
import { contacts } from '@/mocks/contacts';

export default function ManageGroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const group = chatGroups.find((g) => g.id === groupId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddMember, setShowAddMember] = useState<boolean>(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  if (!group) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text>Không tìm thấy nhóm</Text>
      </View>
    );
  }

  const isAdmin = group.members.find(
    (m) => m.id === currentUserId && m.role === 'admin'
  );

  const availableContacts = contacts.filter(
    (contact) => !group.members.some((member) => member.id === contact.id)
  );

  const filteredMembers = group.members.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = availableContacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!isAdmin) {
      Alert.alert('Thông báo', 'Chỉ quản trị viên mới có thể xóa thành viên');
      return;
    }

    if (memberId === currentUserId) {
      Alert.alert('Thông báo', 'Bạn không thể xóa chính mình khỏi nhóm');
      return;
    }

    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn xóa "${memberName}" khỏi nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Thành công', `Đã xóa ${memberName} khỏi nhóm`);
          },
        },
      ]
    );
  };

  const handleToggleAdmin = (memberId: string, memberName: string, isCurrentlyAdmin: boolean) => {
    if (!isAdmin) {
      Alert.alert('Thông báo', 'Chỉ quản trị viên mới có thể thay đổi quyền');
      return;
    }

    const action = isCurrentlyAdmin ? 'gỡ quyền quản trị viên' : 'cấp quyền quản trị viên';
    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn ${action} cho "${memberName}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () => {
            Alert.alert('Thành công', `Đã ${action} cho ${memberName}`);
          },
        },
      ]
    );
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleAddMembers = () => {
    if (selectedContacts.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một thành viên');
      return;
    }

    Alert.alert(
      'Thành công',
      `Đã thêm ${selectedContacts.length} thành viên vào nhóm`,
      [
        {
          text: 'OK',
          onPress: () => {
            setSelectedContacts([]);
            setShowAddMember(false);
          },
        },
      ]
    );
  };

  const renderMemberItem = ({ item }: { item: ChatMember }) => {
    const isCurrentUser = item.id === currentUserId;
    const isMemberAdmin = item.role === 'admin';

    return (
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>
              {item.name}
              {isCurrentUser && ' (Bạn)'}
            </Text>
            {isMemberAdmin && (
              <View style={styles.adminBadge}>
                <Shield size={12} color={Colors.primary} />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
        </View>

        {isAdmin && !isCurrentUser && (
          <View style={styles.memberActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToggleAdmin(item.id, item.name, isMemberAdmin)}
            >
              {isMemberAdmin ? (
                <Shield size={20} color={Colors.textSecondary} />
              ) : (
                <Shield size={20} color={Colors.textLight} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => handleRemoveMember(item.id, item.name)}
            >
              <UserX size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderContactItem = ({ item }: { item: typeof contacts[0] }) => {
    const isSelected = selectedContacts.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => toggleContactSelection(item.id)}
      >
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactRole}>{item.role || 'Thành viên'}</Text>
        </View>
        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
          ]}
        >
          {isSelected && <Check color={Colors.white} size={16} />}
        </View>
      </TouchableOpacity>
    );
  };

  if (showAddMember) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowAddMember(false);
              setSelectedContacts([]);
            }}
          >
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thêm thành viên</Text>
          <TouchableOpacity
            style={[
              styles.addButton,
              selectedContacts.length === 0 && styles.addButtonDisabled,
            ]}
            onPress={handleAddMembers}
            disabled={selectedContacts.length === 0}
          >
            <Text
              style={[
                styles.addButtonText,
                selectedContacts.length === 0 && styles.addButtonTextDisabled,
              ]}
            >
              Thêm
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Search size={20} color={Colors.textLight} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm..."
              placeholderTextColor={Colors.textLight}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <XIcon size={20} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.selectedCount}>
          <Text style={styles.selectedCountText}>
            Đã chọn {selectedContacts.length} người
          </Text>
        </View>

        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <User size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Không tìm thấy thành viên' : 'Không có thành viên để thêm'}
              </Text>
            </View>
          }
        />
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Quản lý thành viên</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.addMemberButton}
            onPress={() => setShowAddMember(true)}
          >
            <UserPlus size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm kiếm thành viên..."
            placeholderTextColor={Colors.textLight}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <XIcon size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.memberCount}>
        <Text style={styles.memberCountText}>
          {group.members.length} thành viên
        </Text>
      </View>

      <FlatList
        data={filteredMembers}
        renderItem={renderMemberItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <User size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>Không tìm thấy thành viên</Text>
          </View>
        }
      />
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
    marginHorizontal: 8,
  },
  addMemberButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  addButtonTextDisabled: {
    color: Colors.textLight,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  memberCount: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  memberCountText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  selectedCountText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  listContent: {
    backgroundColor: Colors.white,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF4ED',
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  removeButton: {
    backgroundColor: '#FEE2E2',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  contactRole: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
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
    marginLeft: 76,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 12,
  },
});
