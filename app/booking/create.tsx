import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Search,
  User,
  ChevronRight,
  Plus,
  Check,
  Building2,
  Phone,
  Mail,
  FileText,
  MapPin,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { CustomerService as CustomerSupabaseService } from "@/sevicesSupabase/CustomerService";
import { ProductService } from "@/sevicesSupabase/ProductService";

type BookingCustomer = {
  id?: string;
  maKH: string;
  tenKH: string;
  diDong: string;
  type?: string;
  company?: string | null;
  email?: string;
  cccd?: string;
  diaChi?: string;
  taxCode?: string;
  status?: string;
};

type SanGiaoDich = {
  ID: string;
  MaSan: string;
  MaCT?: string;
  TenSan: string;
  TenCT?: string;
  DiaChi?: string;
  DienThoai?: string;
  Email?: string;
};

function parseJsonParam(value: unknown) {
  if (!value || Array.isArray(value)) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function normalizeCustomer(item: any): BookingCustomer {
  const raw = item?.raw || {};
  const isBusiness =
    item?.type === "business" ||
    item?.is_personal === false ||
    raw?.is_personal === false;

  return {
    id: item?.id ?? raw?.id ?? "",
    // Quy chuẩn: query theo id (uuid). Ưu tiên UUID thật; chỉ fallback về
    // ma_so_kh (vd "KH-00006") khi chưa có id — BookingService sẽ tự resolve
    // uuid từ ma_so_kh.
    maKH: String(
      item?.id && String(item.id).includes("-")
        ? item.id
        : raw?.id && String(raw.id).includes("-")
          ? raw.id
          : item?.ma_kh ?? raw?.MaKH ?? item?.id ?? raw?.id ?? ""
    ),
    tenKH: (item?.ho_ten ?? raw?.TenKH ?? item?.ten_kh ?? raw?.ten_kh ?? "")
      .toString()
      .trim(),
    diDong: String(item?.dien_thoai ?? raw?.DiDong ?? item?.di_dong ?? ""),
    email: String(item?.email ?? raw?.Email ?? ""),
    cccd: String(item?.cccd ?? raw?.SoCMND ?? ""),
    diaChi: String(item?.dia_chi ?? raw?.DiaChi ?? ""),
    company: raw?.TenCongTy ?? item?.ten_cong_ty ?? null,
    taxCode: String(item?.taxCode ?? raw?.MaSoThue ?? ""),
    type: isBusiness ? "business" : "personal",
    status: item?.status ?? raw?.status ?? "",
  };
}

export default function CreateBookingScreen() {
  const router = useRouter();
  const { dataBooking, newCustomer } = useLocalSearchParams();

  const bookingData = parseJsonParam(dataBooking);
  const initialNewCustomer = parseJsonParam(
    newCustomer
  ) as BookingCustomer | null;
  const bookingParam = typeof dataBooking === "string" ? dataBooking : "";

  const [selectedCustomer, setSelectedCustomer] =
    useState<BookingCustomer | null>(initialNewCustomer);
  const [selectedSan, setSelectedSan] = useState<SanGiaoDich | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dataKH, setDataKH] = useState<BookingCustomer[]>([]);
  const [sanList, setSanList] = useState<SanGiaoDich[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSan, setLoadingSan] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  // Lấy danh sách sàn giao dịch từ dm_companies (is_san=true)
  const loadSanList = async () => {
    setLoadingSan(true);
    try {
      const res = await ProductService.getSanGiaoDichAPI();
      const list: SanGiaoDich[] = Array.isArray(res?.data) ? res.data : [];
      setSanList(list);

      // Nếu sản phẩm hoặc bookingData đã chỉ định sàn thì auto select
      const spMaSan = bookingData?.MaSan || bookingData?.ma_san || bookingData?.san_giao_dich;
      if (spMaSan && list.length > 0) {
        const found = list.find(
          (s) =>
            s.ID === spMaSan ||
            s.MaSan === spMaSan ||
            s.TenSan?.toLowerCase() === String(spMaSan).toLowerCase()
        );
        if (found) {
          setSelectedSan(found);
        }
      }
    } catch (error) {
      console.log("Error loading san giao dich:", error);
    } finally {
      setLoadingSan(false);
    }
  };

  const handleSelectCustomer = (customer: BookingCustomer) => {
    setSelectedCustomer(customer);
  };

  const handleSelectSan = (san: SanGiaoDich) => {
    setSelectedSan(san);
  };

  const handleContinue = async () => {
    if (!selectedCustomer) {
      Alert.alert("Lỗi", "Vui lòng chọn khách hàng");
      return;
    }
    if (!selectedCustomer.maKH) {
      Alert.alert("Lỗi", "Khách hàng chưa có mã để ghép vào booking");
      return;
    }

    try {
      setCreatingBooking(true);

      // Payload theo chuẩn BookingService.createBooking
      const initDataBooking = {
        MaSP: bookingData?.MaSP,
        SanPhamId: bookingData?.id ?? bookingData?.Id ?? null,
        KyHieu: bookingData?.KyHieu,
        MaSan: selectedSan?.ID || selectedSan?.MaSan || null,
        TenSan: selectedSan?.TenSan || null,
        MaKhu: bookingData?.MaKhu || null,
        TenKhu: bookingData?.TenKhu || null,
        MaDA: bookingData?.MaDA,
        TenDA: bookingData?.TenDA,
        TongGiaGomPBT: bookingData?.TongGiaTriHDMB ?? bookingData?.TongGomPBT ?? 0,

        DTThongThuy: bookingData?.DTThongThuy || bookingData?.DienTichThongThuy || 0,
        DonGiaTT: bookingData?.DonGiaThongThuy || bookingData?.DonGia || 0,
        TongGiaGomVAT: bookingData?.TongGiaGomVAT ?? bookingData?.TongGiaTriHDMB ?? 0,
        PhiBaoTri: bookingData?.PhiBaoTri ?? bookingData?.TienPhiBaoTri ?? 0,

        DienTichDat: bookingData?.DienTichDat || 0,
        DonGiaDat: bookingData?.DonGiaDat || 0,
        TongGiaDat: bookingData?.ThanhTienDat || bookingData?.TongGiaDat || 0,

        DienTichXD: bookingData?.DienTichXD || 0,
        DonGiaXD: bookingData?.DonGiaXD || 0,
        ThanhTienXD: bookingData?.ThanhTienXD || 0,

        MaKH: selectedCustomer.maKH,
        TenKH: selectedCustomer.tenKH,
        DiDong: selectedCustomer.diDong,
        Email: selectedCustomer.email || "",
      };

      const resultBooking = await BookingService.createBooking(initDataBooking);

      if (resultBooking?.status === 2000) {
        router.replace("/bookings");
      } else {
        Alert.alert("Lỗi", resultBooking?.message || "Không thể tạo booking");
      }
    } catch (error: any) {
      console.log("createBooking error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể tạo booking");
    } finally {
      setCreatingBooking(false);
    }
  };

  const loadData = async (search = "") => {
    setLoading(true);
    try {
      const res = await CustomerSupabaseService.getCustomers({ search });
      const list = Array.isArray(res?.data) ? res.data : [];
      setDataKH(list.map((customer) => normalizeCustomer(customer)));
    } catch (error) {
      console.log("ERROR getCustomers:", error);
      setDataKH([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingData) {
      const statusName = String(
        bookingData?.TenTT ||
        bookingData?.ten_tt ||
        bookingData?.TrangThai ||
        bookingData?.status ||
        ""
      )
        .toLowerCase()
        .trim();
      const isBooking =
        statusName.includes("booking") ||
        statusName.includes("chờ duyệt") ||
        statusName.includes("cho duyet") ||
        statusName.includes("đã book") ||
        statusName.includes("da book") ||
        statusName.includes("giữ chỗ") ||
        statusName.includes("giu cho") ||
        String(bookingData?.MaTT) === "5" ||
        String(bookingData?.MaTT) === "6";

      if (isBooking) {
        Alert.alert(
          "Thông báo",
          "Sản phẩm này đã có người booking rồi, người sau không được phép booking nữa.",
          [
            {
              text: "Quay lại",
              onPress: () => router.back(),
            },
          ]
        );
      }
    }

    loadData("");
    loadSanList();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <>
      {loading || creatingBooking || loadingSan ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#f5ca1c" />
          <Text style={{ marginTop: 10, color: Colors.textSecondary }}>
            {creatingBooking
              ? "Đang lưu booking..."
              : loadingSan
              ? "Đang tải danh sách sàn..."
              : "Đang tải dữ liệu..."}
          </Text>
        </View>
      ) : (
        <View style={styles.container}>
          <Stack.Screen
            options={{
              title: "Tạo Booking",
              headerStyle: {
                backgroundColor: Colors.white,
              },
              headerTintColor: Colors.text,
              headerShadowVisible: false,
            }}
          />

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Chọn khách hàng */}
            {!selectedCustomer ? (
              <>
                <View style={styles.headerSection}>
                  <Text style={styles.headerTitle}>Chọn khách hàng</Text>
                  <Text style={styles.headerSubtitle}>
                    Tìm kiếm và chọn khách hàng hoặc tạo mới
                  </Text>
                </View>

                <View style={styles.searchContainer}>
                  <Search color={Colors.textSecondary} size={20} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm theo tên, SĐT, CCCD..."
                    placeholderTextColor={Colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <TouchableOpacity
                  style={styles.createNewButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    const params: Record<string, string> = {
                      returnToBooking: "1",
                    };
                    if (bookingParam) {
                      params.dataBooking = bookingParam;
                    }
                    router.push({
                      pathname: "/customer/new",
                      params,
                    });
                  }}
                >
                  <View style={styles.createNewIcon}>
                    <Plus color={Colors.white} size={24} />
                  </View>
                  <View style={styles.createNewTextContainer}>
                    <Text style={styles.createNewTitle}>
                      Tạo khách hàng mới
                    </Text>
                    <Text style={styles.createNewSubtitle}>
                      Thêm thông tin khách hàng mới vào hệ thống
                    </Text>
                  </View>
                  <ChevronRight color={Colors.textSecondary} size={20} />
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Danh sách khách hàng</Text>

                <View style={styles.customerList}>
                  {dataKH.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Không tìm thấy khách hàng nào
                    </Text>
                  ) : (
                    dataKH.map((customer) => (
                      <TouchableOpacity
                        key={customer.maKH || customer.id}
                        style={styles.customerCard}
                        activeOpacity={0.7}
                        onPress={() => handleSelectCustomer(customer)}
                      >
                        <View style={styles.customerHeader}>
                          <View style={styles.customerNameRow}>
                            <View
                              style={[
                                styles.customerAvatar,
                                {
                                  backgroundColor:
                                    customer.type === "personal"
                                      ? "#EFF6FF"
                                      : "#FDF2F8",
                                },
                              ]}
                            >
                              <User color={Colors.primary} size={20} />
                            </View>
                            <View style={styles.customerNameContainer}>
                              <Text style={styles.customerName}>
                                {customer.tenKH}
                              </Text>
                              {customer.company && (
                                <Text style={styles.customerCompany}>
                                  {customer.company}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>

                        <View style={styles.customerInfo}>
                          {customer.diDong ? (
                            <View style={styles.infoLine}>
                              <Phone size={14} color={Colors.textSecondary} />
                              <Text style={styles.customerInfoText}>
                                {customer.diDong}
                              </Text>
                            </View>
                          ) : null}
                          {customer.email ? (
                            <View style={styles.infoLine}>
                              <Mail size={14} color={Colors.textSecondary} />
                              <Text style={styles.customerInfoText}>
                                {customer.email}
                              </Text>
                            </View>
                          ) : null}
                          {customer.cccd ? (
                            <View style={styles.infoLine}>
                              <FileText size={14} color={Colors.textSecondary} />
                              <Text style={styles.customerInfoText}>
                                CCCD: {customer.cccd}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            ) : (
              <>
                {/* Khách hàng đã chọn */}
                <View style={styles.headerSection}>
                  <Text style={styles.headerTitle}>Thông tin đặt chỗ</Text>
                  <Text style={styles.headerSubtitle}>
                    Kiểm tra khách hàng và chọn sàn giao dịch
                  </Text>
                </View>

                <View style={styles.selectedCustomerCard}>
                  <View style={styles.selectedHeader}>
                    <View style={styles.checkIconContainer}>
                      <Check color={Colors.white} size={20} />
                    </View>
                    <Text style={styles.selectedTitle}>Khách hàng đã chọn</Text>
                  </View>

                  <View style={styles.selectedContent}>
                    <View style={styles.selectedRow}>
                      <View
                        style={[
                          styles.selectedAvatar,
                          {
                            backgroundColor:
                              selectedCustomer.type === "personal"
                                ? "#EFF6FF"
                                : "#FDF2F8",
                          },
                        ]}
                      >
                        <User color={Colors.primary} size={28} />
                      </View>
                      <View style={styles.selectedInfo}>
                        <Text style={styles.selectedName}>
                          {selectedCustomer.tenKH}
                        </Text>
                        {selectedCustomer.company && (
                          <Text style={styles.selectedCompany}>
                            {selectedCustomer.company}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.selectedDivider} />

                    <View style={styles.infoSection}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Số điện thoại:</Text>
                        <Text style={styles.infoValue}>
                          {selectedCustomer.diDong || "---"}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email:</Text>
                        <Text style={styles.infoValue}>
                          {selectedCustomer.email || "---"}
                        </Text>
                      </View>
                      {selectedCustomer.cccd ? (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>CCCD/CMND:</Text>
                          <Text style={styles.infoValue}>
                            {selectedCustomer.cccd}
                          </Text>
                        </View>
                      ) : null}
                      {selectedCustomer.diaChi ? (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Địa chỉ:</Text>
                          <Text style={styles.infoValue} numberOfLines={2}>
                            {selectedCustomer.diaChi}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.changeButton}
                    activeOpacity={0.7}
                    onPress={() => setSelectedCustomer(null)}
                  >
                    <Text style={styles.changeButtonText}>
                      Đổi khách hàng khác
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Chọn sàn giao dịch */}
                {sanList.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.headerSection}>
                      <Text style={styles.sectionTitle}>
                        Sàn giao dịch (Đại lý)
                      </Text>
                      <Text style={styles.headerSubtitle}>
                        Chọn sàn liên kết nếu có
                      </Text>
                    </View>

                    <View style={styles.sanPhongList}>
                      {sanList.map((san) => {
                        const isSelected =
                          selectedSan?.ID === san.ID ||
                          selectedSan?.MaSan === san.MaSan;
                        return (
                          <TouchableOpacity
                            key={san.ID || san.MaSan}
                            style={[
                              styles.sanPhongCard,
                              isSelected && styles.sanPhongCardSelected,
                            ]}
                            activeOpacity={0.7}
                            onPress={() =>
                              handleSelectSan(isSelected ? (null as any) : san)
                            }
                          >
                            <View style={styles.sanPhongIcon}>
                              <Building2 color={Colors.primary} size={22} />
                            </View>
                            <View style={styles.sanPhongInfo}>
                              <Text style={styles.sanPhongName}>
                                {san.TenSan}
                              </Text>
                              {san.DiaChi ? (
                                <Text
                                  style={styles.sanPhongKhu}
                                  numberOfLines={1}
                                >
                                  {san.DiaChi}
                                </Text>
                              ) : null}
                            </View>
                            {isSelected ? (
                              <View style={styles.checkContainer}>
                                <Check color={Colors.white} size={18} />
                              </View>
                            ) : (
                              <ChevronRight
                                color={Colors.textSecondary}
                                size={18}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* Nút lưu booking */}
          {selectedCustomer && (
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={styles.continueButton}
                activeOpacity={0.8}
                onPress={handleContinue}
              >
                <Text style={styles.continueButtonText}>Xác nhận & Lưu Booking</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </>
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
    padding: 20,
    paddingBottom: 110,
  },
  headerSection: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  createNewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 20,
  },
  createNewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  createNewTextContainer: {
    flex: 1,
    gap: 3,
  },
  createNewTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  createNewSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 12,
  },
  customerList: {
    gap: 10,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 14,
    marginVertical: 20,
  },
  customerCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  customerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  customerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  customerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  customerNameContainer: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customerCompany: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  customerInfo: {
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerInfoText: {
    fontSize: 13,
    color: Colors.text,
  },
  selectedCustomerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 3px 8px rgba(0, 0, 0, 0.08)",
      },
    }),
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  checkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  selectedContent: {
    gap: 14,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selectedAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 2,
  },
  selectedCompany: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  selectedDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  infoSection: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "600" as const,
    flexShrink: 1,
    textAlign: "right",
  },
  changeButton: {
    marginTop: 18,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  sanPhongList: {
    gap: 10,
  },
  sanPhongCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 12,
  },
  sanPhongCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#F0F9FF",
  },
  sanPhongIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  sanPhongInfo: {
    flex: 1,
    gap: 3,
  },
  sanPhongName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  sanPhongKhu: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomContainer: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 -2px 6px rgba(0, 0, 0, 0.08)",
      },
    }),
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
});