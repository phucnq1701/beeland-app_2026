import React, { useCallback, useMemo, useState } from "react";
import { SectionList, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SearchX } from "lucide-react-native";

import { AppHeader, Avatar, EmptyState, ListItem, Screen, SearchBar, Text } from "@/components/ui";
import { foldVietnamese } from "@/lib/format";
import { colors, space } from "@/theme";
import { contacts, Contact } from "@/mocks/contacts";
import { chatGroups } from "@/mocks/chatGroups";

/** "Vừa xem / N phút trước / …" như màn cũ. */
function formatLastSeen(date?: Date): string {
  if (!date) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "Vừa xem";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

/**
 * Danh bạ nội bộ cho chat. Dữ liệu mẫu (mocks/contacts) như trước – chỉ đổi giao diện (plan GĐ4, R5).
 */
export default function ContactsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const sections = useMemo(() => {
    const q = foldVietnamese(searchQuery.trim());
    const filtered = contacts.filter(
      (c) =>
        !q ||
        foldVietnamese(`${c.name} ${c.role ?? ""} ${c.department ?? ""}`).includes(q) ||
        c.phone?.includes(searchQuery.trim())
    );
    const groups: Record<string, Contact[]> = {};
    for (const c of filtered) {
      const letter = c.name.charAt(0).toUpperCase();
      (groups[letter] ??= []).push(c);
    }
    return Object.keys(groups)
      .sort()
      .map((title) => ({ title, data: groups[title] }));
  }, [searchQuery]);

  const openChat = useCallback(
    (contact: Contact) => {
      const existing = chatGroups.find(
        (g) => g.type === "direct" && g.members.some((m) => m.id === contact.id)
      );
      router.push(`/chat/${existing ? existing.id : contact.id}` as any);
    },
    [router]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll={false} padded={false} header={<AppHeader title="Danh bạ" />}>
        <View style={styles.search}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Tìm tên, vai trò, phòng ban…" />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="label" color="textSecondary">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={item.role}
              meta={item.isOnline ? "Đang hoạt động" : formatLastSeen(item.lastSeen) || undefined}
              leading={<Avatar name={item.name} uri={item.avatar} />}
              onPress={() => openChat(item)}
            />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={<EmptyState icon={SearchX} title="Không tìm thấy liên hệ" />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled
        />
      </Screen>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: space.lg, paddingVertical: space.md },
  sectionHeader: { backgroundColor: colors.bg, paddingHorizontal: space.lg, paddingVertical: space.xs },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 72 },
  content: { paddingBottom: space.xxl },
});
