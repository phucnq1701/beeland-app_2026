import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  MapPin,
  Calendar,
  User,
  Home,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { handovers, HandoverIssue } from '@/mocks/handovers';

export default function HandoverDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const handover = useMemo(() => {
    const hid = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    return handovers.find((h) => h.id === hid);
  }, [id]);

  const [issues, setIssues] = useState<HandoverIssue[]>(handover?.issues || []);
  const [newIssue, setNewIssue] = useState({
    category: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
  });
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [notes, setNotes] = useState(handover?.notes || '');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  if (!handover) {
    return (
      <View style={styles.missingContainer}>
        <Stack.Screen options={{ title: 'Không tìm thấy' }} />
        <Text style={styles.missingTitle}>Không tìm thấy thông tin bàn giao</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const displayImages = handover.images && handover.images.length > 0 ? handover.images : [handover.image];
  const screenWidth = Dimensions.get('window').width;

  const handleAddIssue = () => {
    if (!newIssue.category.trim() || !newIssue.description.trim()) {
      if (Platform.OS === 'web') {
        alert('Vui lòng điền đầy đủ thông tin lỗi');
      } else {
        Alert.alert('Thông báo', 'Vui lòng điền đầy đủ thông tin lỗi');
      }
      return;
    }

    const issue: HandoverIssue = {
      id: `temp-${Date.now()}`,
      category: newIssue.category,
      description: newIssue.description,
      severity: newIssue.severity,
      status: 'open',
      reportedAt: new Date().toISOString(),
    };

    setIssues([...issues, issue]);
    setNewIssue({ category: '', description: '', severity: 'medium' });
    setShowAddIssue(false);

    console.log('[HandoverDetail] Issue added', { issue });
  };

  const handleRemoveIssue = (issueId: string) => {
    setIssues(issues.filter((i) => i.id !== issueId));
    console.log('[HandoverDetail] Issue removed', { issueId });
  };

  const handleSubmitAcceptance = () => {
    console.log('[HandoverDetail] Submit acceptance', {
      handoverId: handover.id,
      issues,
      notes,
    });

    const message =
      issues.length === 0
        ? 'Xác nhận bàn giao thành công không có lỗi?'
        : `Tạo phiếu nghiệm thu với ${issues.length} lỗi đã ghi nhận?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        alert('Đã tạo phiếu nghiệm thu thành công');
        router.back();
      }
    } else {
      Alert.alert('Xác nhận', message, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () => {
            Alert.alert('Thành công', 'Đã tạo phiếu nghiệm thu thành công');
            router.back();
          },
        },
      ]);
    }
  };

  const severityConfig = {
    low: { label: 'Thấp', color: '#10B981', bg: '#ECFDF5' },
    medium: { label: 'Trung bình', color: '#F59E0B', bg: '#FFFBEB' },
    high: { label: 'Cao', color: '#EF4444', bg: '#FEF2F2' },
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: handover.apartmentCode,
          headerStyle: {
            backgroundColor: Colors.white,
          },
        }}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / screenWidth);
              setCurrentImageIndex(index);
            }}
          >
            {displayImages.map((img, index) => (
              <Image
                key={`img-${index}`}
                source={{ uri: img }}
                style={[styles.headerImage, { width: screenWidth }]}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          {displayImages.length > 1 && (
            <View style={styles.paginationDots}>
              {displayImages.map((_, index) => (
                <View
                  key={`dot-${index}`}
                  style={[
                    styles.dot,
                    index === currentImageIndex && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin căn hộ</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Home color={Colors.textSecondary} size={20} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Mã căn</Text>
                <Text style={styles.infoValue}>{handover.apartmentCode}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <MapPin color={Colors.textSecondary} size={20} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Địa chỉ</Text>
                <Text style={styles.infoValue}>{handover.address}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <User color={Colors.textSecondary} size={20} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Khách hàng</Text>
                <Text style={styles.infoValue}>{handover.customerName}</Text>
              </View>
            </View>
            {handover.inspector && (
              <View style={styles.infoRow}>
                <CheckCircle color={Colors.textSecondary} size={20} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Người kiểm tra</Text>
                  <Text style={styles.infoValue}>{handover.inspector}</Text>
                </View>
              </View>
            )}
            {handover.scheduledDate && (
              <View style={styles.infoRow}>
                <Calendar color={Colors.textSecondary} size={20} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Lịch hẹn</Text>
                  <Text style={styles.infoValue}>
                    {formatDate(handover.scheduledDate)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diện tích & Giá trị</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Diện tích thông thủy</Text>
              <Text style={styles.priceValue}>{handover.clearArea} m²</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Diện tích xây dựng</Text>
              <Text style={styles.priceValue}>{handover.area} m²</Text>
            </View>
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Giá trị căn hộ</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(handover.priceValue)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Lỗi phát sinh ({issues.length})
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setShowAddIssue(!showAddIssue);
                if (!showAddIssue) {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }
              }}
            >
              <Plus color={Colors.primary} size={20} />
              <Text style={styles.addButtonText}>Thêm lỗi</Text>
            </TouchableOpacity>
          </View>

          {issues.map((issue) => {
            const config = severityConfig[issue.severity];
            return (
              <View key={issue.id} style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueHeaderLeft}>
                    <AlertCircle color={config.color} size={20} />
                    <Text style={styles.issueCategory}>{issue.category}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: config.bg }]}>
                      <Text style={[styles.severityText, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>
                  {issue.status === 'open' && (
                    <TouchableOpacity
                      onPress={() => handleRemoveIssue(issue.id)}
                      style={styles.removeButton}
                    >
                      <Trash2 color="#EF4444" size={18} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.issueDescription}>{issue.description}</Text>
                <View style={styles.issueFooter}>
                  <Text style={styles.issueDate}>
                    {new Date(issue.reportedAt).toLocaleDateString('vi-VN')}
                  </Text>
                  {issue.status === 'resolved' && (
                    <View style={styles.resolvedBadge}>
                      <CheckCircle color="#10B981" size={14} />
                      <Text style={styles.resolvedText}>Đã khắc phục</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {showAddIssue && (
            <View style={styles.addIssueForm}>
              <Text style={styles.formTitle}>Thêm lỗi mới</Text>
              <TextInput
                style={styles.input}
                placeholder="Loại lỗi (VD: Điện, Nước, Sơn...)"
                placeholderTextColor={Colors.textSecondary}
                value={newIssue.category}
                onChangeText={(text) =>
                  setNewIssue({ ...newIssue, category: text })
                }
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Mô tả chi tiết lỗi"
                placeholderTextColor={Colors.textSecondary}
                value={newIssue.description}
                onChangeText={(text) =>
                  setNewIssue({ ...newIssue, description: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.formLabel}>Mức độ nghiêm trọng</Text>
              <View style={styles.severityOptions}>
                {Object.entries(severityConfig).map(([key, config]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.severityOption,
                      { backgroundColor: config.bg },
                      newIssue.severity === key && styles.severityOptionActive,
                    ]}
                    onPress={() =>
                      setNewIssue({
                        ...newIssue,
                        severity: key as 'low' | 'medium' | 'high',
                      })
                    }
                  >
                    <Text style={[styles.severityOptionText, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddIssue(false);
                    setNewIssue({ category: '', description: '', severity: 'medium' });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddIssue}
                >
                  <Text style={styles.saveButtonText}>Thêm lỗi</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ghi chú</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Nhập ghi chú về bàn giao..."
            placeholderTextColor={Colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          activeOpacity={0.8}
          onPress={handleSubmitAcceptance}
        >
          <CheckCircle color={Colors.white} size={22} />
          <Text style={styles.submitButtonText}>Tạo phiếu nghiệm thu</Text>
        </TouchableOpacity>
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
    paddingBottom: 20,
  },
  imageContainer: {
    position: 'relative' as const,
  },
  headerImage: {
    width: '100%',
    height: 240,
  },
  paginationDots: {
    position: 'absolute' as const,
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: Colors.white,
    width: 24,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  priceCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  issueCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  issueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  issueCategory: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  removeButton: {
    padding: 4,
  },
  issueDescription: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  issueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issueDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  addIssueForm: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  severityOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  severityOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  severityOptionActive: {
    borderColor: Colors.primary,
  },
  severityOptionText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(232, 111, 37, 0.3)',
      },
    }),
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  missingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  missingTitle: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: '700' as const,
    fontSize: 16,
  },
});
