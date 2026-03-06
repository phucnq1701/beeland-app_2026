import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { 
  ChevronLeft, 
  Phone, 
  Mail, 
  Building2, 
  MapPin,
  Calendar,
  Clock,
  Plus,
  Edit2,
  FileText,
  User,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { customers } from '@/mocks/customers';

interface Appointment {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
}

interface WorkHistory {
  id: string;
  date: string;
  type: string;
  content: string;
  createdBy: string;
}

const appointmentsData: Appointment[] = [
  {
    id: '1',
    date: '2024-11-15',
    time: '14:00',
    title: 'Xem căn hộ Masteri Thảo Điền',
    location: 'Masteri Thảo Điền - Tầng 15',
    status: 'upcoming',
    notes: 'Khách muốn xem căn góc 2PN',
  },
  {
    id: '2',
    date: '2024-10-20',
    time: '10:00',
    title: 'Gặp tư vấn tài chính',
    location: 'Văn phòng công ty',
    status: 'completed',
  },
  {
    id: '3',
    date: '2024-10-05',
    time: '15:30',
    title: 'Khảo sát dự án Vinhomes',
    location: 'Vinhomes Central Park',
    status: 'completed',
  },
];

const workHistoryData: WorkHistory[] = [
  {
    id: '1',
    date: '2024-10-25',
    type: 'Gọi điện',
    content: 'Trao đổi về chính sách thanh toán và ưu đãi hiện tại. Khách hàng quan tâm đến căn 2PN hướng Đông Nam.',
    createdBy: 'Nguyễn Sales A',
  },
  {
    id: '2',
    date: '2024-10-15',
    type: 'Email',
    content: 'Đã gửi bảng giá và sơ đồ mặt bằng dự án Masteri Thảo Điền cho khách hàng.',
    createdBy: 'Nguyễn Sales A',
  },
  {
    id: '3',
    date: '2024-10-10',
    type: 'Gặp trực tiếp',
    content: 'Tham quan nhà mẫu, khách hàng hài lòng với thiết kế và vị trí. Cần thêm thời gian cân nhắc tài chính.',
    createdBy: 'Trần Manager B',
  },
];

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const customer = customers.find((c) => c.id === id);

  const [appointments, setAppointments] = useState<Appointment[]>(appointmentsData);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>(workHistoryData);
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [newHistory, setNewHistory] = useState({
    type: '',
    content: '',
  });

  if (!customer) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Không tìm thấy khách hàng</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'potential':
        return '#F59E0B';
      case 'inactive':
        return '#9CA3AF';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Đang giao dịch';
      case 'potential':
        return 'Tiềm năng';
      case 'inactive':
        return 'Không hoạt động';
      default:
        return '';
    }
  };

  const getAppointmentStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  const getAppointmentStatusLabel = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'Sắp tới';
      case 'completed':
        return 'Hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return '';
    }
  };

  const handleAddHistory = () => {
    if (!newHistory.type.trim() || !newHistory.content.trim()) {
      if (Platform.OS === 'web') {
        alert('Vui lòng nhập đầy đủ thông tin');
      } else {
        Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin');
      }
      return;
    }

    const history: WorkHistory = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      type: newHistory.type,
      content: newHistory.content,
      createdBy: 'Người dùng hiện tại',
    };

    setWorkHistory([history, ...workHistory]);
    setShowAddHistoryModal(false);
    setNewHistory({ type: '', content: '' });

    if (Platform.OS === 'web') {
      alert('Thêm lịch sử làm việc thành công!');
    } else {
      Alert.alert('Thành công', 'Thêm lịch sử làm việc thành công!');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Chi tiết khách hàng',
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.headerBackButton}
            >
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push(`/customer/${customer.id}/edit`)}
              style={styles.headerEditButton}
            >
              <Edit2 color={Colors.white} size={22} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerHeaderContent}>
            <View style={[
              styles.customerAvatar,
              { backgroundColor: customer.type === 'personal' ? '#EFF6FF' : '#FDF2F8' }
            ]}>
              {customer.type === 'personal' ? (
                <User color={Colors.primary} size={32} />
              ) : (
                <Building2 color="#EC4899" size={32} />
              )}
            </View>
            <View style={styles.customerHeaderInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>
              {customer.company && (
                <Text style={styles.customerCompany}>{customer.company}</Text>
              )}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(customer.status) },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {getStatusLabel(customer.status)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Phone color={Colors.primary} size={20} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Số điện thoại</Text>
                <Text style={styles.infoValue}>{customer.phone}</Text>
              </View>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Mail color={Colors.primary} size={20} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{customer.email}</Text>
              </View>
            </View>
            {customer.taxCode && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconContainer}>
                    <Building2 color={Colors.primary} size={20} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Mã số thuế</Text>
                    <Text style={styles.infoValue}>{customer.taxCode}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {customer.images && customer.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hình ảnh</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesScroll}
            >
              {customer.images.map((imageUri, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUri }}
                  style={styles.customerImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {customer.projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dự án quan tâm</Text>
            <View style={styles.projectsContainer}>
              {customer.projects.map((project, index) => (
                <View key={index} style={styles.projectTag}>
                  <Building2 color={Colors.primary} size={16} />
                  <Text style={styles.projectTagText}>{project}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lịch hẹn</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => console.log('Add appointment')}
              activeOpacity={0.7}
            >
              <Plus color={Colors.primary} size={20} />
              <Text style={styles.addButtonText}>Thêm</Text>
            </TouchableOpacity>
          </View>

          {appointments.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar color={Colors.textSecondary} size={48} />
              <Text style={styles.emptyStateText}>Chưa có lịch hẹn nào</Text>
            </View>
          ) : (
            <View style={styles.appointmentsList}>
              {appointments.map((appointment) => (
                <View key={appointment.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentHeader}>
                    <View style={styles.appointmentDateContainer}>
                      <Calendar color={Colors.primary} size={18} />
                      <Text style={styles.appointmentDate}>
                        {new Date(appointment.date).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </Text>
                      <View style={styles.appointmentTimeDot} />
                      <Clock color={Colors.textSecondary} size={16} />
                      <Text style={styles.appointmentTime}>{appointment.time}</Text>
                    </View>
                    <View
                      style={[
                        styles.appointmentStatusBadge,
                        { backgroundColor: getAppointmentStatusColor(appointment.status) },
                      ]}
                    >
                      <Text style={styles.appointmentStatusText}>
                        {getAppointmentStatusLabel(appointment.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.appointmentTitle}>{appointment.title}</Text>
                  <View style={styles.appointmentLocation}>
                    <MapPin color={Colors.textSecondary} size={16} />
                    <Text style={styles.appointmentLocationText}>
                      {appointment.location}
                    </Text>
                  </View>
                  {appointment.notes && (
                    <View style={styles.appointmentNotes}>
                      <FileText color={Colors.textSecondary} size={16} />
                      <Text style={styles.appointmentNotesText}>
                        {appointment.notes}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lịch sử làm việc</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddHistoryModal(true)}
              activeOpacity={0.7}
            >
              <Plus color={Colors.primary} size={20} />
              <Text style={styles.addButtonText}>Thêm</Text>
            </TouchableOpacity>
          </View>

          {workHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <FileText color={Colors.textSecondary} size={48} />
              <Text style={styles.emptyStateText}>Chưa có lịch sử làm việc</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {workHistory.map((history) => (
                <View key={history.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyTypeContainer}>
                      <View style={styles.historyTypeBadge}>
                        <Text style={styles.historyTypeText}>{history.type}</Text>
                      </View>
                      <Text style={styles.historyDate}>
                        {new Date(history.date).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyContent}>{history.content}</Text>
                  <Text style={styles.historyCreatedBy}>
                    Tạo bởi: {history.createdBy}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showAddHistoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm lịch sử làm việc</Text>
              <TouchableOpacity
                onPress={() => setShowAddHistoryModal(false)}
                style={styles.modalCloseButton}
              >
                <X color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Loại hoạt động <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="VD: Gọi điện, Email, Gặp trực tiếp..."
                  placeholderTextColor={Colors.textSecondary}
                  value={newHistory.type}
                  onChangeText={(text) =>
                    setNewHistory({ ...newHistory, type: text })
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Nội dung <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Mô tả chi tiết về buổi làm việc..."
                  placeholderTextColor={Colors.textSecondary}
                  value={newHistory.content}
                  onChangeText={(text) =>
                    setNewHistory({ ...newHistory, content: text })
                  }
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleAddHistory}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveButtonText}>Lưu lịch sử</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  headerBackButton: {
    marginLeft: 8,
  },
  headerEditButton: {
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  customerHeader: {
    backgroundColor: Colors.white,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customerHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  customerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerHeaderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  customerCompany: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  section: {
    padding: 24,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  imagesScroll: {
    gap: 12,
    paddingBottom: 24,
  },
  customerImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  projectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFF4ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  projectTagText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  appointmentsList: {
    gap: 12,
    marginBottom: 24,
  },
  appointmentCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appointmentDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  appointmentDate: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  appointmentTimeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textSecondary,
    marginHorizontal: 2,
  },
  appointmentTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  appointmentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  appointmentStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  appointmentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  appointmentLocationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  appointmentNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  appointmentNotesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    fontStyle: 'italic' as const,
  },
  historyList: {
    gap: 12,
    marginBottom: 24,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  historyHeader: {
    marginBottom: 10,
  },
  historyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  historyTypeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  historyDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  historyContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  historyCreatedBy: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: `0 4px 12px ${Colors.primary}40`,
      },
    }),
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
