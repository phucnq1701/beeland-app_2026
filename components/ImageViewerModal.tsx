import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  // Báo index hiện tại khi đóng để đồng bộ lại carousel nhỏ
  onIndexChange?: (index: number) => void;
};

// Xem ảnh toàn màn hình: vuốt/bấm mũi tên để tiến-lùi, iOS hỗ trợ pinch zoom
export default function ImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onIndexChange,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const goTo = (next: number) => {
    if (next < 0 || next >= images.length) return;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
    onIndexChange?.(next);
  };

  const handleMomentumEnd = (e: any) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
    onIndexChange?.(next);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={handleMomentumEnd}
          keyExtractor={(_, i) => `viewer-${i}`}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={styles.zoomContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: item }}
                style={{ width, height }}
                contentFit="contain"
              />
            </ScrollView>
          )}
        />

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Text style={styles.counter}>
            {images.length > 0 ? `${index + 1} / ${images.length}` : ""}
          </Text>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onClose}
            hitSlop={10}
            testID="image-viewer-close"
          >
            <X color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        {index > 0 && (
          <TouchableOpacity
            style={[styles.navBtn, { left: 12 }]}
            onPress={() => goTo(index - 1)}
            hitSlop={10}
          >
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
        )}
        {index < images.length - 1 && (
          <TouchableOpacity
            style={[styles.navBtn, { right: 12 }]}
            onPress={() => goTo(index + 1)}
            hitSlop={10}
          >
            <ChevronRight color="#fff" size={28} />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  zoomContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counter: { color: "#fff", fontSize: 16, fontWeight: "600" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
});
