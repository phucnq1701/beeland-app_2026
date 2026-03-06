import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Share2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { projectFolders } from '@/mocks/documents';
import { Alert, Platform } from 'react-native';

export default function FoldersScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const handleFolderPress = (folderId: string) => {
    console.log('[Folders] Folder pressed', { projectId, folderId });
    router.push(`/documents/${folderId}?projectId=${projectId}` as any);
  };

  const handleShareFolder = async (folder: typeof projectFolders[0], e: any) => {
    e.stopPropagation();
    console.log('[Folders] Sharing folder', { projectId, folderId: folder.id });

    try {
      const folderText = `📁 Folder tài liệu: ${folder.name}\n\nTổng số: ${folder.documentCount} tài liệu\n\nXem tất cả tài liệu trong folder "${folder.name}"`;

      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: folder.name,
            text: folderText,
          });
        } else {
          Alert.alert('Thông báo', 'Chia sẻ không khả dụng trên trình duyệt này');
        }
      } else {
        const Share = await import('react-native').then(m => m.Share);
        await Share.share({
          message: folderText,
          title: folder.name,
        });
      }
      console.log('[Folders] Folder shared successfully');
    } catch (error) {
      console.error('[Folders] Share error', error);
      if ((error as any).message !== 'User did not share') {
        Alert.alert('Lỗi', 'Có lỗi xảy ra khi chia sẻ folder');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tài liệu dự án',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.foldersGrid}>
          {projectFolders.map((folder) => (
            <TouchableOpacity
              key={folder.id}
              style={styles.folderCard}
              activeOpacity={0.7}
              onPress={() => handleFolderPress(folder.id)}
            >
              <View style={styles.folderHeader}>
                <View
                  style={[
                    styles.folderIconContainer,
                    { backgroundColor: folder.color + '15' },
                  ]}
                >
                  <Text style={styles.folderEmoji}>{folder.icon}</Text>
                </View>
                <View style={styles.folderHeaderRight}>
                  <TouchableOpacity
                    style={[styles.shareButton, { backgroundColor: folder.color + '15' }]}
                    onPress={(e) => handleShareFolder(folder, e)}
                    activeOpacity={0.7}
                  >
                    <Share2 color={folder.color} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <View style={styles.folderBadge}>
                    <Text style={styles.folderBadgeText}>
                      {folder.documentCount}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.folderContent}>
                <Text style={styles.folderName} numberOfLines={2}>
                  {folder.name}
                </Text>
                <View style={styles.folderFooter}>
                  <Text style={styles.folderCount}>
                    {folder.documentCount} tài liệu
                  </Text>
                  <View
                    style={[
                      styles.folderArrow,
                      { backgroundColor: folder.color + '15' },
                    ]}
                  >
                    <ChevronRight
                      color={folder.color}
                      size={16}
                      strokeWidth={2.5}
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
  },
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  folderCard: {
    width: '47.5%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  folderHeaderRight: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderEmoji: {
    fontSize: 28,
  },
  folderBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  folderBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  folderContent: {
    gap: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 22,
    minHeight: 44,
  },
  folderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folderCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  folderArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
