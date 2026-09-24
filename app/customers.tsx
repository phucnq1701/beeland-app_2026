import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  ChevronLeft,
  Phone,
  Building2,
  User,
  Plus,
  Users,
  X,
  ChevronRight,
  MessageCircle,
  MapPin,
  FileText,
  Filter,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

type CustomerTab = "all" | "personal" | "business";

const PAGE_SIZE = 20;

export default function CustomersScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<CustomerTab>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatusId, setSelectedStatusId] = useState<string>("all");

  const [dataKH, setDataKH] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [statusCatalogs, setStatusCatalogs] = useState<any[]>([]);

  // Giữ params mới nhất để refetch khi focus lại (tránh stale closure)
  const latestParams = useRef({ searchQuery, activeTab, selectedStatusId });
  latestParams.current = { searchQuery, activeTab, selectedStatusId };
  const isFirstFocus = useRef(true);

  // Load Status Filter Options
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const statuses = await CustomerService.getTrangThaiCatalogs();
        setStatusCatalogs([{ id: "all", label: "Tất cả", value: "all", color: Colors.primary }, ...statuses]);
      } catch (e) {
        console.log("Error loading catalogs:", e);
      }
    };
    loadCatalogs();
  }, []);

  const fetchCustomers = async ({
    search = searchQuery,
    tab = activeTab,
    statusId = selectedStatusId,
    offset = 0,
    isRefresh = false,
    isLoadMore = false,
  }: {
    search?: string;
    tab?: CustomerTab;
    statusId?: string;
    offset?: number;
    isRefresh?: boolean;
    isLoadMore?: boolean;
  }) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const isPersonal = tab === "personal" ? true : tab === "business" ? false : undefined;
      // Tên trạng thái trên pill — service dùng để resolve UUID / lọc xác nhận phía client
      const statusLabel =
        statusId !== "all"
          ? statusCatalogs.find((s: any) => s.value === statusId)?.label
          : undefined;
      const res = await CustomerService.getCustomers({
        search,
        isPersonal,
        maTtId: statusId !== "all" ? statusId : undefined,
        statusLabel,
        limit: PAGE_SIZE,
        offset,
      });

      const list = Array.isArray(res?.data) ? res.data : [];
      setDataKH((prev) => (isLoadMore ? [...prev, ...list] : list));
      setTotal(res?.total ?? 0);
      setHasMore(!!res?.hasMore);
      // Hết phiên đăng nhập -> hiện banner đăng nhập lại thay vì "Chưa có khách hàng"
      setAuthError(
        (res as any)?.authError
          ? ((res as any)?.message || "Chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.")
          : null
      );
    } catch (error) {
      console.log("Fetch customers error:", error);
      if (!isLoadMore) {
        setDataKH([]);
        setTotal(0);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Debounce search 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers({ offset: 0 });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, selectedStatusId]);

  // Tự tải lại danh sách mỗi khi quay về màn này (sau Thêm/Sửa/Xoá)
  // để thấy ngay dữ liệu mới. Bỏ qua lần focus đầu (mount đã fetch ở trên).
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      const p = latestParams.current;
      fetchCustomers({
        search: p.searchQuery,
        tab: p.activeTab,
        statusId: p.selectedStatusId,
        offset: 0,
      });
    }, [])
  );

  const handleRefresh = () => {
    fetchCustomers({ offset: 0, isRefresh: true });
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore || dataKH.length === 0) return;
    fetchCustomers({ offset: dataKH.length, isLoadMore: true });
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert("Thông báo", "Khách hàng không có số điện thoại");
      return;
    }
    const clean = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${clean}`);
  };

  const handleZalo = (phone?: string) => {
    if (!phone) {
      Alert.alert("Thông báo", "Khách hàng không có số điện thoại");
      return;
    }
    const clean = phone.replace(/[^0-9]/g, "");
    Linking.openURL(`https://zalo.me/${clean}`);
  };

  const handleDeleteKH = (customer: any) => {
    Alert.alert(
      "Xác nhận xoá",
      `Bạn có chắc muốn xoá khách hàng "${customer.tenKH}"?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await CustomerService.deleteCustomer(customer.id);
              if (res.status === 2000) {
                Alert.alert("Thành công", "Đã xoá khách hàng");
                fetchCustomers({ offset: 0 });
              } else {
                Alert.alert("Không thể xoá", res.message);
              }
            } catch (e) {
              Alert.alert("Lỗi", "Có lỗi xảy ra khi xoá khách hàng");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const isPersonal = item.isPersonal;
    const phone = item.diDong || item.dien_thoai;
    const badgeColor = item.statusColor || Colors.primary;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={() => router.push(`/customer/${item.id}` as any)}
        onLongPress={() => handleDeleteKH(item)}
      >
        {/* Header Card */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: isPersonal ? "#EFF6FF" : "#FEF3C7" }]}>
              {isPersonal ? (
                <User size={20} color="#2563EB" />
              ) : (
                <Building2 size={20} color="#D97706" />
              )}
            </View>
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {item.tenKH || (isPersonal ? "Chưa có tên" : "Doanh nghiệp")}
                </Text>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: isPersonal ? "#EFF6FF" : "#FEF3C7" },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      { color: isPersonal ? "#2563EB" : "#D97706" },
                    ]}
                  >
                    {isPersonal ? "Cá nhân" : "Doanh nghiệp"}
                  </Text>
                </View>
              </View>

              {item.ma_so_kh ? (
                <Text style={styles.customerCode}>Mã: {item.ma_so_kh}</Text>
              ) : null}
            </View>
          </View>

          {/* Badge Trạng thái — chỉ hiện khi khách đã có trạng thái (không mặc định) */}
          {item.status ? (
            <View style={[styles.statusBadge, { backgroundColor: `${badgeColor}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
              <Text style={[styles.statusText, { color: badgeColor }]} numberOfLines={1}>
                {item.status}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Thông tin chính cốt lõi */}
        <View style={styles.cardBody}>
          {phone ? (
            <View style={styles.infoRow}>
              <Phone size={14} color="#64748B" />
              <Text style={styles.infoText}>{phone}</Text>
            </View>
          ) : null}

          {item.cccd ? (
            <View style={styles.infoRow}>
              <FileText size={14} color="#64748B" />
              <Text style={styles.infoText}>CCCD/CMND: {item.cccd}</Text>
            </View>
          ) : null}

          {item.taxCode ? (
            <View style={styles.infoRow}>
              <FileText size={14} color="#64748B" />
              <Text style={styles.infoText}>MST: {item.taxCode}</Text>
            </View>
          ) : null}

          {item.diaChi ? (
            <View style={styles.infoRow}>
              <MapPin size={14} color="#64748B" />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.diaChi}
              </Text>
            </View>
          ) : null}

          {item.source ? (
            <View style={styles.sourceRow}>
              <Text style={styles.sourceLabel}>Nguồn: </Text>
              <Text style={styles.sourceValue}>{item.source}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons Nhanh: Call, Zalo, Chi tiết */}
        <View style={styles.cardFooter}>
          <View style={styles.actionButtonsLeft}>
            {phone ? (
              <>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.callBtn]}
                  onPress={() => handleCall(phone)}
                >
                  <Phone size={14} color="#16A34A" />
                  <Text style={styles.callBtnText}>Gọi điện</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickBtn, styles.zaloBtn]}
                  onPress={() => handleZalo(phone)}
                >
                  <MessageCircle size={14} color="#0284C7" />
                  <Text style={styles.zaloBtnText}>Zalo</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          <View style={styles.viewDetailBtn}>
            <Text style={styles.viewDetailText}>Chi tiết</Text>
            <ChevronRight size={14} color="#94A3B8" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header Bar */}
      <View
        style={[
          styles.header,
          embedded && { paddingTop: insets.top + 8 },
        ]}
      >
        {!embedded && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color="#1E293B" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Khách hàng</Text>
          <Text style={styles.headerSubtitle}>{total} khách hàng</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/customer/new" as any)}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên, SĐT, CCCD, Email, Mã KH..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs: Tất cả / Cá nhân / Doanh nghiệp */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "all" && styles.tabItemActive]}
          onPress={() => setActiveTab("all")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "all" && styles.tabTextActive,
            ]}
          >
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "personal" && styles.tabItemActive]}
          onPress={() => setActiveTab("personal")}
        >
          <User size={15} color={activeTab === "personal" ? Colors.primary : "#64748B"} />
          <Text
            style={[
              styles.tabText,
              activeTab === "personal" && styles.tabTextActive,
            ]}
          >
            Cá nhân
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "business" && styles.tabItemActive]}
          onPress={() => setActiveTab("business")}
        >
          <Building2 size={15} color={activeTab === "business" ? Colors.primary : "#64748B"} />
          <Text
            style={[
              styles.tabText,
              activeTab === "business" && styles.tabTextActive,
            ]}
          >
            Doanh nghiệp
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bộ lọc trạng thái ngang */}
      {statusCatalogs.length > 1 && (
        <View style={styles.statusFilterWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={statusCatalogs}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.statusFilterContent}
            renderItem={({ item }) => {
              const isSelected = selectedStatusId === item.value || (item.value === "all" && selectedStatusId === "all");
              return (
                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    isSelected && { backgroundColor: item.color || Colors.primary, borderColor: item.color || Colors.primary },
                  ]}
                  onPress={() => setSelectedStatusId(item.value)}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isSelected && { color: "#FFFFFF", fontWeight: "700" },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách khách hàng...</Text>
        </View>
      ) : (
        <FlatList
          data={dataKH}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            authError ? (
              <View style={styles.emptyContainer}>
                <Users size={56} color="#FCA5A5" />
                <Text style={styles.emptyTitle}>Phiên đăng nhập đã hết hạn</Text>
                <Text style={styles.emptyDesc}>
                  {authError}{"\n"}Hãy đăng nhập lại bằng đúng tài khoản web để xem danh sách khách hàng.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.replace("/login" as any)}
                >
                  <Text style={styles.emptyBtnText}>Đăng nhập lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Users size={56} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Chưa có khách hàng</Text>
                <Text style={styles.emptyDesc}>
                  {searchQuery
                    ? "Không tìm thấy khách hàng nào khớp với từ khoá"
                    : "Chạm vào nút + phía trên để thêm khách hàng mới"}
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push("/customer/new" as any)}
                >
                  <Plus size={18} color="#FFFFFF" />
                  <Text style={styles.emptyBtnText}>Thêm khách hàng</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
    padding: 0,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  statusFilterWrap: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  statusFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusPillText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  customerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  customerCode: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardBody: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  sourceLabel: {
    fontSize: 12,
    color: "#94A3B8",
  },
  sourceValue: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  actionButtonsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  callBtn: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  callBtnText: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "600",
  },
  zaloBtn: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  zaloBtnText: {
    fontSize: 12,
    color: "#0284C7",
    fontWeight: "600",
  },
  viewDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewDetailText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  loadMoreContainer: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: "#64748B",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 14,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 20,
    gap: 6,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});