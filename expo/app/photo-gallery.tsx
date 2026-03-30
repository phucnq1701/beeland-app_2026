import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Image as ImageIcon, Share2, Filter } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { photoFolders } from '@/mocks/photos';
import { Alert, Platform } from 'react-native';
import { featuredProperties } from '@/mocks/properties';

export default function PhotoGalleryScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const [selectedProject, setSelectedProject] = useState<string>(projectId || 'all');

  const projects = [
    { id: 'all', title: 'Tất cả dự án' },
    ...featuredProperties.map(p => ({ id: p.id, title: p.title }))
  ];

  const filteredFolders = useMemo(() => {
    if (selectedProject === 'all') {
      return photoFolders;
    }
    return photoFolders.filter(folder => folder.projectId === selectedProject);
  }, [selectedProject]);

  const handleFolderPress = (folderId: string) => {
    console.log('[PhotoGallery] Folder pressed', { folderId });
    router.push(`/photos/${folderId}` as any);
  };

  const handleShareFolder = async (folder: typeof photoFolders[0], e: any) => {
    e.stopPropagation();
    console.log('[PhotoGallery] Sharing folder', { folderId: folder.id });

    try {
      const folderText = `📸 Thư viện ảnh: ${folder.name}\n\n` +
        `Tổng số: ${folder.photoCount} ảnh\n\n` +
        `Xem tất cả ảnh trong folder "${folder.name}"`;

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
      console.log('[PhotoGallery] Folder shared successfully');
    } catch (error) {
      console.error('[PhotoGallery] Share error', error);
      if ((error as any).message !== 'User did not share') {
        Alert.alert('Lỗi', 'Có lỗi xảy ra khi chia sẻ folder');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Thư viện ảnh',
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
        <View style={styles.header}>
          <ImageIcon color={Colors.primary} size={32} strokeWidth={2} />
          <Text style={styles.headerTitle}>Thư viện ảnh dự án</Text>
          <Text style={styles.headerSubtitle}>
            Khám phá hình ảnh chi tiết về dự án
          </Text>
        </View>

        {!projectId && (
          <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <Filter color={Colors.text} size={20} strokeWidth={2} />
            <Text style={styles.filterLabel}>Lọc theo dự án</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {projects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={[
                  styles.filterButton,
                  selectedProject === project.id && styles.filterButtonActive,
                ]}
                onPress={() => setSelectedProject(project.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedProject === project.id && styles.filterButtonTextActive,
                  ]}
                >
                  {project.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        )}

        <View style={styles.foldersContainer}>
          {filteredFolders.map((folder) => (
            <TouchableOpacity
              key={folder.id}
              style={styles.folderCard}
              activeOpacity={0.7}
              onPress={() => handleFolderPress(folder.id)}
            >
              <ImageBackground
                source={{ uri: folder.coverPhoto }}
                style={styles.folderBackground}
                imageStyle={styles.folderBackgroundImage}
              >
                <View style={styles.folderOverlay}>
                  <View style={styles.folderHeader}>
                    <View
                      style={[
                        styles.folderIconContainer,
                        { backgroundColor: folder.color },
                      ]}
                    >
                      <Text style={styles.folderEmoji}>{folder.icon}</Text>
                    </View>
                    <View style={styles.folderHeaderRight}>
                      <TouchableOpacity
                        style={styles.shareButton}
                        onPress={(e) => handleShareFolder(folder, e)}
                        activeOpacity={0.7}
                      >
                        <Share2 color={Colors.white} size={18} strokeWidth={2} />
                      </TouchableOpacity>
                      <View style={styles.folderBadge}>
                        <Text style={styles.folderBadgeText}>
                          {folder.photoCount} ảnh
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.folderFooter}>
                    <Text style={styles.folderName} numberOfLines={2}>
                      {folder.name}
                    </Text>
                    <View
                      style={[
                        styles.folderArrow,
                        { backgroundColor: folder.color },
                      ]}
                    >
                      <ChevronRight
                        color={Colors.white}
                        size={20}
                        strokeWidth={2.5}
                      />
                    </View>
                  </View>
                </View>
              </ImageBackground>
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
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  filterSection: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  foldersContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  folderCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  folderBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  folderBackgroundImage: {
    borderRadius: 20,
  },
  folderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 20,
    justifyContent: 'space-between',
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  folderHeaderRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  folderBadgeText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  folderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folderName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    lineHeight: 26,
    marginRight: 12,
  },
  folderArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
