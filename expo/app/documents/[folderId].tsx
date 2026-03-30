import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Download, Search, FileText, FileSpreadsheet, Image, File, Share2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { projectFolders, Document } from '@/mocks/documents';

const FILE_TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  pdf: { icon: FileText, color: '#EF4444', label: 'PDF' },
  doc: { icon: File, color: '#3B82F6', label: 'DOC' },
  xls: { icon: FileSpreadsheet, color: '#10B981', label: 'XLS' },
  jpg: { icon: Image, color: '#F59E0B', label: 'JPG' },
  png: { icon: Image, color: '#F59E0B', label: 'PNG' },
};

const getTypeConfig = (type: string) => FILE_TYPE_CONFIG[type] ?? { icon: File, color: '#6B7280', label: type.toUpperCase() };

export default function DocumentsScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const folder = projectFolders.find((f) => f.id === folderId);

  const filteredDocuments = folder?.documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const handleDocumentPress = useCallback((documentId: string) => {
    console.log('[Documents] Document pressed', { folderId, documentId });
  }, [folderId]);

  const handleDownload = useCallback((documentId: string, documentName: string) => {
    console.log('[Documents] Download pressed', { documentId, documentName });
    Alert.alert('Tải xuống', `Đang tải "${documentName}"...`);
  }, []);

  const handleShare = useCallback(async (doc: Document) => {
    console.log('[Documents] Share pressed', { docId: doc.id });
    try {
      const text = `📄 ${doc.name}\nLoại: ${doc.type.toUpperCase()} • ${doc.size}\nNgày: ${doc.date}`;
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: doc.name, text });
        } else {
          Alert.alert('Thông báo', 'Chia sẻ không khả dụng trên trình duyệt này');
        }
      } else {
        await Share.share({ message: text, title: doc.name });
      }
    } catch (error) {
      console.error('[Documents] Share error', error);
    }
  }, []);

  if (!folder) {
    return null;
  }

  const typeGroups = filteredDocuments.reduce<Record<string, Document[]>>((acc, doc) => {
    const key = doc.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const uniqueTypes = Object.keys(typeGroups);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: folder.name,
          headerStyle: { backgroundColor: '#FAFAFA' },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.topSection}>
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: folder.color + '12' }]}>
            <Text style={[styles.statNumber, { color: folder.color }]}>{folder.documentCount}</Text>
            <Text style={[styles.statLabel, { color: folder.color }]}>tài liệu</Text>
          </View>
          {uniqueTypes.map((type) => {
            const config = getTypeConfig(type);
            return (
              <View key={type} style={[styles.statChip, { backgroundColor: config.color + '10' }]}>
                <Text style={[styles.statNumber, { color: config.color }]}>{typeGroups[type].length}</Text>
                <Text style={[styles.statLabel, { color: config.color }]}>{config.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.searchContainer}>
          <Search color={Colors.textTertiary} size={18} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tài liệu..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <X color={Colors.textTertiary} size={18} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredDocuments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Không tìm thấy tài liệu</Text>
          </View>
        ) : (
          filteredDocuments.map((document, index) => {
            const config = getTypeConfig(document.type);
            const IconComponent = config.icon;
            const isLast = index === filteredDocuments.length - 1;

            return (
              <TouchableOpacity
                key={document.id}
                style={[styles.documentRow, !isLast && styles.documentRowBorder]}
                activeOpacity={0.6}
                onPress={() => handleDocumentPress(document.id)}
                testID={`document-${document.id}`}
              >
                <View style={[styles.typeIndicator, { backgroundColor: config.color }]} />

                <View style={[styles.iconBox, { backgroundColor: config.color + '10' }]}>
                  <IconComponent color={config.color} size={20} strokeWidth={1.8} />
                </View>

                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{document.name}</Text>
                  <View style={styles.docMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: config.color + '12' }]}>
                      <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <Text style={styles.docMetaText}>{document.size}</Text>
                    <View style={styles.dotSep} />
                    <Text style={styles.docMetaText}>{document.date}</Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      void handleShare(document);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Share2 color={Colors.textTertiary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: config.color + '10' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownload(document.id, document.name);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Download color={config.color} size={16} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 0,
  },
  documentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  typeIndicator: {
    width: 3,
    height: 32,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginRight: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
    gap: 5,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 19,
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  docMetaText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400' as const,
  },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textLight,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
