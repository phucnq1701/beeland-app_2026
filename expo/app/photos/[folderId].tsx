import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Alert,
  Platform,
  FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Download, Share2, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { photoFolders, Photo } from '@/mocks/photos';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const CACHE_DIR = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotosScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const folder = photoFolders.find((f) => f.id === folderId);

  if (!folder) {
    return null;
  }

  const handlePhotoPress = (photo: Photo, index: number) => {
    console.log('[Photos] Photo pressed', { folderId, photoId: photo.id, index });
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  };

  const handleClose = () => {
    setSelectedPhoto(null);
  };

  const handlePrevPhoto = () => {
    if (!folder) return;
    const prevIndex = selectedPhotoIndex > 0 ? selectedPhotoIndex - 1 : folder.photos.length - 1;
    setSelectedPhotoIndex(prevIndex);
    setSelectedPhoto(folder.photos[prevIndex]);
    console.log('[Photos] Previous photo', { index: prevIndex });
  };

  const handleNextPhoto = () => {
    if (!folder) return;
    const nextIndex = selectedPhotoIndex < folder.photos.length - 1 ? selectedPhotoIndex + 1 : 0;
    setSelectedPhotoIndex(nextIndex);
    setSelectedPhoto(folder.photos[nextIndex]);
    console.log('[Photos] Next photo', { index: nextIndex });
  };

  const handleDownload = async (photo: Photo) => {
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = photo.url;
      link.download = photo.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('[Photos] Photo download initiated on web', { photoId: photo.id });
      return;
    }

    try {
      setDownloading(true);
      console.log('[Photos] Downloading photo', { photoId: photo.id, url: photo.url });

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
        setDownloading(false);
        return;
      }

      const fileUri = CACHE_DIR + photo.id + '.jpg';
      console.log('[Photos] Downloading to cache', { fileUri });
      
      const downloadResult = await FileSystem.downloadAsync(photo.url, fileUri);
      console.log('[Photos] Downloaded to cache', { downloadResult });

      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      console.log('[Photos] Asset created', { asset });
      
      try {
        const album = await MediaLibrary.getAlbumAsync('Dự án');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('Dự án', asset, false);
        }
      } catch (albumError) {
        console.log('[Photos] Album operation', albumError);
      }
      
      Alert.alert('Thành công', 'Đã tải ảnh về thư viện');
      console.log('[Photos] Photo downloaded successfully', { photoId: photo.id });
    } catch (error) {
      console.error('[Photos] Download error', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tải ảnh: ' + (error as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async (photo: Photo) => {
    try {
      console.log('[Photos] Sharing photo', { photoId: photo.id, url: photo.url });

      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: photo.name,
            text: `Xem ảnh: ${photo.name}`,
            url: photo.url,
          });
        } else {
          Alert.alert('Thông báo', 'Chia sẻ không khả dụng trên trình duyệt này');
        }
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Lỗi', 'Chia sẻ không khả dụng trên thiết bị này');
        return;
      }

      const fileUri = CACHE_DIR + photo.id + '.jpg';
      console.log('[Photos] Downloading for share', { fileUri });
      
      const downloadResult = await FileSystem.downloadAsync(photo.url, fileUri);
      console.log('[Photos] Downloaded for share', { downloadResult });

      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Chia sẻ ảnh',
      });
      console.log('[Photos] Photo shared successfully', { photoId: photo.id });
    } catch (error) {
      console.error('[Photos] Share error', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi chia sẻ ảnh: ' + (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: folder.name,
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
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: folder.color + '15' },
            ]}
          >
            <Text style={styles.headerEmoji}>{folder.icon}</Text>
          </View>
          <Text style={styles.headerTitle}>{folder.name}</Text>
          <Text style={styles.headerSubtitle}>
            {folder.photoCount} ảnh
          </Text>
        </View>

        <View style={styles.photosGrid}>
          {folder.photos.map((photo, index) => (
            <TouchableOpacity
              key={photo.id}
              style={styles.photoCard}
              activeOpacity={0.8}
              onPress={() => handlePhotoPress(photo, index)}
            >
              <Image
                source={{ uri: photo.thumbnail }}
                style={styles.photoImage}
                resizeMode="cover"
              />
              <View style={styles.photoOverlay}>
                <Text style={styles.photoName} numberOfLines={2}>
                  {photo.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X color={Colors.white} size={24} strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => selectedPhoto && handleShare(selectedPhoto)}
                activeOpacity={0.7}
              >
                <Share2 color={Colors.white} size={22} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => selectedPhoto && handleDownload(selectedPhoto)}
                activeOpacity={0.7}
                disabled={downloading}
              >
                <Download
                  color={downloading ? Colors.textSecondary : Colors.white}
                  size={22}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalImageContainer}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePrevPhoto}
              activeOpacity={0.7}
            >
              <View style={styles.navButtonInner}>
                <ChevronLeft color={Colors.white} size={28} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <FlatList
              data={folder?.photos || []}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              initialScrollIndex={selectedPhotoIndex}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                setSelectedPhotoIndex(index);
                if (folder?.photos[index]) {
                  setSelectedPhoto(folder.photos[index]);
                }
              }}
              renderItem={({ item }) => (
                <View style={styles.slideContainer}>
                  <Image
                    source={{ uri: item.url }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            />

            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNextPhoto}
              activeOpacity={0.7}
            >
              <View style={styles.navButtonInner}>
                <ChevronRight color={Colors.white} size={28} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>

          {selectedPhoto && folder && (
            <View style={styles.modalFooter}>
              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>
                  {selectedPhotoIndex + 1} / {folder.photos.length}
                </Text>
              </View>
              <Text style={styles.modalPhotoName} numberOfLines={2}>
                {selectedPhoto.name}
              </Text>
              <Text style={styles.modalPhotoInfo}>
                {selectedPhoto.size} • {selectedPhoto.date}
              </Text>
            </View>
          )}
        </View>
      </Modal>
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
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerEmoji: {
    fontSize: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  photosGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
  },
  photoName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_HEIGHT * 0.7,
  },
  navButton: {
    position: 'absolute',
    zIndex: 10,
    padding: 16,
  },
  navButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  photoCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  photoCounterText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  modalPhotoName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  modalPhotoInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500' as const,
    textAlign: 'center',
  },
});
