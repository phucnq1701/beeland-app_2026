import React, { useState } from "react";
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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  ChevronLeft,
  Save,
  ChevronDown,
  Check,
  ImagePlus,
  X,
  Users,
  User,
  Building2,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Contacts from "expo-contacts";
import Colors from "@/constants/colors";
import { CustomerType } from "@/mocks/customers";
import { CustomerService } from "@/sevices/CustomerService";

export default function CustomerNewScreen() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    cccd: "",
    type: "personal" as CustomerType,
    company: "",
    taxCode: "",
    status: "potential" as "active" | "potential" | "inactive",
    images: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const statusOptions: {
    value: "active" | "potential" | "inactive";
    label: string;
    color: string;
  }[] = [
    { value: "potential", label: "Tiềm năng", color: "#F59E0B" },
    { value: "active", label: "Đang giao dịch", color: "#10B981" },
    { value: "inactive", label: "Không hoạt động", color: "#9CA3AF" },
  ];

  const getSelectedStatusLabel = () => {
    return (
      statusOptions.find((option) => option.value === formData.status)?.label ||
      ""
    );
  };

  const getSelectedStatusColor = () => {
    return (
      statusOptions.find((option) => option.value === formData.status)?.color ||
      Colors.textSecondary
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Vui lòng nhập tên khách hàng";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^0\d{9}$/.test(formData.phone)) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }
    if (
      formData.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {
      newErrors.email = "Email không hợp lệ";
    }
    if (formData.cccd.trim() && !/^\d{12}$/.test(formData.cccd)) {
      newErrors.cccd = "Số CCCD phải có đúng 12 chữ số";
    }
    if (formData.type === "business" && !formData.company.trim()) {
      newErrors.company = "Vui lòng nhập tên công ty";
    }
    if (formData.type === "business" && !formData.taxCode.trim()) {
      newErrors.taxCode = "Vui lòng nhập mã số thuế";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImages = async () => {
    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
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
      console.error("Error picking images:", error);
      Alert.alert("Lỗi", "Không thể chọn ảnh");
    } finally {
      setIsPickingImage(false);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: updatedImages });
  };

  const requestContactsPermission = async () => {
    if (Platform.OS === "web") {
      alert("Chức năng này không khả dụng trên web");
      return false;
    }
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Thông báo",
        "Cần cấp quyền truy cập danh bạ để sử dụng chức năng này"
      );
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
      console.error("Error loading contacts:", error);
      Alert.alert("Lỗi", "Không thể tải danh bạ");
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
      const contactId =
        (contact as any).id ?? `temp-${contact.name}-${Math.random()}`;
      return selectedContacts.has(contactId);
    });
    if (contactsToImport.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất một liên hệ");
      return;
    }
    const firstContact = contactsToImport[0];
    const phone =
      firstContact.phoneNumbers?.[0]?.number?.replace(/[^0-9]/g, "") || "";
    const email = firstContact.emails?.[0]?.email || "";
    setFormData({
      ...formData,
      name: firstContact.name || "",
      phone: phone,
      email: email,
    });
    if (contactsToImport.length > 1) {
      Alert.alert(
        "Thông báo",
        `Đã nhập thông tin liên hệ đầu tiên. Bạn có thể tạo thêm cho ${contactsToImport.length - 1} liên hệ còn lại sau.`
      );
    }
    setSelectedContacts(new Set());
    setShowContactsModal(false);
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      const payload = {
        maKH: 0,
        hoTen: formData.name,
        diDong: formData.phone,
        email: formData.email,
        soCMND: formData.cccd,
        diaChi: "",
        maNKH: 0,
        maNguon: 0,
        ghiChu: "",
      };
      const res = await CustomerService.addCustomer(payload);
      if (res?.status === 2000) {
        Alert.alert("Thành công", res.message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Lỗi", res?.message || "Tạo khách hàng thất bại");
      }
    } catch (error) {
      console.log("ADD CUSTOMER ERROR:", error);
      Alert.alert("Lỗi", "Không thể kết nối server");
    }
  };

  const renderFormField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    options?: {
      required?: boolean;
      error?: string;
      placeholder?: string;
      keyboardType?: "default" | "phone-pad" | "email-address" | "number-pad";
      autoCapitalize?: "none" | "sentences" | "words" | "characters";
      maxLength?: number;
    }
  ) => (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>
        {label}
        {options?.required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.fieldInput, options?.error ? styles.fieldInputError : null]}
        placeholder={options?.placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={options?.keyboardType}
        autoCapitalize={options?.autoCapitalize}
        maxLength={options?.maxLength}
      />
      {options?.error ? (
        <Text style={styles.fieldError}>{options.error}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Tạo khách hàng",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loại khách hàng</Text>
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeOption, formData.type === "personal" && styles.typeOptionActive]}
              onPress={() => setFormData({ ...formData, type: "personal" })}
              activeOpacity={0.8}
            >
              <User
                color={formData.type === "personal" ? Colors.white : Colors.textSecondary}
                size={18}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  formData.type === "personal" && styles.typeOptionTextActive,
                ]}
              >
                Cá nhân
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeOption, formData.type === "business" && styles.typeOptionActive]}
              onPress={() => setFormData({ ...formData, type: "business" })}
              activeOpacity={0.8}
            >
              <Building2
                color={formData.type === "business" ? Colors.white : Colors.textSecondary}
                size={18}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  formData.type === "business" && styles.typeOptionTextActive,
                ]}
              >
                Doanh nghiệp
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Thông tin cơ bản</Text>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                style={styles.contactsBtn}
                onPress={loadContacts}
                activeOpacity={0.8}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <>
                    <Users color={Colors.primary} size={16} />
                    <Text style={styles.contactsBtnText}>Danh bạ</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {renderFormField(
            "Tên khách hàng",
            formData.name,
            (text) => {
              setFormData({ ...formData, name: text });
              if (errors.name) setErrors({ ...errors, name: "" });
            },
            {
              required: true,
              error: errors.name,
              placeholder: formData.type === "personal" ? "Nguyễn Văn A" : "Công ty TNHH ABC",
            }
          )}

          {renderFormField(
            "Số điện thoại",
            formData.phone,
            (text) => {
              setFormData({ ...formData, phone: text });
              if (errors.phone) setErrors({ ...errors, phone: "" });
            },
            {
              required: true,
              error: errors.phone,
              placeholder: "0901234567",
              keyboardType: "phone-pad",
            }
          )}

          {renderFormField(
            "Email",
            formData.email,
            (text) => {
              setFormData({ ...formData, email: text });
              if (errors.email) setErrors({ ...errors, email: "" });
            },
            {
              error: errors.email,
              placeholder: "example@gmail.com",
              keyboardType: "email-address",
              autoCapitalize: "none",
            }
          )}

          {renderFormField(
            "Số CCCD",
            formData.cccd,
            (text) => {
              const numericText = text.replace(/[^0-9]/g, "");
              if (numericText.length <= 12) {
                setFormData({ ...formData, cccd: numericText });
                if (errors.cccd) setErrors({ ...errors, cccd: "" });
              }
            },
            {
              error: errors.cccd,
              placeholder: "123456789012",
              keyboardType: "number-pad",
              maxLength: 12,
            }
          )}
        </View>

        {formData.type === "business" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin doanh nghiệp</Text>

            {renderFormField(
              "Tên công ty",
              formData.company,
              (text) => {
                setFormData({ ...formData, company: text });
                if (errors.company) setErrors({ ...errors, company: "" });
              },
              {
                required: true,
                error: errors.company,
                placeholder: "Công ty TNHH ABC",
              }
            )}

            {renderFormField(
              "Mã số thuế",
              formData.taxCode,
              (text) => {
                setFormData({ ...formData, taxCode: text });
                if (errors.taxCode) setErrors({ ...errors, taxCode: "" });
              },
              {
                required: true,
                error: errors.taxCode,
                placeholder: "0123456789",
                keyboardType: "number-pad",
              }
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trạng thái</Text>
          <TouchableOpacity
            style={styles.statusDropdown}
            onPress={() => setShowStatusDropdown(true)}
            activeOpacity={0.8}
          >
            <View style={styles.statusDropdownLeft}>
              <View
                style={[styles.statusDot, { backgroundColor: getSelectedStatusColor() }]}
              />
              <Text style={styles.statusDropdownText}>
                {getSelectedStatusLabel()}
              </Text>
            </View>
            <ChevronDown color={Colors.textSecondary} size={18} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hình ảnh</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesRow}
          >
            <TouchableOpacity
              style={styles.addImageBtn}
              onPress={pickImages}
              activeOpacity={0.8}
              disabled={isPickingImage}
            >
              {isPickingImage ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <>
                  <ImagePlus color={Colors.primary} size={28} />
                  <Text style={styles.addImageText}>Thêm ảnh</Text>
                </>
              )}
            </TouchableOpacity>

            {formData.images.map((imageUri, index) => (
              <View key={index} style={styles.imageThumb}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imageThumbImg}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeImage(index)}
                  activeOpacity={0.8}
                >
                  <X color={Colors.white} size={14} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Save color={Colors.white} size={20} />
          <Text style={styles.saveButtonText}>Tạo khách hàng</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showStatusDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusDropdown(false)}
        >
          <View style={styles.statusModal}>
            <Text style={styles.statusModalTitle}>Chọn trạng thái</Text>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusModalOption,
                  formData.status === option.value && styles.statusModalOptionActive,
                ]}
                onPress={() => {
                  setFormData({ ...formData, status: option.value });
                  setShowStatusDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.statusModalOptionLeft}>
                  <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                  <Text style={styles.statusModalOptionText}>{option.label}</Text>
                </View>
                {formData.status === option.value && (
                  <Check color={Colors.primary} size={18} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showContactsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContactsModal(false)}
      >
        <View style={styles.contactsModalWrap}>
          <View style={styles.contactsModalContent}>
            <View style={styles.contactsModalHeader}>
              <Text style={styles.contactsModalTitle}>Chọn từ danh bạ</Text>
              <TouchableOpacity
                onPress={() => setShowContactsModal(false)}
                style={{ padding: 4 }}
              >
                <X color={Colors.text} size={22} />
              </TouchableOpacity>
            </View>
            <Text style={styles.contactsModalSubtitle}>
              Đã chọn: {selectedContacts.size} liên hệ
            </Text>
            <ScrollView style={styles.contactsList}>
              {phoneContacts.map((contact) => {
                const contactId =
                  (contact as any).id ?? `temp-${contact.name}-${Math.random()}`;
                const isSelected = selectedContacts.has(contactId);
                const phone =
                  contact.phoneNumbers?.[0]?.number || "Không có SĐT";
                const email = contact.emails?.[0]?.email || "Không có email";
                return (
                  <TouchableOpacity
                    key={contactId}
                    style={[
                      styles.contactListItem,
                      isSelected && styles.contactListItemActive,
                    ]}
                    onPress={() => toggleContactSelection(contactId)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.contactCheckbox,
                        isSelected && styles.contactCheckboxActive,
                      ]}
                    >
                      {isSelected && <Check color={Colors.white} size={14} />}
                    </View>
                    <View style={styles.contactItemInfo}>
                      <Text style={styles.contactItemName}>{contact.name}</Text>
                      <Text style={styles.contactItemDetail}>{phone}</Text>
                      <Text style={styles.contactItemDetail}>{email}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.contactsModalFooter}>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={importSelectedContacts}
                activeOpacity={0.8}
              >
                <Text style={styles.importBtnText}>Nhập đã chọn</Text>
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
    backgroundColor: "#F5F6F8",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 14,
  },
  contactsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(232,111,37,0.08)",
    borderRadius: 8,
    marginBottom: 14,
  },
  contactsBtnText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: "#F0F1F3",
    borderRadius: 10,
    padding: 3,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  typeOptionActive: {
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      web: { boxShadow: `0 2px 8px ${Colors.primary}40` },
    }),
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  typeOptionTextActive: {
    color: Colors.white,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  required: {
    color: "#EF4444",
  },
  fieldInput: {
    backgroundColor: "#F5F6F8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  fieldInputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  fieldError: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    marginLeft: 2,
  },
  statusDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F6F8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  statusDropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDropdownText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  imagesRow: {
    gap: 10,
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    backgroundColor: "rgba(232,111,37,0.06)",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addImageText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  imageThumb: {
    position: "relative" as const,
    width: 100,
    height: 100,
  },
  imageThumbImg: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  removeImageBtn: {
    position: "absolute" as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      web: { boxShadow: `0 3px 10px ${Colors.primary}40` },
    }),
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  statusModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: "0 4px 20px rgba(0,0,0,0.2)" },
    }),
  },
  statusModalTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 14,
    textAlign: "center" as const,
  },
  statusModalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  statusModalOptionActive: {
    backgroundColor: "#F5F6F8",
  },
  statusModalOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusModalOptionText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  contactsModalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  contactsModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: "0 -4px 20px rgba(0,0,0,0.15)" },
    }),
  },
  contactsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  contactsModalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  contactsModalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  contactsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F5F6F8",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  contactListItemActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(232,111,37,0.06)",
  },
  contactCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  contactCheckboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  contactItemInfo: {
    flex: 1,
  },
  contactItemName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 2,
  },
  contactItemDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  contactsModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  importBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      web: { boxShadow: `0 3px 10px ${Colors.primary}40` },
    }),
  },
  importBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
