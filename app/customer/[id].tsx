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
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  FileText,
  ChevronRight,
  ScrollText,
} from "lucide-react-native";
import { Dropdown } from "react-native-element-dropdown";
import Colors from "@/constants/colors";
import { CustomerService } from "../sevices/CustomerService";
import { CongViecService } from "../sevices/CongViecService";
import { Format_Date } from "@/components/utils/common";
import DateTimePicker from "@react-native-community/datetimepicker";

interface Appointment {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  status: "upcoming" | "completed" | "cancelled";
  notes?: string;
  dienGiai?: string;
}

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [customer, setCustomer] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [trangThaiKH, setTrangThaiKH] = useState<any[]>([]);
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [newAppointment, setNewAppointment] = useState({
    tieuDe: "",
    dienGiai: "",
    ngayHen: "",
    ngayHenAPI: "",
    maLH: null as string | null,
  });

  const [newHistory, setNewHistory] = useState({
    content: "",
    status: null as string | null,
    id: null as string | null,
  });

  const loadDataExtra = async () => {
    const result = await CustomerService.getTrangThaiKH();
    setTrangThaiKH(result?.data ?? []);
  };

  useEffect(() => {
    void loadDataExtra();
  }, []);

  const getCustomer = useCallback(async () => {
    try {
      const res = await CustomerService.getCustomer({ MaKH: id });
      if (res?.data?.length) {
        const item = res.data[0];
        setCustomer({
          id: item.maKH,
          name: item.tenKH || "",
          phone: item.diDong || "",
          email: item.email || "",
          company: item.tenQD || "",
          taxCode: "",
          type: "personal",
          status: "active",
          images: [],
          projects: [],
          diaChi: item.diaChi || "",
        });
      }
    } catch (err) {
      console.log(err);
    }
  }, [id]);

  const getAppointments = useCallback(async () => {
    try {
      const res = await CustomerService.getLichHenByMaKH({
        MaKH: id,
        TuNgay: "2000-01-01",
        DenNgay: "2100-01-01",
        InputString: "",
        Home: 0,
      });
      if (res?.data?.length) {
        const data = res.data.map((item: any) => ({
          id: item.maLH?.toString(),
          date: item.ngayHen?.split("T")[0],
          time: item.ngayHen?.split("T")[1]?.substring(0, 5) || "",
          title: item.tieuDe || "Lịch hẹn",
          location: item.diaDiem || "",
          status: "upcoming" as const,
          notes: item.ghiChu || "",
          dienGiai: item?.dienGiai,
        }));
        setAppointments(data);
      } else {
        setAppointments([]);
      }
    } catch (err) {
      console.log(err);
    }
  }, [id]);

  const getNotes = useCallback(async () => {
    try {
      const res = await CustomerService.getGhiChunByMaKH({ MaKH: id });
      if (res?.data?.length) {
        setWorkHistory(res?.data);
      } else {
        setWorkHistory([]);
      }
    } catch (err) {
      console.log(err);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        void getCustomer();
        void getAppointments();
        void getNotes();
      }
    }, [id, getCustomer, getAppointments, getNotes])
  );

  const handleAddHistory = async () => {
    if (!newHistory.status || !newHistory.content.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin");
      return;
    }
    const payload = {
      DienGiai: newHistory?.content,
      MaTT: newHistory?.status,
      MaKH: id,
      ID: newHistory?.id ?? null,
    };
    const result = await CongViecService.addGhiChuCV(payload);
    if (result?.status === 2000) {
      void getNotes();
      setShowAddHistoryModal(false);
      setNewHistory({ content: "", status: null, id: null });
      Alert.alert("Thành công", result?.message);
    } else {
      Alert.alert("Thất bại", result?.message);
    }
  };

  const formatDateVN = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const formatDateAPI = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  };

  const onChangeDate = (event: any, selectedDate: any) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setNewAppointment((prev) => ({
        ...prev,
        ngayHen: formatDateVN(selectedDate),
        ngayHenAPI: formatDateAPI(selectedDate),
      }));
    }
  };

  const handleAddAppointment = async () => {
    if (!newAppointment.tieuDe || !newAppointment.ngayHen) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin");
      return;
    }
    const payload = {
      TieuDe: newAppointment.tieuDe,
      DienGiai: newAppointment.dienGiai,
      MaKH: id,
      MaLH: newAppointment.maLH ?? null,
      NgayHen: newAppointment.ngayHenAPI,
    };
    try {
      const result = await CongViecService.addLichHen(payload);
      if (result?.status === 2000) {
        void getAppointments();
        setShowAddAppointmentModal(false);
        setNewAppointment({ tieuDe: "", dienGiai: "", ngayHen: "", ngayHenAPI: "", maLH: null });
        Alert.alert("Thành công", result?.message);
      } else {
        Alert.alert("Thất bại", result?.message);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleEditAppointment = (item: Appointment) => {
    const dateObj = new Date(item.date + "T" + item.time);
    setNewAppointment({
      tieuDe: item.title,
      dienGiai: item.dienGiai || "",
      ngayHen: formatDateVN(dateObj),
      ngayHenAPI: formatDateAPI(dateObj),
      maLH: item.id,
    });
    setShowAddAppointmentModal(true);
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn xoá lịch hẹn này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          const result = await CustomerService.addLichHen({ MaLH: appointmentId, MaKH: id, Delete: true });
          if (result?.status === 2000) {
            void getAppointments();
            Alert.alert("Thành công", "Đã xoá lịch hẹn");
          } else {
            Alert.alert("Lỗi", result?.message);
          }
        },
      },
    ]);
  };

  const handleEditHistory = (item: any) => {
    setNewHistory({
      content: item.dienGiai,
      status: item.maTT,
      id: item.id,
    });
    setShowAddHistoryModal(true);
  };

  const trangThaiOptions = trangThaiKH.map((item) => ({
    label: item.tenTT,
    value: item.maTT,
  }));

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
            <TouchableOpacity
              onPress={() => router.push(`/customer/${customer.id}/edit`)}
              style={{ padding: 4 }}
            >
              <Edit2 color={Colors.white} size={20} />
            </TouchableOpacity>
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
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>Khách hàng</Text>
          </View>
        </View>

        <View style={styles.contactCards}>
          {customer.phone ? (
            <View style={styles.contactCardItem}>
              <View style={[styles.contactIcon, { backgroundColor: "rgba(232,111,37,0.1)" }]}>
                <Phone color={Colors.primary} size={18} />
              </View>
              <View style={styles.contactCardContent}>
                <Text style={styles.contactCardLabel}>Điện thoại</Text>
                <Text style={styles.contactCardValue}>{customer.phone}</Text>
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

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Calendar color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Lịch hẹn</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{appointments.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddAppointmentModal(true)}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Plus color={Colors.white} size={16} />
              <Text style={styles.addBtnText}>Thêm</Text>
            </TouchableOpacity>
          </View>

          {appointments.length === 0 ? (
            <View style={styles.emptySection}>
              <Calendar color={Colors.textTertiary} size={32} />
              <Text style={styles.emptySectionText}>Chưa có lịch hẹn</Text>
            </View>
          ) : (
            <View style={styles.appointmentList}>
              {appointments.map((item) => (
                <View key={item.id} style={styles.appointmentCard}>
                  <TouchableOpacity
                    style={styles.appointmentContent}
                    onPress={() => handleEditAppointment(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.appointmentLeft}>
                      <View style={styles.appointmentDateBadge}>
                        <Clock color={Colors.accent.blue} size={12} />
                        <Text style={styles.appointmentDateText}>
                          {item.date} · {item.time}
                        </Text>
                      </View>
                      <Text style={styles.appointmentTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.dienGiai ? (
                        <Text style={styles.appointmentDesc} numberOfLines={2}>
                          {item.dienGiai}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteAppointment(item.id)}
                    style={styles.appointmentDeleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.sectionWrap, { marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FileText color={Colors.accent.purple} size={18} />
              <Text style={styles.sectionTitle}>Lịch sử làm việc</Text>
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
              <Text style={styles.emptySectionText}>Chưa có lịch sử</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {workHistory.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() => handleEditHistory(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyTop}>
                    <View style={styles.historyStatusChip}>
                      <Text style={styles.historyStatusText}>{item.tenTT}</Text>
                    </View>
                    <Edit2 size={14} color={Colors.textTertiary} />
                  </View>
                  <Text style={styles.historyContent} numberOfLines={3}>
                    {item.dienGiai}
                  </Text>
                  <Text style={styles.historyDate}>
                    {Format_Date(item.ngayCN)}
                  </Text>
                </TouchableOpacity>
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
              setNewHistory({ content: "", status: null, id: null });
            }}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {newHistory.id ? "Sửa lịch sử làm việc" : "Thêm lịch sử làm việc"}
              </Text>

              <Text style={styles.modalLabel}>Trạng thái</Text>
              <Dropdown
                style={styles.modalDropdown}
                data={trangThaiOptions}
                labelField="label"
                valueField="value"
                placeholder="Chọn trạng thái công việc"
                placeholderStyle={{ color: Colors.textTertiary, fontSize: 14 }}
                selectedTextStyle={{ color: Colors.text, fontSize: 14 }}
                value={newHistory.status}
                onChange={(item: any) =>
                  setNewHistory((prev) => ({ ...prev, status: item.value }))
                }
              />

              <Text style={styles.modalLabel}>Nội dung</Text>
              <TextInput
                style={[styles.modalInput, { height: 140, textAlignVertical: "top" }]}
                placeholder="Nhập nội dung..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                value={newHistory.content}
                onChangeText={(t) => setNewHistory({ ...newHistory, content: t })}
              />

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddHistory}>
                <Text style={styles.modalSaveBtnText}>
                  {newHistory.id ? "Cập nhật" : "Lưu lịch sử"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAddAppointmentModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAddAppointmentModal(false);
              setNewAppointment({ tieuDe: "", dienGiai: "", ngayHen: "", ngayHenAPI: "", maLH: null });
            }}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {newAppointment.maLH ? "Sửa lịch hẹn" : "Thêm lịch hẹn"}
              </Text>

              <Text style={styles.modalLabel}>Tiêu đề</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập tiêu đề..."
                placeholderTextColor={Colors.textTertiary}
                value={newAppointment.tieuDe}
                onChangeText={(t) =>
                  setNewAppointment({ ...newAppointment, tieuDe: t })
                }
              />

              <Text style={styles.modalLabel}>Ngày giờ hẹn</Text>
              <TouchableOpacity
                style={styles.modalInput}
                onPress={() => setShowPicker(true)}
              >
                <Text
                  style={{
                    color: newAppointment.ngayHen ? Colors.text : Colors.textTertiary,
                    fontSize: 14,
                  }}
                >
                  {newAppointment.ngayHen || "Chọn ngày giờ hẹn"}
                </Text>
              </TouchableOpacity>

              {showPicker && (
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display="default"
                  locale="vi-VN"
                  onChange={onChangeDate}
                />
              )}

              <Text style={styles.modalLabel}>Diễn giải</Text>
              <TextInput
                style={[styles.modalInput, { height: 100, textAlignVertical: "top" }]}
                placeholder="Nhập diễn giải..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                value={newAppointment.dienGiai}
                onChangeText={(t) =>
                  setNewAppointment({ ...newAppointment, dienGiai: t })
                }
              />

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddAppointment}>
                <Text style={styles.modalSaveBtnText}>
                  {newAppointment.maLH ? "Cập nhật" : "Lưu lịch hẹn"}
                </Text>
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
