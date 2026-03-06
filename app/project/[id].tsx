import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, ImageIcon, Package, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { featuredProperties } from '@/mocks/properties';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProjectOptionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const project = featuredProperties.find((p) => p.id === id);

  if (!project) {
    return null;
  }

  const options = [
    {
      id: 'products',
      title: 'Sản phẩm',
      icon: Package,
      gradient: ['#8B5CF6', '#6D28D9'] as const,
      onPress: () => router.push('/products'),
    },
    {
      id: 'documents',
      title: 'Tài liệu',
      icon: FileText,
      gradient: ['#3B82F6', '#1D4ED8'] as const,
      onPress: () => router.push(`/folders/${id}` as any),
    },
    {
      id: 'gallery',
      title: 'Thư viện Ảnh',
      icon: ImageIcon,
      gradient: ['#10B981', '#047857'] as const,
      onPress: () => router.push(`/photo-gallery?projectId=${id}` as any),
    },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <Image
        source={{ uri: project.image }}
        style={styles.backgroundImage}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
        style={styles.overlay}
      />

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <View style={styles.backButtonInner}>
          <ArrowLeft color={Colors.white} size={24} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        <View style={styles.header}>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <Text style={styles.projectLocation}>{project.location}</Text>
          <Text style={styles.projectPrice}>{project.price}</Text>
        </View>

        <View style={styles.optionsContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              activeOpacity={0.8}
              onPress={option.onPress}
            >
              <LinearGradient
                colors={option.gradient}
                style={styles.optionGradient}
              >
                <View style={styles.iconContainer}>
                  <option.icon color={Colors.white} size={40} strokeWidth={1.5} />
                </View>
                <Text style={styles.optionTitle}>{option.title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  header: {
    gap: 8,
  },
  projectTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 4,
  },
  projectLocation: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  projectPrice: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.white,
    marginTop: 8,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  optionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
