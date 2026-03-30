
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Share2, FileText, FolderOpen } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DocumentService } from '@/sevices/DocumentService';

export default function FoldersScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [folder, setFolder] = useState<any[]>([]);

  const loadFolder = async () => {
    try {
      let res = await DocumentService.get({
        MaDA: Number(projectId),
        TypeDocument: 'DOCUMENT',
        InputSearch: '',
      });

      const data = res?.data ?? [];
      

      // Map API data về cấu trúc UI cần
      const mappedFolders = data.map((item: any) => ({
        id: item.ID?.toString() ?? Math.random().toString(),
        name: item.Name ?? 'Không có tên',
        color: item.Color ?? '#888888',
        icon: item.Icon ?? 'folder',
        documentCount: item.SoLuong ?? 0,
        firstFile: item.FirstFile ?? null,
        note: item.GhiChu ?? '',
      }));

      setFolder(mappedFolders);
    } catch (error) {
      console.error('Lỗi load folder', error);
      setFolder([]);
    }
  };

  useEffect(() => {
    loadFolder();
  }, []);

  

  const handleFolderPress = (folderId: string) => {
    console.log('[Folders] Folder pressed', { projectId, folderId });
    router.push(`/documents/${folderId}?projectId=${projectId}` as any);
  };

  
  const handleShareFolder = async (folder: any, e: any) => {
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

  const totalDocuments = folder.reduce((sum, f) => sum + f.documentCount, 0);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tài liệu dự án',
          headerStyle: {
            backgroundColor: '#FAFAFA',
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
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <FolderOpen size={18} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.summaryText}>
              {folder.length} thư mục
            </Text>
          </View>
          <View style={styles.summaryDot} />
          <View style={styles.summaryItem}>
            <FileText size={18} color={Colors.accent.blue} strokeWidth={2} />
            <Text style={styles.summaryText}>
              {totalDocuments} tài liệu
            </Text>
          </View>
        </View>

        {folder.map((folderItem) => (
          <TouchableOpacity
            key={folderItem.id}
            style={styles.folderCard}
            activeOpacity={0.6}
            onPress={() => handleFolderPress(folderItem?.id)}
            testID={`folder-card-${folderItem.id}`}
          >
            <View style={styles.folderRow}>
              <View style={[styles.colorStripe, { backgroundColor: folderItem.color }]} />

              {/* <View style={[styles.iconWrap, { backgroundColor: folderItem.color + '12' }]}>
                <Text style={styles.iconEmoji}>{folderItem.icon}</Text>
              </View> */}

              <View style={styles.folderInfo}>
                <Text style={styles.folderName} numberOfLines={1}>
                  {folderItem.name}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.countChip, { backgroundColor: folderItem.color + '14' }]}>
                    <Text style={[styles.countChipText, { color: folderItem.color }]}>
                      {folderItem.documentCount} tài liệu
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                {/* <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={(e) => handleShareFolder(folderItem, e)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID={`share-folder-${folderItem.id}`}
                >
                  <Share2 color={Colors.textTertiary} size={17} strokeWidth={2} />
                </TouchableOpacity> */}
                <View style={[styles.arrowWrap, { backgroundColor: folderItem.color + '10' }]}>
                  <ChevronRight color={folderItem.color} size={18} strokeWidth={2.5} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 4,
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  summaryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textLight,
  },
  folderCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
  },
  colorStripe: {
    width: 4,
    height: '100%',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    marginRight: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 22,
  },
  folderInfo: {
    flex: 1,
    gap: 6,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  shareBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 30,
  },
});