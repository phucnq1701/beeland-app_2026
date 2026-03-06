import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MapPin, ArrowRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { featuredProperties } from '@/mocks/properties';

export default function ProjectsScreen() {
  const router = useRouter();

  const handleProjectPress = (id: string) => {
    console.log('[Projects] Navigate to project', { id });
    router.push({ pathname: '/project/[id]', params: { id } });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Danh sách dự án',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {featuredProperties.map((project) => (
          <TouchableOpacity
            key={project.id}
            style={styles.projectCard}
            activeOpacity={0.8}
            onPress={() => handleProjectPress(project.id)}
          >
            <Image
              source={{ uri: project.image }}
              style={styles.projectImage}
              contentFit="cover"
            />
            <View style={styles.projectInfo}>
              <View style={styles.projectHeader}>
                <Text style={styles.projectTitle} numberOfLines={1}>
                  {project.title}
                </Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Đang bán</Text>
                </View>
              </View>
              <View style={styles.locationRow}>
                <MapPin color={Colors.textSecondary} size={14} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {project.location}
                </Text>
              </View>
              <View style={styles.projectFooter}>
                <Text style={styles.priceText}>{project.price}</Text>
                <View style={styles.arrowButton}>
                  <ArrowRight color={Colors.primary} size={18} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
    gap: 16,
  },
  projectCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  projectImage: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.background,
  },
  projectInfo: {
    padding: 16,
    gap: 10,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
