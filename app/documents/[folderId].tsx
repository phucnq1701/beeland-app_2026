import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Download } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { projectFolders } from '@/mocks/documents';

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return '📄';
    case 'doc':
      return '📝';
    case 'xls':
      return '📊';
    case 'jpg':
    case 'png':
      return '🖼️';
    default:
      return '📄';
  }
};

const getFileColor = (type: string) => {
  switch (type) {
    case 'pdf':
      return '#EF4444';
    case 'doc':
      return '#3B82F6';
    case 'xls':
      return '#10B981';
    case 'jpg':
    case 'png':
      return '#F59E0B';
    default:
      return '#6B7280';
  }
};

export default function DocumentsScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();

  const folder = projectFolders.find((f) => f.id === folderId);

  if (!folder) {
    return null;
  }

  const handleDocumentPress = (documentId: string) => {
    console.log('[Documents] Document pressed', { folderId, documentId });
  };

  const handleDownload = (documentId: string, documentName: string) => {
    console.log('[Documents] Download pressed', { documentId, documentName });
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
            {folder.documentCount} tài liệu
          </Text>
        </View>

        <View style={styles.documentsContainer}>
          {folder.documents.map((document) => {
            const fileColor = getFileColor(document.type);
            const fileIcon = getFileIcon(document.type);

            return (
              <TouchableOpacity
                key={document.id}
                style={styles.documentCard}
                activeOpacity={0.7}
                onPress={() => handleDocumentPress(document.id)}
              >
                <View style={styles.documentLeft}>
                  <View
                    style={[
                      styles.documentIconContainer,
                      { backgroundColor: fileColor + '15' },
                    ]}
                  >
                    <Text style={styles.documentEmoji}>{fileIcon}</Text>
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={2}>
                      {document.name}
                    </Text>
                    <View style={styles.documentMeta}>
                      <Text style={styles.documentMetaText}>
                        {document.size}
                      </Text>
                      <View style={styles.documentDot} />
                      <Text style={styles.documentMetaText}>
                        {document.date}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.downloadButton,
                    { backgroundColor: fileColor + '15' },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDownload(document.id, document.name);
                  }}
                  activeOpacity={0.7}
                >
                  <Download color={fileColor} size={18} strokeWidth={2} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
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
  documentsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  documentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentEmoji: {
    fontSize: 24,
  },
  documentInfo: {
    flex: 1,
    gap: 6,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentMetaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  documentDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textSecondary,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
