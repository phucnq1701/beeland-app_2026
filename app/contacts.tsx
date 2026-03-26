import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ArrowLeft, User } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { contacts, Contact } from '@/mocks/contacts';
import { chatGroups } from '@/mocks/chatGroups';

export default function ContactsScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery) ||
      contact.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const firstLetter = contact.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  const sections = Object.keys(groupedContacts)
    .sort()
    .map((letter) => ({
      title: letter,
      data: groupedContacts[letter],
    }));

  const handleContactPress = (contact: Contact) => {
    const existingChat = chatGroups.find(
      (group) =>
        group.type === 'direct' &&
        group.members.some((m) => m.id === contact.id)
    );

    if (existingChat) {
      router.push(`/chat/${existingChat.id}`);
    } else {
      router.push(`/chat/${contact.id}`);
    }
  };

  const formatLastSeen = (date?: Date): string => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Vừa xem';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleContactPress(item)}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <User color={Colors.white} size={24} />
        </View>
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.contactContent}>
        <Text style={styles.contactName}>{item.name}</Text>
        <View style={styles.contactInfo}>
          {item.role && (
            <Text style={styles.contactRole} numberOfLines={1}>
              {item.role}
            </Text>
          )}
          {!item.isOnline && item.lastSeen && (
            <Text style={styles.lastSeen}>{formatLastSeen(item.lastSeen)}</Text>
          )}
          {item.isOnline && (
            <Text style={styles.onlineText}>Đang hoạt động</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );



  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Danh bạ</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <Search color={Colors.textLight} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên, vai trò, phòng ban..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={sections.flatMap((section) =>
          section.data.map((item, index) => ({
            ...item,
            isFirstInSection: index === 0,
            sectionTitle: index === 0 ? section.title : undefined,
          }))
        )}
        renderItem={({ item }) => (
          <>
            {item.isFirstInSection && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{item.sectionTitle}</Text>
              </View>
            )}
            {renderContact({ item })}
          </>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  listContent: {
    paddingTop: 8,
  },
  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  contactItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  contactContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactRole: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  lastSeen: {
    fontSize: 13,
    color: Colors.textLight,
  },
  onlineText: {
    fontSize: 13,
    color: '#10B981',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 84,
  },
});
