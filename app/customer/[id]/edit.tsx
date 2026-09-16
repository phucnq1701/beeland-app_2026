import React, { useEffect, useState } from "react";
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
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
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
  Lock,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

export default function CustomerEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerCode, setCustomerCode] = useState("");

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
    // Đại diện pháp luật (nếu là doanh nghiệp)
    nguoiDaiDienPl: "",
    chucVu: "",
    nddDienThoai: "",
    nddEmail: "",
    nddSoCccd: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  const [sourceOptions, setSourceOptions] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [statuses, sources, detail] = await Promise.all([
          CustomerService.getTrangThaiCatalogs(),
          CustomerService.getNguonCatalogs(),
          id ? CustomerService.getCustomerDetailCloud(id) : null,
        ]);

        if (!isMounted) return;

        setStatusOptions(statuses);
        setSourceOptions(sources);

        if (detail) {
          setCustomerCode(detail.ma_so_kh || "");
          const isPersonal = detail.is_personal !== false;
          setFormData({
            isPersonal,
            name: (isPersonal ? detail.ten_kh : detail.ten_cong_ty) || detail.tenKH || "",
            phone: detail.diDong || detail.dien_thoai || "",
            phone2: detail.di_dong2 || "",
            email: detail.email || detail.email_ct || "",
            cccd: detail.cccd || detail.so_cmnd || "",
            taxCode: detail.ma_so_thue_ct || detail.ma_so_ttncn || "",
            diaChi: detail.diaChi || detail.dia_chi || detail.thuong_tru || detail.dia_chi_ct || "",
            statusId: detail.ma_tt_id || "",
            sourceId: detail.ma_nguon_id || "",
            notes: "",
            nguoiDaiDienPl: detail.nguoi_dai_dien_pl || "",
            chucVu: detail.chuc_vu || "",
            nddDienThoai: detail.ndd_dien_thoai || "",
            nddEmail: detail.ndd_email || "",
            nddSoCccd: detail.ndd_so_cccd || "",
          });
        }
      } catch (e) {
        console.log("Error loading customer edit data:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

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

  const handleSave = async () => {
    if (!validateForm() || !id) return;
    setSaving(true);

    try {
      const payload: any = {
        id,
        isPersonal: formData.isPersonal,
        tenKh: formData.name.trim(),
        tenCongTy: formData.isPersonal ? null : formData.name.trim(),
        diDong: formData.phone.trim(),
        diDong2: formData.phone2.trim() || null,
        email: formData.email.trim() || null,
        cccd: formData.cccd.trim() || null,
        diaChi: formData.diaChi.trim() || null,
        taxCode: formData.taxCode.trim() || null,
        maTtId: formData.statusId || null,
        maNguonId: formData.sourceId || null,
        nguoiDaiDienPl: !formData.isPersonal ? formData.nguoiDaiDienPl.trim() || null : null,
        chucVu: !formData.isPersonal ? formData.chucVu.trim() || null : null,
        nddDienThoai: !formData.isPersonal ? formData.nddDienThoai.trim() || null : null,
        nddEmail: !formData.isPersonal ? formData.nddEmail.trim() || null : null,
        nddSoCccd: !formData.isPersonal ? formData.nddSoCccd.trim() || null : null,
      };

      const res = await CustomerService.saveCustomerCloud(payload);

      if (res?.status === 2000) {
        const msg = "Cập nhật thông tin khách hàng thành công!";
        if (Platform.OS === "web") {
          alert(msg);
          router.back();
        } else {
          Alert.alert("Thành công", msg, [{ text: "OK", onPress: () => router.back() }]);
        }
      } else {
        const errorMsg = res?.message || "Cập nhật thất bại, vui lòng thử lại";
        if (Platform.OS === "web") {
          alert(errorMsg);
        } else {
          Alert.alert("Lỗi", errorMsg);
        }
      }
    } catch (err: any) {
      console.log("Error save customer edit:", err);
      Alert.alert("Lỗi", "Đã xảy ra sự cố khi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang tải thông tin...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

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
          <Text style={styles.headerTitle}>Sửa thông tin khách hàng</Text>
          {customerCode ? (
            <Text style={styles.headerSubtitle}>Mã: {customerCode}</Text>
          ) : (
            <Text style={styles.headerSubtitle}>Cập nhật thông tin</Text>
          )}
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
          {/* Mã khách hàng cố định */}
          {customerCode ? (
            <View style={styles.codeBanner}>
              <Lock size={16} color="#64748B" />
              <Text style={styles.codeBannerText}>
                Mã khách hàng: <Text style={styles.codeHighlight}>{customerCode}</Text> (Cố định)
              </Text>
            </View>
          ) : null}

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

          {/* 1. Họ tên / Tên công ty */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {formData.isPersonal ? "Họ và tên khách hàng" : "Tên doanh nghiệp / Công ty"}{" "}
              <Text style={styles.requiredMark}>*</Text>
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
              {formData.isPersonal ? "Số CCCD / CMND" : "Mã số thuế (MST)"}{" "}
              {!formData.isPersonal && <Text style={styles.requiredMark}>*</Text>}
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

          {/* Trường mở rộng cho Doanh nghiệp */}
          {!formData.isPersonal && (
            <View style={styles.corpSection}>
              <Text style={styles.corpSectionTitle}>Người đại diện pháp luật</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Họ tên người đại diện</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color={Colors.textSecondary} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#9CA3AF"
                    value={formData.nguoiDaiDienPl}
                    onChangeText={(text) => setFormData({ ...formData, nguoiDaiDienPl: text })}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Chức vụ</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Giám đốc / Tổng GĐ"
                      placeholderTextColor="#9CA3AF"
                      value={formData.chucVu}
                      onChangeText={(text) => setFormData({ ...formData, chucVu: text })}
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>SĐT người ĐD</Text>
                  <View style={styles.inputWrapper}>
                    <Phone size={18} color={Colors.textSecondary} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="0912345678"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={formData.nddDienThoai}
                      onChangeText={(text) => setFormData({ ...formData, nddDienThoai: text })}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

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

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.bottomSubmitBtn, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.bottomSubmitText}>Lưu thay đổi</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  codeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  codeBannerText: {
    fontSize: 13,
    color: "#475569",
  },
  codeHighlight: {
    fontWeight: "700",
    color: Colors.text,
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
  corpSection: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  corpSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
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