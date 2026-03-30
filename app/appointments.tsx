import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Modal,
  KeyboardAvoidingView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Calendar,
  List,
  Clock,
  MapPin,
  Phone,
  FileText,
  Eye,
  MessageSquare,
  Users,
  FileSignature,
} from "lucide-react-native";
import Colors from "@/constants/colors";
// import { appointments, Appointment } from "@/mocks/appointments";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CongViecService } from "@/sevices/CongViecService";
import { CustomerService } from "@/sevices/CustomerService";
import { ProductService } from "@/sevices/ProductService";

type ViewMode = "list" | "calendar";

type Appointment = any;
const typeConfig = {
  viewing: {
    label: "Xem nhà",
    icon: Eye,
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  consultation: {
    label: "Tư vấn",
    icon: MessageSquare,
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  signing: {
    label: "Ký HĐ",
    icon: FileSignature,
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
  meeting: {
    label: "Họp",
    icon: Users,
    color: "#EC4899",
    bgColor: "#FDF2F8",
  },
};

const statusConfig = {
  pending: { label: "Chờ xác nhận", color: "#F59E0B" },
  confirmed: { label: "Đã xác nhận", color: "#10B981" },
  completed: { label: "Hoàn thành", color: "#6B7280" },
  cancelled: { label: "Đã hủy", color: "#EF4444" },
};

export default function AppointmentsScreen() {
  const { id, dataFromHome } = useLocalSearchParams();
  const openedFromHome = useRef(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [filterType, setFilterType] = useState<string>("all");
  const insets = useSafeAreaInsets();
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [checkSearch, setCheckSearch] = useState(false);
  const [dataKH, setDataKH] = useState<any[]>([]);
  const [loadingKH, setLoadingKH] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);

  const [productList, setProductList] = useState<any[]>([]);
  const [showProductList, setShowProductList] = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [isSelectingProduct, setIsSelectingProduct] = useState(false);

  const [newAppointment, setNewAppointment] = useState({
    tieuDe: "",
    dienGiai: "",
    ngayHen: "",
    ngayHenAPI: "",
    hoTen: "",
    diDong: "",
    maLH: null,
    loaiHen: "viewing",
    productName: "",
    maSP: null,
  });

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [dataLichHen, setDataLichHen] = useState<any[]>([]);

  const loadDSLichHen = async () => {
    setLoading(true)
    const res = await CustomerService.getLichHenByMaKH({
      MaKH: 0,
      TuNgay: "2000-01-01",
      DenNgay: "2100-01-01",
      InputString: "",
      Home: 0,
    });
    setDataLichHen(res?.data ?? []);
    setLoading(false)
  };

  useEffect(() => {
    void loadDSLichHen();
  }, []);

  const loadData = async (search = "") => {
    setLoadingKH(true);

    try {
      let res = await CustomerService.getCustomers(search);
      const list = Array.isArray(res?.data) ? res.data : [];

      setDataKH(list);
    } catch (error) {
      console.log("ERROR:", error);
      setDataKH([]);
    }

    setLoadingKH(false);
  };

  useEffect(() => {
    if (openedFromHome.current) return;

    if (id && dataFromHome) {
      try {
        const item = JSON.parse(dataFromHome as string);
        handleEditAppointment({
          id: item.maLH,
          title: item.tieuDe,
          notes: item.dienGiai,
          date: new Date(item.ngayHen).toISOString().split("T")[0],
          startTime: new Date(item.ngayHen).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          clientName: item.tenKH,
          diDong: item.diDong,
          type: "viewing",
        });

        openedFromHome.current = true;
      } catch (err) {
        console.log("parse error", err);
      }
    }
  }, [id, dataFromHome]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery?.trim()?.length > 0 && checkSearch) {
        void loadData(searchQuery);
        setShowCustomerList(true);
      } else {
        setShowCustomerList(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCustomer = (item: any) => {
    setNewAppointment((prev) => ({
      ...prev,
      hoTen: item.tenKH,
      diDong: item.diDong,
      maKH: item.maKH,
    }));

    setSearchQuery(item.tenKH);
    setShowCustomerList(false);
  };

  const loadProducts = async (keyword = "") => {
    try {
      let filter = {
        MaDA: -1,
        MaKhu: null,
        MaPK: null,
        MaTT: null,
        KyHieu: keyword,
        Limit: 16,
        offSet: 1,
      };

      const res = await ProductService.getProducts(filter);
      setProductList(res?.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (isSelectingProduct) {
      setIsSelectingProduct(false);
      return;
    }

    const timer = setTimeout(() => {
      if (searchProduct) {
        void loadProducts(searchProduct);
        setShowProductList(true);
      } else {
        setShowProductList(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchProduct]);

  const handleSelectProduct = (item: any) => {
    setIsSelectingProduct(true);

    setNewAppointment((prev) => ({
      ...prev,
      productName: item.maSanPham,
      maSP: item.maSP,
    }));

    setSearchProduct(item.maSanPham);
    setShowProductList(false);
  };

  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const getCardAnim = (id: string) => {
    if (!cardAnimations[id]) {
      cardAnimations[id] = new Animated.Value(1);
    }
    return cardAnimations[id];
  };

  const getAppointments = async () => {
    try {
      const res = await CustomerService.getLichHenByMaKH({
        MaKH: 0,
        TuNgay: "2000-01-01",
        DenNgay: "2100-01-01",
        InputString: "",
        Home: 0,
      });

      if (res?.data?.length) {
        setDataLichHen(res?.data);
      } else {
        setDataLichHen([]);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const animatePress = (id: string, callback: () => void) => {
    const scale = getCardAnim(id);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 100);
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const week = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const week = getCurrentWeek();

  const filteredAppointments = useMemo(() => {
    let filtered = dataLichHen.map((item) => {
      const date = new Date(item.ngayHen);

      return {
        id: String(item.maLH),

        // title
        title: item.tieuDe ?? "Lịch hẹn",

        diDong: item.diDong ?? "",

        // ngày
        date: date.toISOString().split("T")[0],

        // giờ
        startTime: date.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),

        endTime: date.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),

        // fake tạm
        location: item.tenDA ?? "Văn phòng",
        clientName: item.tenKH ?? "",
        notes: item.dienGiai ?? "",

        // fake tạm
        type: "viewing",
        status: "confirmed",
      };
    });

    if (filterType !== "all") {
      filtered = filtered.filter((apt) => apt.type === filterType);
    }

    if (viewMode === "calendar") {
      filtered = filtered.filter((apt) => apt.date === selectedDate);
    }

    return filtered.sort((a, b) => {
      return (
        new Date(b.date + " " + b.startTime).getTime() -
        new Date(a.date + " " + a.startTime).getTime()
      );
    });
  }, [filterType, selectedDate, viewMode, dataLichHen]);

  const isThisWeek = (dateStr: any) => {
    const today = new Date();
    const date = new Date(dateStr);

    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - today.getDay() + 1); // thứ 2

    const lastDay = new Date(firstDay);
    lastDay.setDate(firstDay.getDate() + 6); // CN

    return date >= firstDay && date <= lastDay;
  };
  const formatHeaderDate = (dateStr: any) => {
    const date = new Date(dateStr);

    if (isThisWeek(dateStr)) {
      return date.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });
    }

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
  // const filteredAppointments = useMemo(() => {
  //   let filtered = appointments;

  //   if (filterType !== "all") {
  //     filtered = filtered.filter((apt) => apt.type === filterType);
  //   }

  //   if (viewMode === "calendar") {
  //     filtered = filtered.filter((apt) => apt.date === selectedDate);
  //   }

  //   return filtered.sort((a, b) => {
  //     const dateCompare = a.date.localeCompare(b.date);
  //     if (dateCompare !== 0) return dateCompare;
  //     return a.startTime.localeCompare(b.startTime);
  //   });
  // }, [filterType, selectedDate, viewMode]);

  const appointmentsByDate = useMemo(() => {
    const grouped: { [key: string]: Appointment[] } = {};
    filteredAppointments.forEach((apt) => {
      if (!grouped[apt.date]) {
        grouped[apt.date] = [];
      }
      grouped[apt.date].push(apt);
    });
    return grouped;
  }, [filteredAppointments]);

  const _formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hôm nay";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Ngày mai";
    }

    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "numeric",
    });
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
    // 99004
    console.log(newAppointment);

    const payload = {
      MaKH: (newAppointment as any)?.maKH,
      MaLH: newAppointment.maLH ?? null,
      NgayHen: newAppointment.ngayHenAPI,
      TieuDe: newAppointment.tieuDe,
      DienGiai: newAppointment.dienGiai,
    };

    try {
      const result = await CongViecService.addLichHen(payload);
      if (result?.status === 2000) {
        void getAppointments();
        setShowAddAppointmentModal(false);

        setNewAppointment({
          tieuDe: "",
          dienGiai: "",
          ngayHen: "",
          ngayHenAPI: "",
          hoTen: "",
          diDong: "",
          maLH: null,
          loaiHen: "viewing",
          productName: "",
          maSP: null,
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
    const date = new Date(item.date + " " + item.startTime);

    setNewAppointment({
      maLH: item.id,
      tieuDe: item.title,
      dienGiai: item.notes,
      ngayHen: formatDateVN(date),
      ngayHenAPI: formatDateAPI(date),
      hoTen: item.clientName,
      diDong: item?.diDong,
      loaiHen: item.type,
      productName: "",
      maSP: null,
    });

    setSearchQuery(item.clientName);

    setShowAddAppointmentModal(true);
  };

  const renderAppointmentCard = (appointment: Appointment, _index: number) => {
    const config = (typeConfig as any)[appointment.type];
    const status = (statusConfig as any)[appointment.status];
    const _IconComponent = config.icon;
    const scale = getCardAnim(appointment.id);

    return (
      <Animated.View
        key={appointment.id}
        style={{
          transform: [
            { scale },
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
          opacity: slideAnim,
        }}
      >
        <TouchableOpacity
          style={styles.appointmentCard}
          activeOpacity={1}
          // onPress={() =>
          //   animatePress(appointment.id, () => {
          //     console.log("[Appointments] Navigate to detail", appointment.id);
          //   })
          // }
          onPress={() =>
            animatePress(appointment.id, () => {
              handleEditAppointment(appointment);
            })
          }
        >
          {/* <View style={styles.cardLeft}>
            <View
              style={[styles.typeIcon, { backgroundColor: config.bgColor }]}
            >
              <IconComponent color={config.color} size={20} />
            </View>
          </View> */}

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.appointmentTitle} numberOfLines={1}>
                {appointment.title}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: status.color + "15" },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: status.color }]}
                />
              </View>
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.infoRow}>
                <Clock color={Colors.textSecondary} size={14} />
                <Text style={styles.infoText}>{appointment.startTime}</Text>
              </View>

              <View style={styles.infoRow}>
                <MapPin color={Colors.textSecondary} size={14} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {appointment.location}
                </Text>
              </View>

              {appointment.clientName && (
                <View style={styles.infoRow}>
                  <Phone color={Colors.textSecondary} size={14} />
                  <Text style={styles.infoText}>{appointment.clientName}</Text>
                </View>
              )}
            </View>

            {appointment.notes && (
              <View style={styles.notesContainer}>
                <FileText color={Colors.textLight} size={12} />
                <Text style={styles.notesText} numberOfLines={3}>
                  {appointment.notes}
                </Text>
              </View>
            )}
          </View>
          {/* 
          <View style={styles.cardRight}>
            <ChevronRight color={Colors.textLight} size={20} />
          </View> */}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Lịch hẹn",
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === "list" && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode("list")}
          >
            <List
              color={viewMode === "list" ? Colors.white : Colors.textSecondary}
              size={18}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === "list" && styles.viewModeTextActive,
              ]}
            >
              Danh sách
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === "calendar" && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode("calendar")}
          >
            <Calendar
              color={
                viewMode === "calendar" ? Colors.white : Colors.textSecondary
              }
              size={18}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === "calendar" && styles.viewModeTextActive,
              ]}
            >
              Lịch
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                filterType === "all" && styles.filterChipActive,
              ]}
              onPress={() => setFilterType("all")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterType === "all" && styles.filterChipTextActive,
                ]}
              >
                Tất cả
              </Text>
            </TouchableOpacity>

            {Object.entries(typeConfig).map(([key, config]) => {
              const IconComponent = config.icon;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterChip,
                    filterType === key && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterType(key)}
                >
                  <IconComponent
                    color={filterType === key ? Colors.white : config.color}
                    size={16}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      filterType === key && styles.filterChipTextActive,
                    ]}
                  >
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {viewMode === "calendar" && (
        <View style={styles.weekContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekScroll}
          >
            {week.map((date, index) => {
              const dateStr = date.toISOString().split("T")[0];
              const isSelected = dateStr === selectedDate;

              const dayAppointments = dataLichHen.filter((item) => {
                const d = new Date(item.ngayHen).toISOString().split("T")[0];
                return d === dateStr;
              });

              const hasAppointments = dayAppointments.length > 0;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayCard, isSelected && styles.dayCardActive]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      isSelected && styles.dayLabelActive,
                    ]}
                  >
                    {date.toLocaleDateString("vi-VN", { weekday: "short" })}
                  </Text>

                  <Text
                    style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberActive,
                    ]}
                  >
                    {date.getDate()}
                  </Text>

                  {hasAppointments && (
                    <View
                      style={[
                        styles.dayIndicator,
                        isSelected && styles.dayIndicatorActive,
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {viewMode === "list" ? (
            Object.keys(appointmentsByDate).length > 0 ? (
              Object.entries(appointmentsByDate).map(([date, apts]) => (
                <View key={date} style={styles.dateSection}>
                  <View style={styles.dateSectionHeader}>
                    {/* <Text style={styles.dateTitle}>{formatDate(date)}</Text> */}
                    <Text style={styles.dateTitle}>
                      {formatHeaderDate(date)}
                    </Text>

                    <Text style={styles.dateCount}>{apts.length} lịch hẹn</Text>
                  </View>

                  {apts.map((apt, index) => renderAppointmentCard(apt, index))}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Calendar color={Colors.textLight} size={64} />
                <Text style={styles.emptyTitle}>Không có lịch hẹn</Text>
                <Text style={styles.emptyDescription}>
                  Bạn chưa có lịch hẹn nào trong thời gian tới
                </Text>
              </View>
            )
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map((apt, index) =>
              renderAppointmentCard(apt, index)
            )
          ) : (
            <View style={styles.emptyState}>
              <Calendar color={Colors.textLight} size={64} />
              <Text style={styles.emptyTitle}>Không có lịch hẹn</Text>
              <Text style={styles.emptyDescription}>
                Không có lịch hẹn nào trong ngày này
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setShowAddAppointmentModal(true);
            setSearchQuery("");
          }}
        >
          <Text style={styles.addButtonText}>+ Thêm lịch hẹn</Text>
        </TouchableOpacity>
      </View>

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
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <View style={styles.modalHeader2}>
                  <Text style={styles.modalTitle}>
                    {newAppointment.maLH ? "Sửa lịch hẹn" : "Thêm lịch hẹn"}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setShowAddAppointmentModal(false);
                      setCheckSearch(false);
                      setNewAppointment({
                        tieuDe: "",
                        dienGiai: "",
                        ngayHen: "",
                        ngayHenAPI: "",
                        hoTen: "",
                        diDong: "",
                        maLH: null,
                        loaiHen: "viewing",
                        productName: "",
                        maSP: null,
                      });
                    }}
                  >
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.typeSelectContainer}>
                  {Object.entries(typeConfig).map(([key, config]) => {
                    const Icon = config.icon;

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.typeItem,
                          newAppointment.loaiHen === key &&
                            styles.typeItemActive,
                        ]}
                        onPress={() =>
                          setNewAppointment({ ...newAppointment, loaiHen: key })
                        }
                      >
                        <Icon
                          size={18}
                          color={
                            newAppointment.loaiHen === key
                              ? "#fff"
                              : config.color
                          }
                        />

                        <Text
                          style={[
                            styles.typeText,
                            newAppointment.loaiHen === key &&
                              styles.typeTextActive,
                          ]}
                        >
                          {config.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {newAppointment?.loaiHen === "viewing" && (
                  <>
                    <TextInput
                      style={[styles.input, { marginTop: 10 }]}
                      placeholder="Tìm sản phẩm..."
                      value={searchProduct}
                      onChangeText={setSearchProduct}
                    />
                    {showProductList && (
                      <ScrollView style={styles.productList}>
                        {productList.map((item) => (
                          <TouchableOpacity
                            key={item.maSP}
                            style={styles.productItem}
                            onPress={() => handleSelectProduct(item)}
                          >
                            <Text style={styles.productName}>
                              {item.maSanPham}
                            </Text>
                            <Text style={styles.productCode}>{item.tenDA}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </>
                )}

                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Tìm khách hàng..."
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setCheckSearch(true);
                  }}
                />
                {showCustomerList && (
                  <ScrollView
                    style={styles.customerList}
                    keyboardShouldPersistTaps="handled"
                  >
                    {loadingKH ? (
                      <Text style={{ padding: 10 }}>Đang tìm...</Text>
                    ) : (
                      dataKH.map((item) => (
                        <TouchableOpacity
                          key={item.maKH}
                          style={styles.customerItem}
                          onPress={() => handleSelectCustomer(item)}
                        >
                          <Text style={styles.customerName}>{item.tenKH}</Text>
                          <Text style={styles.customerPhone}>
                            {item.diDong}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
                {/* <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Tên khách hàng"
                  value={newAppointment.hoTen}
                  onChangeText={(t) =>
                    setNewAppointment({ ...newAppointment, hoTen: t })
                  }
                /> */}
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Di động"
                  value={newAppointment.diDong}
                  onChangeText={(t) =>
                    setNewAppointment({ ...newAppointment, diDong: t })
                  }
                />

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
              </ScrollView>
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
  header: {
    backgroundColor: Colors.white,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewModeContainer: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  viewModeTextActive: {
    color: Colors.white,
  },
  filterContainer: {
    paddingLeft: 24,
  },
  filterScroll: {
    paddingRight: 24,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  weekContainer: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weekScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dayCard: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  dayCardActive: {
    backgroundColor: Colors.primary,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dayLabelActive: {
    color: Colors.white,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  dayNumberActive: {
    color: Colors.white,
  },
  dayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  dayIndicatorActive: {
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    textTransform: "capitalize",
  },
  dateCount: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
  },
  appointmentCard: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
      },
    }),
  },
  cardLeft: {
    marginRight: 12,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardInfo: {
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
    flex: 1,
  },
  notesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: "italic" as const,
    flex: 1,
  },
  cardRight: {
    justifyContent: "center",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
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
        boxShadow: "0 4px 12px rgba(232, 111, 37, 0.3)",
      },
    }),
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,

    maxHeight: "90%",
    flexShrink: 1,

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
        boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
      },
    }),
  },

  modalHeader2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },

  modalClose: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.textSecondary,
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

  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,

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
    fontWeight: "700",
    color: Colors.white,
  },

  customerList: {
    maxHeight: 200,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },

  customerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },

  customerName: {
    fontSize: 15,
    fontWeight: "600",
  },

  customerPhone: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  typeSelectContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  typeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#eee",
  },

  typeItemActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  typeText: {
    fontSize: 13,
  },

  typeTextActive: {
    color: "#fff",
  },

  productList: {
    maxHeight: 250,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },

  productItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },

  productName: {
    fontSize: 15,
    fontWeight: "600",
  },

  productCode: {
    fontSize: 12,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
});
