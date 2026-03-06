import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Save, ChevronDown, Check, ImagePlus, X, Users } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import Colors from '@/constants/colors';
import { CustomerType } from '@/mocks/customers';

export default function CustomerNewScreen() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    cccd: '',
    type: 'personal' as CustomerType,
    company: '',
    taxCode: '',
    status: 'potential' as 'active' | 'potential' | 'inactive',
    images: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const statusOptions: {
    value: 'active' | 'potential' | 'inactive';
    label: string;
    color: string;
  }[] = [
    { value: 'potential', label: 'Tiềm năng', color: '#F59E0B' },
    { value: 'active', label: 'Đang giao dịch', color: '#10B981' },
    { value: 'inactive', label: 'Không hoạt động', color: '#9CA3AF' },
  ];

  const getSelectedStatusLabel = () => {
    return statusOptions.find((option) => option.value === formData.status)?.label || '';
  };

  const getSelectedStatusColor = () => {
    return statusOptions.find((option) => option.value === formData.status)?.color || Colors.textSecondary;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập tên khách hàng';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^0\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ';
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (formData.cccd.trim() && !/^\d{12}$/.test(formData.cccd)) {
      newErrors.cccd = 'Số CCCD phải có đúng 12 chữ số';
    }

    if (formData.type === 'business' && !formData.company.trim()) {
      newErrors.company = 'Vui lòng nhập tên công ty';
    }

    if (formData.type === 'business' && !formData.taxCode.trim()) {
      newErrors.taxCode = 'Vui lòng nhập mã số thuế';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImages = async () => {
    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => asset.uri);
        setFormData({
          ...formData,
          images: [...formData.images, ...newImages],
        });
      }
    } catch (error) {
      console.error('Error picking images:', error);
      if (Platform.OS === 'web') {
        alert('Không thể chọn ảnh');
      } else {
        Alert.alert('Lỗi', 'Không thể chọn ảnh');
      }
    } finally {
      setIsPickingImage(false);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: updatedImages });
  };

  const requestContactsPermission = async () => {
    if (Platform.OS === 'web') {
      alert('Chức năng này không khả dụng trên web');
      return false;
    }

    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Thông báo', 'Cần cấp quyền truy cập danh bạ để sử dụng chức năng này');
      return false;
    }
    return true;
  };

  const loadContacts = async () => {
    try {
      setIsLoadingContacts(true);
      const hasPermission = await requestContactsPermission();
      if (!hasPermission) return;

      if (phoneContacts.length === 0) {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
          ],
        });

        const contactsWithPhone = data.filter(
          (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0
        );
        setPhoneContacts(contactsWithPhone);
      }
      
      setShowContactsModal(true);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Lỗi', 'Không thể tải danh bạ');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const importSelectedContacts = () => {
    const contactsToImport = phoneContacts.filter((contact) => {
      const contactId = (contact as any).id ?? `temp-${contact.name}-${Math.random()}`;
      return selectedContacts.has(contactId);
    });

    if (contactsToImport.length === 0) {
      if (Platform.OS === 'web') {
        alert('Vui lòng chọn ít nhất một liên hệ');
      } else {
        Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một liên hệ');
      }
      return;
    }

    if (contactsToImport.length === 1) {
      const contact = contactsToImport[0];
      const phone = contact.phoneNumbers?.[0]?.number?.replace(/[^0-9]/g, '') || '';
      const email = contact.emails?.[0]?.email || '';
      
      setFormData({
        ...formData,
        name: contact.name || '',
        phone: phone,
        email: email,
      });
    } else {
      const firstContact = contactsToImport[0];
      const phone = firstContact.phoneNumbers?.[0]?.number?.replace(/[^0-9]/g, '') || '';
      const email = firstContact.emails?.[0]?.email || '';
      
      setFormData({
        ...formData,
        name: firstContact.name || '',
        phone: phone,
        email: email,
      });
      
      if (Platform.OS === 'web') {
        alert(`Đã nhập ${contactsToImport.length} liên hệ. Thông tin liên hệ đầu tiên đã được điền vào form. Bạn có thể tạo thêm khách hàng cho các liên hệ còn lại sau.`);
      } else {
        Alert.alert(
          'Thông báo',
          `Đã nhập ${contactsToImport.length} liên hệ. Thông tin liên hệ đầu tiên đã được điền vào form. Bạn có thể tạo thêm khách hàng cho các liên hệ còn lại sau.`,
          [{ text: 'OK' }]
        );
      }
    }

    setSelectedContacts(new Set());
    setShowContactsModal(false);
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    if (Platform.OS === 'web') {
      alert('Tạo khách hàng thành công!');
    } else {
      Alert.alert(
        'Thành công',
        'Tạo khách hàng thành công!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }
    
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Tạo khách hàng mới',
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
              onPress={handleSave}
              style={styles.headerSaveButton}
            >
              <Save color={Colors.white} size={22} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loại khách hàng</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                styles.typeButtonLeft,
                formData.type === 'personal' && styles.typeButtonActive,
              ]}
              onPress={() => setFormData({ ...formData, type: 'personal' })}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  formData.type === 'personal' && styles.typeButtonTextActive,
                ]}
              >
                Cá nhân
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                styles.typeButtonRight,
                formData.type === 'business' && styles.typeButtonActive,
              ]}
              onPress={() => setFormData({ ...formData, type: 'business' })}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  formData.type === 'business' && styles.typeButtonTextActive,
                ]}
              >
                Doanh nghiệp
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.contactsButton}
                onPress={loadContacts}
                activeOpacity={0.8}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <>
                    <Users color={Colors.primary} size={18} />
                    <Text style={styles.contactsButtonText}>Chọn từ danh bạ</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Tên khách hàng <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder={formData.type === 'personal' ? 'Nguyễn Văn A' : 'Công ty TNHH ABC'}
              placeholderTextColor={Colors.textSecondary}
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Số điện thoại <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="0901234567"
              placeholderTextColor={Colors.textSecondary}
              value={formData.phone}
              onChangeText={(text) => {
                setFormData({ ...formData, phone: text });
                if (errors.phone) {
                  setErrors({ ...errors, phone: '' });
                }
              }}
              keyboardType="phone-pad"
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="example@gmail.com"
              placeholderTextColor={Colors.textSecondary}
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Số CCCD</Text>
            <TextInput
              style={[styles.input, errors.cccd && styles.inputError]}
              placeholder="123456789012"
              placeholderTextColor={Colors.textSecondary}
              value={formData.cccd}
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9]/g, '');
                if (numericText.length <= 12) {
                  setFormData({ ...formData, cccd: numericText });
                  if (errors.cccd) {
                    setErrors({ ...errors, cccd: '' });
                  }
                }
              }}
              keyboardType="number-pad"
              maxLength={12}
            />
            {errors.cccd && <Text style={styles.errorText}>{errors.cccd}</Text>}
          </View>
        </View>

        {formData.type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin doanh nghiệp</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tên công ty <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.company && styles.inputError]}
                placeholder="Công ty TNHH ABC"
                placeholderTextColor={Colors.textSecondary}
                value={formData.company}
                onChangeText={(text) => {
                  setFormData({ ...formData, company: text });
                  if (errors.company) {
                    setErrors({ ...errors, company: '' });
                  }
                }}
              />
              {errors.company && <Text style={styles.errorText}>{errors.company}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Mã số thuế <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.taxCode && styles.inputError]}
                placeholder="0123456789"
                placeholderTextColor={Colors.textSecondary}
                value={formData.taxCode}
                onChangeText={(text) => {
                  setFormData({ ...formData, taxCode: text });
                  if (errors.taxCode) {
                    setErrors({ ...errors, taxCode: '' });
                  }
                }}
                keyboardType="number-pad"
              />
              {errors.taxCode && <Text style={styles.errorText}>{errors.taxCode}</Text>}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trạng thái</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowStatusDropdown(true)}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownButtonContent}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: getSelectedStatusColor() },
                ]}
              />
              <Text style={styles.dropdownButtonText}>
                {getSelectedStatusLabel()}
              </Text>
            </View>
            <ChevronDown color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hình ảnh</Text>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesScrollContent}
          >
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={pickImages}
              activeOpacity={0.8}
              disabled={isPickingImage}
            >
              {isPickingImage ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <>
                  <ImagePlus color={Colors.primary} size={32} />
                  <Text style={styles.addImageText}>Thêm ảnh</Text>
                </>
              )}
            </TouchableOpacity>

            {formData.images.map((imageUri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.customerImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                  activeOpacity={0.8}
                >
                  <X color={Colors.white} size={16} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <Modal
          visible={showStatusDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStatusDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStatusDropdown(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Chọn trạng thái</Text>
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => {
                    setFormData({ ...formData, status: option.value });
                    setShowStatusDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalOptionContent}>
                    <View
                      style={[
                        styles.statusIndicator,
                        { backgroundColor: option.color },
                      ]}
                    />
                    <Text style={styles.modalOptionText}>{option.label}</Text>
                  </View>
                  {formData.status === option.value && (
                    <Check color={Colors.primary} size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showContactsModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowContactsModal(false)}
        >
          <View style={styles.contactsModalContainer}>
            <View style={styles.contactsModalContent}>
              <View style={styles.contactsModalHeader}>
                <Text style={styles.contactsModalTitle}>Chọn từ danh bạ</Text>
                <TouchableOpacity
                  onPress={() => setShowContactsModal(false)}
                  style={styles.closeButton}
                >
                  <X color={Colors.text} size={24} />
                </TouchableOpacity>
              </View>

              <Text style={styles.contactsModalSubtitle}>
                Đã chọn: {selectedContacts.size} liên hệ
              </Text>

              <ScrollView style={styles.contactsList}>
                {phoneContacts.map((contact) => {
                  const contactId = (contact as any).id ?? `temp-${contact.name}-${Math.random()}`;
                  
                  const isSelected = selectedContacts.has(contactId);
                  const phone = contact.phoneNumbers?.[0]?.number || 'Không có SĐT';
                  const email = contact.emails?.[0]?.email || 'Không có email';

                  return (
                    <TouchableOpacity
                      key={contactId}
                      style={[
                        styles.contactItem,
                        isSelected && styles.contactItemSelected,
                      ]}
                      onPress={() => toggleContactSelection(contactId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.contactItemContent}>
                        <View
                          style={[
                            styles.contactCheckbox,
                            isSelected && styles.contactCheckboxSelected,
                          ]}
                        >
                          {isSelected && <Check color={Colors.white} size={16} />}
                        </View>
                        <View style={styles.contactInfo}>
                          <Text style={styles.contactName}>{contact.name}</Text>
                          <Text style={styles.contactDetail}>{phone}</Text>
                          <Text style={styles.contactDetail}>{email}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.contactsModalFooter}>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={importSelectedContacts}
                  activeOpacity={0.8}
                >
                  <Text style={styles.importButtonText}>Nhập đã chọn</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Save color={Colors.white} size={20} />
          <Text style={styles.saveButtonText}>Tạo khách hàng</Text>
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
  headerBackButton: {
    marginLeft: 8,
  },
  headerSaveButton: {
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
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
  contactsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  contactsButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  typeContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  typeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  typeButtonRight: {},
  typeButtonActive: {
    backgroundColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  typeButtonTextActive: {
    color: Colors.white,
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
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
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
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  imagesScrollContent: {
    gap: 12,
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addImageText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  imageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  customerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  contactsModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contactsModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  contactsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  contactsModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  contactsModalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  contactsList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  contactItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  contactItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  contactItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactCheckboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactsModalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  importButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
    }),
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
