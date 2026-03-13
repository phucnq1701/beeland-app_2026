import React, { useState, useEffect, useCallback } from "react";
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
  KeyboardAvoidingView,
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
  Building2,
  MapPin,
  Calendar,
  Clock,
  Plus,
  Edit2,
  FileText,
  User,
  X,
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

interface WorkHistory {
  id: string;
  date: string;
  content: string;
  createdBy: string;
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
    maLH: null,
  });

  const [newHistory, setNewHistory] = useState({
    content: "",
    status: null,
    id: null,
  });

  const loadDataExtra = async () => {
    const result = await CustomerService.getTrangThaiKH();
    setTrangThaiKH(result?.data ?? []);
  };

  useEffect(() => {
    loadDataExtra();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        getCustomer();
        getAppointments();
        getNotes();
      }
    }, [id])
  );

  // useEffect(() => {
  //   if (id) {
  //     getCustomer();
  //     getAppointments();
  //     getNotes();
  //   }
  // }, [id]);

  const getCustomer = async () => {
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
  };

  const getAppointments = async () => {
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
          status: "upcoming",
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
  };

  const getNotes = async () => {
    try {
      const res = await CustomerService.getGhiChunByMaKH({
        MaKH: id,
      });

      if (res?.data?.length) {
        setWorkHistory(res?.data);
      } else {
        setWorkHistory([]);
      }
    } catch (err) {
      console.log(err);
    }
  };

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
      getNotes();
      setShowAddHistoryModal(false);
      setNewHistory({
        content: "",
        status: null,
        id: null,
      });

      Alert.alert("Thành công", result?.message);
    } else {
      Alert.alert("Thất bại", result?.message);
    }
    // const history: WorkHistory = {
    //   id: Date.now().toString(),
    //   date: new Date().toISOString().split("T")[0],
    //   content: newHistory.content,
    //   createdBy: "Người dùng hiện tại",
    // };
  };

  const formatDateVN = (date: any) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");

    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const formatDateAPI = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  };

  const onChangeDate = (event: any, selectedDate: any) => {
    setShowPicker(false);

    if (selectedDate) {
      setDate(selectedDate);

      setNewAppointment((prev) => ({
        ...prev,
        ngayHen: formatDateVN(selectedDate), // hiển thị
        ngayHenAPI: formatDateAPI(selectedDate), // gửi api
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
        getAppointments();
        setShowAddAppointmentModal(false);

        setNewAppointment({
          tieuDe: "",
          dienGiai: "",
          ngayHen: "",
          ngayHenAPI: "",
          maLH: null,
        });

        Alert.alert("Thành công", result?.message);
      } else {
        Alert.alert("Thất bại", result?.message);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleEditAppointment = (item: any) => {
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

  const handleDeleteAppointment = (id: any) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn xoá lịch hẹn này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          const result = await CongViecService.deleteLichHen({
            MaLH: id,
          });

          if (result?.status === 2000) {
            getAppointments();
            Alert.alert("Thành công", "Đã xoá lịch hẹn");
          } else {
            Alert.alert("Lỗi", result?.message);
          }
        },
      },
    ]);
  };

  const getStatusColor = () => "#10B981";
  const getStatusLabel = () => "Khách hàng";

  const getAppointmentStatusColor = (status: string) => {
    if (status === "completed") return "#10B981";
    if (status === "cancelled") return "#EF4444";
    return "#3B82F6";
  };

  const getAppointmentStatusLabel = (status: string) => {
    if (status === "completed") return "Hoàn thành";
    if (status === "cancelled") return "Đã hủy";
    return "Sắp tới";
  };

  if (!customer) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  const trangThaiOptions = trangThaiKH.map((item) => ({
    label: item.tenTT,
    value: item.maTT,
  }));

  const handleEditHistory = (item: any) => {
    setNewHistory({
      content: item.dienGiai,
      status: item.maTT,
      id: item.id,
    });

    setShowAddHistoryModal(true);
  };

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
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),

          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/customer/${customer.id}/edit`)}
            >
              <Edit2 color={Colors.white} size={22} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.customerHeader}>
          <View style={styles.customerHeaderContent}>
            <View style={styles.customerAvatar}>
              <User color={Colors.primary} size={32} />
            </View>

            <View style={styles.customerHeaderInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>

              {customer.company ? (
                <Text style={styles.customerCompany}>{customer.company}</Text>
              ) : null}

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor() },
                ]}
              >
                <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* CONTACT */}
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

            {customer.diaChi ? (
              <>
                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoIconContainer}>
                    <MapPin color={Colors.primary} size={20} />
                  </View>

                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Địa chỉ</Text>
                    <Text style={styles.infoValue}>{customer.diaChi}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* APPOINTMENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lịch hẹn</Text>

            <TouchableOpacity
              onPress={() => setShowAddAppointmentModal(true)}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Thêm</Text>
            </TouchableOpacity>
          </View>

          {appointments.length === 0 ? (
            <Text style={{ color: Colors.textSecondary }}>
              Chưa có lịch hẹn
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator>
              {appointments.map((item) => (
                <View
                  key={item.id}
                  style={{
                    ...styles.appointmentCard,
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => handleEditAppointment(item)}
                  >
                    <Text style={styles.appointmentTitle}>{item.title}</Text>

                    <Text>
                      {item.date} - {item.time}
                    </Text>
                    <Text style={{ paddingTop: 10 }}>{item.dienGiai}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteAppointment(item.id)}
                    style={{ padding: 6 }}
                  >
                    <X size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* HISTORY */}
        <View style={{ ...styles.section, marginBottom: 50 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lịch sử làm việc</Text>

            <TouchableOpacity
              onPress={() => setShowAddHistoryModal(true)}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Thêm</Text>
            </TouchableOpacity>
          </View>
          {workHistory.length === 0 ? (
            <Text style={{ color: Colors.textSecondary }}>Chưa có lịch sử</Text>
          ) : (
            <ScrollView style={{ height: 300 }} showsVerticalScrollIndicator>
              {workHistory.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() => handleEditHistory(item)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={styles.historyTypeText}>{item.tenTT}</Text>
                    <Edit2 size={16} color={Colors.primary} />
                  </View>

                  <Text style={styles.historyContent}>{item.dienGiai}</Text>

                  <Text style={styles.historyCreatedBy}>
                    {Format_Date(item.ngayCN)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* ADD HISTORY MODAL */}
      <Modal visible={showAddHistoryModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader2}>
                <Text style={styles.modalTitle}>
                  {newHistory.id
                    ? "Sửa lịch sử làm việc"
                    : "Thêm lịch sử làm việc"}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setShowAddHistoryModal(false);
                    setNewHistory({
                      content: "",
                      status: null,
                      id: null,
                    });
                  }}
                >
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Dropdown
                style={[
                  styles.input,
                  { paddingVertical: 10, marginBottom: 20, marginTop: 10 },
                ]}
                data={trangThaiOptions}
                labelField="label"
                valueField="value"
                placeholder="Chọn trạng thái công việc"
                value={newHistory.status}
                onChange={(item: any) =>
                  setNewHistory((prev) => ({
                    ...prev,
                    status: item.value,
                  }))
                }
              />
              <TextInput
                style={[styles.input, { height: 200 }]}
                placeholder="Nội dung"
                multiline
                value={newHistory.content}
                onChangeText={(t) =>
                  setNewHistory({ ...newHistory, content: t })
                }
              />

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleAddHistory}
              >
                <Text style={styles.modalSaveButtonText}>
                  {newHistory.id ? "Cập nhật" : "Lưu lịch sử"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={showAddAppointmentModal}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader2}>
                <Text style={styles.modalTitle}>
                  {newAppointment.maLH ? "Sửa lịch hẹn" : "Thêm lịch hẹn"}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setShowAddAppointmentModal(false);
                    setNewAppointment({
                      tieuDe: "",
                      dienGiai: "",
                      ngayHen: "",
                      ngayHenAPI: "",
                      maLH: null,
                    });
                  }}
                >
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Tiêu đề"
                value={newAppointment.tieuDe}
                onChangeText={(t) =>
                  setNewAppointment({ ...newAppointment, tieuDe: t })
                }
              />

              <TouchableOpacity
                style={[
                  styles.input,
                  { marginTop: 10, justifyContent: "center" },
                ]}
                onPress={() => setShowPicker(true)}
              >
                <Text
                  style={{ color: newAppointment.ngayHen ? "#000" : "#999" }}
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

              <TextInput
                style={[styles.input, { height: 120, marginTop: 10 }]}
                placeholder="Diễn giải"
                multiline
                value={newAppointment.dienGiai}
                onChangeText={(t) =>
                  setNewAppointment({ ...newAppointment, dienGiai: t })
                }
              />

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleAddAppointment}
              >
                <Text style={styles.modalSaveButtonText}>
                  {newAppointment.maLH ? "Cập nhật" : "Lưu lịch hẹn"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    textAlign: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  customerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  customerHeaderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  customerCompany: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  section: {
    padding: 24,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    paddingBottom: 10,
    marginTop: -10,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
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
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      },
    }),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
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
    fontWeight: "600" as const,
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  projectTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFF4ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  projectTagText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  appointmentsList: {
    gap: 12,
    marginBottom: 24,
  },
  appointmentCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
      },
    }),
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  appointmentDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  appointmentDate: {
    fontSize: 14,
    fontWeight: "600" as const,
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
    fontWeight: "600" as const,
    color: Colors.white,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  appointmentLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  appointmentLocationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  appointmentNotes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  appointmentNotesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    fontStyle: "italic" as const,
  },
  historyList: {
    gap: 12,
    marginBottom: 24,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
      },
    }),
  },
  historyHeader: {
    marginBottom: 10,
  },
  historyTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  historyTypeText: {
    fontSize: 13,
    fontWeight: "600" as const,
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
    fontStyle: "italic" as const,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: "80%",
    paddingHorizontal: 10,
    paddingBottom: 50,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeader2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalClose: {
    fontSize: 20,
    fontWeight: "600",
    color: "#999",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    paddingBottom: 15,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
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
    alignItems: "center",
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
    fontWeight: "700" as const,
    color: Colors.white,
  },
});
