import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Save,
  User,
  Building2,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

export default function CustomerNewScreen() {
  const router = useRouter();
  const { dataBooking, returnToBooking } = useLocalSearchParams();
  const isReturningToBooking = String(returnToBooking) === "1";
  const bookingParam = typeof dataBooking === "string" ? dataBooking : "";

  // 7 trường cốt lõi tối ưu cho Mobile App:
  // 1. Loại khách (Cá nhân / Doanh nghiệp)
  // 2. Họ tên / Tên công ty
  // 3. Số điện thoại (chính + phụ)
  // 4. Email
  // 5. CCCD / MST
  // 6. Nguồn khách & Trạng thái
  // 7. Địa chỉ & Ghi chú nhanh
  const [formData, setFormData] = useState({
    isPersonal: true,
    name: "",
    phone: "",
    phone2: "",
    email: "",
    cccd: "",
    taxCode: "",
    diaChi: "",
    statusId: "" as string,
    sourceId: "" as string,
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  const [sourceOptions, setSourceOptions] = useState<any[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [saving, setSaving] = useState(false);

  // Duplicate Check State
  const [duplicateCustomer, setDuplicateCustomer] = useState<any>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Load catalogs (Trạng thái, Nguồn khách) từ Supabase cloud_catalogs
  useEffect(() => {
    let isMounted = true;
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      try {
        const [statuses, sources] = await Promise.all([
          CustomerService.getTrangThaiCatalogs(),
          CustomerService.getNguonCatalogs(),
        ]);
        if (isMounted) {
          setStatusOptions(statuses);
          setSourceOptions(sources);
          if (statuses.length > 0) {
            setFormData((prev) => ({ ...prev, statusId: statuses[0].value || statuses[0].id }));
          }
          if (sources.length > 0) {
            setFormData((prev) => ({ ...prev, sourceId: sources[0].value || sources[0].id }));
          }
        }
      } catch (e) {
        console.log("Error loading catalogs in customer new:", e);
      } finally {
        if (isMounted) setLoadingCatalogs(false);
      }
    };
    loadCatalogs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Tự động kiểm tra trùng khi nhập xong SĐT hoặc CCCD (debounce 500ms)
  useEffect(() => {
    const cleanPhone = formData.phone.trim();
    const cleanCccd = formData.cccd.trim();

    if (cleanPhone.length < 9 && cleanCccd.length < 9) {
      setDuplicateCustomer(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const dup = await CustomerService.checkDuplicateCustomer({
          phone: cleanPhone.length >= 9 ? cleanPhone : undefined,
          cccd: cleanCccd.length >= 9 ? cleanCccd : undefined,
        });
        setDuplicateCustomer(dup);
      } catch (e) {
        console.log("Duplicate check error:", e);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.phone, formData.cccd]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = formData.isPersonal ? "Vui lòng nhập họ và tên" : "Vui lòng nhập tên công ty";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^[0-9+.\-\s]{8,15}$/.test(formData.phone.trim())) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Email không đúng định dạng";
    }
    if (!formData.isPersonal && !formData.taxCode.trim()) {
      newErrors.taxCode = "Vui lòng nhập mã số thuế công ty";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUseExistingCustomer = (cust: any) => {
    if (isReturningToBooking) {
      router.replace({
        pathname: "/booking/create",
        params: {
          dataBooking: bookingParam,
          createdCustomer: JSON.stringify(cust),
        },
      });
    } else {
      router.replace(`/customer/${cust.id}`);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    try {
      const payload: any = {
        isPersonal: formData.isPersonal,
        tenKh: formData.name.trim(),
        tenCongTy: formData.isPersonal ? null : formData.name.trim(),
        diDong: formData.phone.trim(),
        diDong2: formData.phone2.trim() || null,
        email: formData.email.trim() || null,
        cccd: formData.cccd.trim() || null,
        diaChi: formData.diaChi.trim() || null,
        taxCode: formData.isPersonal ? null : formData.taxCode.trim() || null,
        maTtId: formData.statusId || null,
        maNguonId: formData.sourceId || null,
      };

      const res = await CustomerService.saveCustomerCloud(payload);

      if (res?.status === 2000 && res.data) {
        // Nếu có ghi chú ban đầu, thêm vào activities
        if (formData.notes.trim() && res.data.id) {
          try {
            await CustomerService.addCustomerActivity({
              customerId: res.data.id,
              content: formData.notes.trim(),
              title: "Ghi chú ban đầu khi tạo khách",
            });
          } catch {}
        }

        if (isReturningToBooking) {
          router.replace({
            pathname: "/booking/create",
            params: {
              dataBooking: bookingParam,
              createdCustomer: JSON.stringify(res.data),
            },
          });
          return;
        }

        const msg = "Tạo mới khách hàng thành công!";
        if (Platform.OS === "web") {
          alert(msg);
          router.back();
        } else {
          Alert.alert("Thành công", msg, [{ text: "OK", onPress: () => router.back() }]);
        }
      } else if ((res as any)?.needLogin) {
        // Hết phiên đăng nhập (dù đã đăng nhập web, app mobile cần phiên riêng)
        const errorMsg = res?.message || "Chưa đăng nhập hoặc phiên đã hết hạn";
        if (Platform.OS === "web") {
          alert(errorMsg);
          router.replace("/login" as any);
        } else {
          Alert.alert("Thông báo", errorMsg, [
            { text: "Để sau", style: "cancel" },
            { text: "Đăng nhập lại", onPress: () => router.replace("/login" as any) },
          ]);
        }
      } else {
        const errorMsg = res?.message || "Không thể tạo khách hàng, vui lòng thử lại";
        if (Platform.OS === "web") {
          alert(errorMsg);
        } else {
          Alert.alert("Thông báo", errorMsg);
        }
      }
    } catch (err: any) {
      console.log("Error create customer:", err);
      Alert.alert("Lỗi", "Đã xảy ra sự cố khi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Thêm khách hàng</Text>
          <Text style={styles.headerSubtitle}>Thông tin nhanh cho môi giới</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Save size={18} color="#FFF" />
              <Text style={styles.saveHeaderText}>Lưu</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Loại khách hàng */}
          <View style={styles.typeSelectorContainer}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                formData.isPersonal && styles.typeOptionActive,
              ]}
              onPress={() => setFormData({ ...formData, isPersonal: true })}
              activeOpacity={0.8}
            >
              <User
                size={18}
                color={formData.isPersonal ? "#FFF" : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  formData.isPersonal && styles.typeOptionTextActive,
                ]}
              >
                Cá nhân
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeOption,
                !formData.isPersonal && styles.typeOptionActive,
              ]}
              onPress={() => setFormData({ ...formData, isPersonal: false })}
              activeOpacity={0.8}
            >
              <Building2
                size={18}
                color={!formData.isPersonal ? "#FFF" : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  !formData.isPersonal && styles.typeOptionTextActive,
                ]}
              >
                Doanh nghiệp
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cảnh báo trùng khách hàng */}
          {duplicateCustomer && (
            <View style={styles.duplicateCard}>
              <View style={styles.duplicateHeader}>
                <AlertCircle size={20} color="#D97706" />
                <Text style={styles.duplicateTitle}>Khách hàng đã tồn tại</Text>
              </View>
              <Text style={styles.duplicateInfo}>
                Hệ thống tìm thấy hồ sơ: <Text style={styles.duplicateBold}>{duplicateCustomer.tenKH}</Text> (
                {duplicateCustomer.diDong || duplicateCustomer.cccd})
              </Text>
              <TouchableOpacity
                style={styles.duplicateActionBtn}
                onPress={() => handleUseExistingCustomer(duplicateCustomer)}
                activeOpacity={0.8}
              >
                <CheckCircle2 size={16} color="#FFF" />
                <Text style={styles.duplicateActionText}>
                  {isReturningToBooking ? "Chọn khách hàng này cho Booking" : "Xem hồ sơ khách hàng cũ"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 1. Họ tên / Tên công ty */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {formData.isPersonal ? "Họ và tên khách hàng" : "Tên doanh nghiệp / Công ty"} <Text style={styles.requiredMark}>*</Text>
            </Text>
            <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
              {formData.isPersonal ? (
                <User size={20} color={Colors.textSecondary} />
              ) : (
                <Building2 size={20} color={Colors.textSecondary} />
              )}
              <TextInput
                style={styles.textInput}
                placeholder={formData.isPersonal ? "Nguyễn Văn A" : "Công ty TNHH Đầu tư..."}
                placeholderTextColor="#9CA3AF"
                value={formData.name}
                onChangeText={(text) => {
                  setFormData({ ...formData, name: text });
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* 2. Số điện thoại */}
          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>
                Số điện thoại chính <Text style={styles.requiredMark}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                <Phone size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  placeholder="0912345678"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={formData.phone}
                  onChangeText={(text) => {
                    setFormData({ ...formData, phone: text });
                    if (errors.phone) setErrors({ ...errors, phone: "" });
                  }}
                />
                {checkingDuplicate && <ActivityIndicator size="small" color={Colors.primary} />}
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.inputLabel}>SĐT phụ (nếu có)</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.textInput}
                  placeholder="0987654321"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={formData.phone2}
                  onChangeText={(text) => setFormData({ ...formData, phone2: text })}
                />
              </View>
            </View>
          </View>

          {/* 3. Email & CCCD/MST */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
              <Mail size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.textInput}
                placeholder="example@gmail.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) => {
                  setFormData({ ...formData, email: text });
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {formData.isPersonal ? "Số CCCD / CMND" : "Mã số thuế (MST)"} {!formData.isPersonal && <Text style={styles.requiredMark}>*</Text>}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                !formData.isPersonal && errors.taxCode && styles.inputError,
              ]}
            >
              <CreditCard size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.textInput}
                placeholder={formData.isPersonal ? "12 số CCCD" : "Mã số thuế doanh nghiệp"}
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={formData.isPersonal ? formData.cccd : formData.taxCode}
                onChangeText={(text) => {
                  if (formData.isPersonal) {
                    setFormData({ ...formData, cccd: text });
                  } else {
                    setFormData({ ...formData, taxCode: text });
                    if (errors.taxCode) setErrors({ ...errors, taxCode: "" });
                  }
                }}
              />
            </View>
            {!formData.isPersonal && errors.taxCode ? (
              <Text style={styles.errorText}>{errors.taxCode}</Text>
            ) : null}
          </View>

          {/* 4. Trạng thái & Nguồn khách */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Phân loại khách hàng</Text>
          </View>

          {/* Trạng thái */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Trạng thái</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
              {statusOptions.map((st) => {
                const isSelected = (formData.statusId || "") === String(st.value || st.id);
                return (
                  <TouchableOpacity
                    key={String(st.id || st.value)}
                    style={[
                      styles.tagChip,
                      isSelected && {
                        backgroundColor: (st.color || Colors.primary) + "18",
                        borderColor: st.color || Colors.primary,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, statusId: String(st.value || st.id) })}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.tagDot,
                        { backgroundColor: st.color || Colors.primary },
                      ]}
                    />
                    <Text
                      style={[
                        styles.tagChipText,
                        isSelected && { color: st.color || Colors.primary, fontWeight: "600" },
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Nguồn khách */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nguồn khách</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
              {sourceOptions.map((src) => {
                const isSelected = (formData.sourceId || "") === String(src.value || src.id);
                return (
                  <TouchableOpacity
                    key={String(src.id || src.value)}
                    style={[
                      styles.tagChip,
                      isSelected && styles.tagChipActive,
                    ]}
                    onPress={() => setFormData({ ...formData, sourceId: String(src.value || src.id) })}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        isSelected && styles.tagChipTextActive,
                      ]}
                    >
                      {src.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. Địa chỉ */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Địa chỉ liên hệ</Text>
            <View style={styles.inputWrapper}>
              <MapPin size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.textInput}
                placeholder="Số nhà, đường, phường, quận..."
                placeholderTextColor="#9CA3AF"
                value={formData.diaChi}
                onChangeText={(text) => setFormData({ ...formData, diaChi: text })}
              />
            </View>
          </View>

          {/* 6. Ghi chú & Nhu cầu nhanh */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nhu cầu / Ghi chú ban đầu</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
              <FileText size={18} color={Colors.textSecondary} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Khách quan tâm căn 2PN, ngân sách 3 tỷ, cần vay ngân hàng..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
              />
            </View>
          </View>

          {/* Action Button dưới cùng */}
          <TouchableOpacity
            style={[styles.bottomSubmitBtn, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.bottomSubmitText}>Tạo khách hàng</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  saveHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  saveHeaderText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  typeSelectorContainer: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  typeOptionActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  typeOptionTextActive: {
    color: "#FFFFFF",
  },
  duplicateCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  duplicateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  duplicateTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
  },
  duplicateInfo: {
    fontSize: 13,
    color: "#78350F",
    lineHeight: 18,
    marginBottom: 10,
  },
  duplicateBold: {
    fontWeight: "700",
  },
  duplicateActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D97706",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  duplicateActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  inputGroup: {
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 6,
  },
  requiredMark: {
    color: "#EF4444",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    gap: 10,
  },
  textAreaWrapper: {
    alignItems: "flex-start",
    paddingVertical: 10,
    minHeight: 88,
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 8,
  },
  textAreaInput: {
    minHeight: 68,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    marginLeft: 2,
  },
  tagScroll: {
    flexDirection: "row",
    marginHorizontal: -4,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    gap: 6,
  },
  tagChipActive: {
    backgroundColor: Colors.primary + "15",
    borderColor: Colors.primary,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  tagChipTextActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  bottomSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomSubmitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});