import React, { useEffect, useRef, useState } from "react";
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
  ActivityIndicator,
  Share,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { X, ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { DocumentService } from "@/sevices/DocumentService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Photo = {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  size: string;
  date: string;
};

export default function PhotosScreen() {
  const { folderId, folder } = useLocalSearchParams<{
    folderId: string;
    folder: string;
  }>();

  const folderObj = folder ? JSON.parse(folder) : null;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);


  const flatListRef = useRef<FlatList>(null);

  const BASE_URL = "https://upload.beesky.vn/";

  const getFullUrl = (link: string) => {
    if (!link) return "";
    if (link.startsWith("http")) return link;
    return BASE_URL.replace(/\/+$/, "") + "/" + link.replace(/^\/+/, "");
  };

  const mapApiToPhoto = (item: any): Photo => ({
    id: String(item.ID),
    name: item.Name,
    url: getFullUrl(item.Link),
    thumbnail: getFullUrl(item.Link),
    size: item.Size ? (item.Size / 1024 / 1024).toFixed(2) + " MB" : "0 MB",
    date: item.CreatedAt,
  });

  const loadImg = async () => {
    try {
      setLoading(true);

      const res = await DocumentService.getDetail({
        DocumentID: Number(folderId),
        InputSearch: "",
      });

      const data = res?.data ?? [];

      const mapped = data
        .map(mapApiToPhoto)
        .sort(
          (a: Photo, b: Photo) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

      setPhotos(mapped);
    } catch (err) {
      console.log(err);
      Alert.alert("Lỗi", "Không tải được ảnh");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadImg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoPress = (photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);

    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index,
        animated: false,
      });
    }, 100);
  };

  const handleClose = () => {
    setSelectedPhoto(null);
  };

  const handlePrevPhoto = () => {
    if (!photos.length) return;

    const prevIndex =
      selectedPhotoIndex > 0 ? selectedPhotoIndex - 1 : photos.length - 1;

    setSelectedPhotoIndex(prevIndex);
    setSelectedPhoto(photos[prevIndex]);

    flatListRef.current?.scrollToIndex({ index: prevIndex });
  };

  const handleNextPhoto = () => {
    if (!photos.length) return;

    const nextIndex =
      selectedPhotoIndex < photos.length - 1 ? selectedPhotoIndex + 1 : 0;

    setSelectedPhotoIndex(nextIndex);
    setSelectedPhoto(photos[nextIndex]);

    flatListRef.current?.scrollToIndex({ index: nextIndex });
  };

  const _handleDownload = async (photo: Photo) => {
    if (!photo?.url) return;

    if (Platform.OS === "web") {
      try {
        const link = document.createElement("a");
        link.href = photo.url;
        link.download = photo.name || "image";
        link.click();
      } catch (e) {
        console.log("Web download error:", e);
      }
      return;
    }

    try {
      setLoading(true);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Lỗi", "Cần cấp quyền lưu ảnh");
        return;
      }

      const cleanUrl = photo.url.replace(/([^:]\/)\/+/g, "$1");

      const asset = await MediaLibrary.createAssetAsync(cleanUrl);
      await MediaLibrary.createAlbumAsync("BeeSky", asset, false).catch(
        () => {}
      );

      Alert.alert("OK", "Đã tải ảnh");
    } catch (e) {
      console.log("DOWNLOAD ERROR:", e);
      Alert.alert("Lỗi", "Tải ảnh thất bại");
    } finally {
      setLoading(false);
    }
  };

  const _handleShare = async (photo: Photo) => {
    try {
      if (Platform.OS === "web") {
        await Share.share({ url: photo.url });
      } else {
        await Sharing.shareAsync(photo.url);
      }
    } catch {
      Alert.alert("Lỗi", "Không share được");
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: folderObj?.Name }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoCard}
                onPress={() => handlePhotoPress(photo, index)}
              >
                <Image
                  source={{ uri: photo.thumbnail }}
                  style={styles.photoImage}
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={selectedPhoto ? true : false}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose}>
              <X color="white" size={28} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalImageContainer}>
            <FlatList
              ref={flatListRef}
              data={photos}
              horizontal
              pagingEnabled
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                if (!selectedPhoto) return;

                const index = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );

                setSelectedPhotoIndex(index);
                setSelectedPhoto(photos[index]);
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

            <TouchableOpacity style={styles.leftNav} onPress={handlePrevPhoto}>
              <ChevronLeft color="white" size={30} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.rightNav} onPress={handleNextPhoto}>
              <ChevronRight color="white" size={30} />
            </TouchableOpacity>
          </View>

          {selectedPhoto && (
            <View style={styles.footer}>
              <Text style={{ color: "white" }}>
                {selectedPhotoIndex + 1} / {photos.length}
              </Text>
              <Text style={{ color: "white" }}>{selectedPhoto.name}</Text>
              <Text style={{ color: "#ccc", fontSize: 12 }}>
                {new Date(selectedPhoto.date).toLocaleDateString("vi-VN")}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 16 },

  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  photoCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
  },

  photoImage: {
    width: "100%",
    height: "100%",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    marginTop: 40,
    zIndex: 999,
    elevation: 999,
  },

  modalImageContainer: {
    flex: 1,
    justifyContent: "center",
  },

  slideContainer: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },

  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },

  leftNav: {
    position: "absolute",
    left: 10,
    top: "50%",
  },

  rightNav: {
    position: "absolute",
    right: 10,
    top: "50%",
  },

  footer: {
    alignItems: "center",
    padding: 20,
  },
});
