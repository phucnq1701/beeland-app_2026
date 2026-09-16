import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Plus,
  Edit2,
  FileText,
  ChevronRight,
  ScrollText,
  Trash2,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { Format_Date } from "@/components/utils/common";

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [customer, setCustomer] = useState<any>(null);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);

  const [newHistory, setNewHistory] = useState({
    title: "",
    content: "",
  });

  const getCustomer = useCallback(async () => {
    try {
      if (!id) return;
      const detail = await CustomerService.getCustomerDetailCloud(String(id));
      if (detail) {
        const isPersonal = detail.is_personal !== false;
        setCustomer({
          id: detail.id,
          maSoKh: detail.ma_so_kh,
          name: (isPersonal ? detail.ten_kh : detail.ten_cong_ty) || detail.tenKH || "",
          phone: detail.diDong || detail.dien_thoai || "",
          phone2: detail.di_dong2 || "",
          email: detail.email || detail.email_ct || "",
          company: !isPersonal
            ? detail.ten_cong_ty || detail.cty?.ten_ct_vt || detail.cty?.ten_ct || ""
            : detail.tenSan || detail.cty?.ten_ct_vt || detail.cty?.ten_ct || "",
          cccd: detail.cccd || detail.so_cmnd || "",
          taxCode: detail.ma_so_thue_ct || detail.ma_so_ttncn || "",
          isPersonal,
          type: isPersonal ? "personal" : "business",
          status: detail.tenTT || "Đang giao dịch",
          statusColor: detail.statusColor || Colors.primary,
          source: detail.tenNguon || "",
          diaChi: detail.diaChi || detail.dia_chi || detail.thuong_tru || detail.dia_chi_ct || "",
          nguoiDaiDienPl: detail.nguoi_dai_dien_pl,
          chucVu: detail.chuc_vu,
        });
      }
    } catch (err) {
      console.log("Error get customer detail:", err);
    }
  }, [id]);

  const getNotes = useCallback(async () => {
    try {
      if (!id) return;
      const activities = await CustomerService.getCustomerActivities(String(id));
      setWorkHistory(activities || []);
    } catch (err) {
      console.log(err);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        void getCustomer();
        void getNotes();
      }
    }, [id, getCustomer, getNotes])
  );

  const handleAddHistory = async () => {
    if (!newHistory.content.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập nội dung chăm sóc");
      return;
    }
    const result = await CustomerService.addCustomerActivity({
      customerId: String(id),
      content: newHistory.content,
      title: newHistory.title || "Chăm sóc khách hàng",
    });
    if (result?.status === 2000) {
      void getNotes();
      setShowAddHistoryModal(false);
      setNewHistory({ title: "", content: "" });
      Alert.alert("Thành công", "Đã thêm nhật ký chăm sóc");
    } else {
      Alert.alert("Thất bại", result?.message || "Không thể lưu nhật ký");
    }
  };


  const handleDeleteCustomer = () => {
    Alert.alert(
      "Xác nhận xoá",
      `Bạn có chắc muốn xoá khách hàng "${customer?.name || ""}"?`,
      [
        { text: "Hu", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            const res = await CustomerService.deleteCustomer(String(id));
            if (res.status === 2000) {
              Alert.alert("Thành công", "Đã xoá khách hàng", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } else {
              Alert.alert("Không thể xoá", res.message);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ["#E86F25", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B", "#06B6D4"];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (!customer) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Chi tiết khách hàng",
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: Colors.white,
          }}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  const avatarBg = getAvatarColor(customer.name);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Chi tiết khách hàng",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <TouchableOpacity
                onPress={() => router.push(`/customer/${customer.id}/edit`)}
                style={{ padding: 4 }}
              >
                <Edit2 color={Colors.white} size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteCustomer} style={{ padding: 4 }}>
                <Trash2 color={Colors.white} size={20} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarLargeText}>
              {getInitials(customer.name)}
            </Text>
          </View>
          <Text style={styles.profileName}>{customer.name}</Text>
          {customer.company ? (
            <Text style={styles.profileCompany}>{customer.company}</Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {customer.maSoKh ? (
              <View style={[styles.statusChip, { backgroundColor: "#F1F5F9" }]}>
                <Text style={[styles.statusLabel, { color: "#475569" }]}>Mã: {customer.maSoKh}</Text>
              </View>
            ) : null}
            <View style={[styles.statusChip, { backgroundColor: (customer.statusColor || Colors.primary) + "18" }]}>
              <View style={[styles.statusDot, { backgroundColor: customer.statusColor || Colors.primary }]} />
              <Text style={[styles.statusLabel, { color: customer.statusColor || Colors.primary }]}>
                {customer.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.contactCards}>
          {customer.phone ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(232,111,37,0.1)" }]}>
                <Phone color={Colors.primary} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Điện thoại chính</Text>
                <Text style={styles.contactCardValue}>{customer.phone}</Text>
              </View>
            </View>
          ) : null}

          {customer.phone2 ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(232,111,37,0.06)" }]}>
                <Phone color={Colors.textSecondary} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Điện thoại phụ</Text>
                <Text style={styles.contactCardValue}>{customer.phone2}</Text>
              </View>
            </View>
          ) : null}

          {customer.email ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
                <Mail color={Colors.accent.blue} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Email</Text>
                <Text style={styles.contactCardValue}>{customer.email}</Text>
              </View>
            </View>
          ) : null}

          {customer.cccd ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(139,92,246,0.1)" }]}>
                <FileText color={Colors.accent.purple} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Số CCCD / CMND</Text>
                <Text style={styles.contactCardValue}>{customer.cccd}</Text>
              </View>
            </View>
          ) : null}

          {customer.taxCode ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(245,158,11,0.1)" }]}>
                <FileText color="#F59E0B" size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>{customer.isPersonal ? "Mã số thuế TNCN" : "Mã số thuế doanh nghiệp"}</Text>
                <Text style={styles.contactCardValue}>{customer.taxCode}</Text>
              </View>
            </View>
          ) : null}

          {customer.source ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(16,185,129,0.1)" }]}>
                <FileText color={Colors.accent.green} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Nguồn khách</Text>
                <Text style={styles.contactCardValue}>{customer.source}</Text>
              </View>
            </View>
          ) : null}

          {customer.diaChi ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(16,185,129,0.1)" }]}>
                <MapPin color={Colors.accent.green} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Địa chỉ</Text>
                <Text style={styles.contactCardValue}>{customer.diaChi}</Text>
              </View>
            </View>
          ) : null}

          {!customer.isPersonal && customer.nguoiDaiDienPl ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
                <FileText color={Colors.accent.blue} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Người đại diện PL</Text>
                <Text style={styles.contactCardValue}>{customer.nguoiDaiDienPl} {customer.chucVu ? `(${customer.chucVu})` : ""}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.contractBtn}
          activeOpacity={0.7}
          onPress={() => router.push(`/customer/${customer.id}/contracts`)}
          testID="contract-history-btn"
        >
          <View style={styles.contractBtnLeft}>
            <View style={[styles.contactIcon, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
              <ScrollText color={Colors.accent.blue} size={18} />
            </View>
            <View>
              <Text style={styles.contractBtnTitle}>Lịch sử hợp đồng</Text>
              <Text style={styles.contractBtnDesc}>Xem danh sách hợp đồng</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textTertiary} size={20} />
        </TouchableOpacity>

        <View style={[styles.sectionWrap, { marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FileText color={Colors.accent.purple} size={18} />
              <Text style={styles.sectionTitle}>Nhật ký chăm sóc</Text>
              <View style={[styles.badge, { backgroundColor: "rgba(139,92,246,0.1)" }]}>
                <Text style={[styles.badgeText, { color: Colors.accent.purple }]}>
                  {workHistory.length}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddHistoryModal(true)}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Plus color={Colors.white} size={16} />
              <Text style={styles.addBtnText}>Thêm</Text>
            </TouchableOpacity>
          </View>

          {workHistory.length === 0 ? (
            <View style={styles.emptySection}>
              <FileText color={Colors.textTertiary} size={32} />
              <Text style={styles.emptySectionText}>Chưa có nhật ký chăm sóc</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {workHistory.map((item) => (
                <View
                  key={item.id}
                  style={styles.historyCard}
                >
                  <View style={styles.historyTop}>
                    <View style={styles.historyStatusChip}>
                      <Text style={styles.historyStatusText}>{item.tieuDe || "Chăm sóc KH"}</Text>
                    </View>
                    <Text style={styles.historyDate}>
                      {item.thoiGian ? Format_Date(item.thoiGian) : ""}
                    </Text>
                  </View>
                  <Text style={styles.historyContent}>
                    {item.noiDung}
                  </Text>
                  {item.nguoiThucHien ? (
                    <Text style={[styles.historyDate, { marginTop: 4, color: Colors.textSecondary }]}>
                      Người xử lý: {item.nguoiThucHien}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showAddHistoryModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAddHistoryModal(false);
              setNewHistory({ title: "", content: "" });
            }}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Thêm nhật ký chăm sóc</Text>

              <Text style={styles.modalLabel}>Tiêu đề</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ví dụ: Gọi điện tư vấn, Gặp trao đổi..."
                placeholderTextColor={Colors.textTertiary}
                value={newHistory.title}
                onChangeText={(t) => setNewHistory({ ...newHistory, title: t })}
              />

              <Text style={styles.modalLabel}>Nội dung chăm sóc *</Text>
              <TextInput
                style={[styles.modalInput, { height: 120, textAlignVertical: "top" }]}
                placeholder="Nhập nội dung trao đổi với khách hàng..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                value={newHistory.content}
                onChangeText={(t) => setNewHistory({ ...newHistory, content: t })}
              />

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddHistory}>
                <Text style={styles.modalSaveBtnText}>Lưu nhật ký</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  scrollView: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  profileHeader: {
    backgroundColor: Colors.white,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 4px 12px rgba(0,0,0,0.06)" },
    }),
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarLargeText: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
    textAlign: "center",
  },
  profileCompany: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#10B981",
  },
  contactCards: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
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
  contactCardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  contactIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  contactCardContent: {
    flex: 1,
  },
  contactCardLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
    marginBottom: 2,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  contactCardValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  contractBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  contractBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contractBtnTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  contractBtnDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  sectionWrap: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  badge: {
    backgroundColor: "rgba(232,111,37,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      web: { boxShadow: `0 2px 6px ${Colors.primary}40` },
    }),
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  emptySection: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptySectionText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  appointmentList: {
    gap: 8,
  },
  appointmentCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      web: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
    }),
  },
  appointmentContent: {
    flex: 1,
  },
  appointmentLeft: {
    gap: 4,
  },
  appointmentDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59,130,246,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  appointmentDateText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.accent.blue,
  },
  appointmentTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  appointmentDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  appointmentDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  historyList: {
    gap: 8,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.purple,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      web: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
    }),
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyStatusChip: {
    backgroundColor: "rgba(139,92,246,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.accent.purple,
  },
  historyContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  modalDropdown: {
    backgroundColor: "#F5F6F8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  modalInput: {
    backgroundColor: "#F5F6F8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
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
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
