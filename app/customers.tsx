import React, { useEffect, useState, useCallback } from "react";
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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  Search,
  ChevronLeft,
  Phone,
  Mail,
  Building2,
  User,
  Plus,
  Users,
  X,
  ChevronRight,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevices/CustomerService";

type TabType = "personal" | "business";

export default function CustomersScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const router = useRouter();
  const [dataKH, setDataKH] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (search = "") => {
    setLoading(true);
    try {
      let res = await CustomerService.getCustomers(search);
      const list = Array.isArray(res?.data) ? res.data : [];
      setDataKH(list);
    } catch (error) {
      console.log("ERROR:", error);
      setDataKH([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeleteKH = useCallback(
    (maKH: any) => {
      Alert.alert("Xác nhận xoá", "Bạn có chắc muốn xoá khách hàng này?", [
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await CustomerService.delete({ MaKH: [maKH] });
              if (res?.status === 2000) {
                void loadData(searchQuery);
                Alert.alert("Thành công", res?.message);
              } else {
                Alert.alert("Lỗi", res?.message);
              }
            } catch (error) {
              console.log("delete error:", error);
              Alert.alert("Lỗi", "Không thể xoá khách hàng");
            }
          },
        },
        { text: "Huỷ", style: "cancel" },
      ]);
    },
    [searchQuery]
  );

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "#E86F25",
      "#3B82F6",
      "#10B981",
      "#8B5CF6",
      "#EC4899",
      "#F59E0B",
      "#06B6D4",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleCall = useCallback((phone: string) => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone}`);
  }, []);

  const handleEmail = useCallback((email: string) => {
    if (!email) return;
    void Linking.openURL(`mailto:${email}`);
  }, []);

  const renderCustomerItem = useCallback(
    ({ item: customer }: { item: any }) => {
      const avatarBg = getAvatarColor(customer.tenKH || "");
      return (
        <TouchableOpacity
          style={styles.customerRow}
          onPress={() => router.push(`/customer/${customer.maKH}`)}
          onLongPress={() => handleDeleteKH(customer?.maKH)}
          activeOpacity={0.6}
          testID={`customer-card-${customer.maKH}`}
        >
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>
              {getInitials(customer.tenKH)}
            </Text>
          </View>

          <View style={styles.rowContent}>
            <View style={styles.rowTop}>
              <Text style={styles.customerName} numberOfLines={1}>
                {customer.tenKH}
              </Text>
              <Text style={styles.dateLabel}>
                {new Date(customer.ngayDangKy).toLocaleDateString("vi-VN")}
              </Text>
            </View>

            <View style={styles.rowBottom}>
              <Text style={styles.subInfo} numberOfLines={1}>
                {customer.diDong || "Chưa có SĐT"}
                {customer.email ? `  •  ${customer.email}` : ""}
              </Text>
            </View>

            <View style={styles.quickActions}>
              {customer.diDong ? (
                <TouchableOpacity
                  style={styles.actionChip}
                  onPress={() => handleCall(customer.diDong)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Phone size={12} color="#10B981" />
                  <Text style={styles.actionChipText}>Gọi</Text>
                </TouchableOpacity>
              ) : null}
              {customer.email ? (
                <TouchableOpacity
                  style={styles.actionChip}
                  onPress={() => handleEmail(customer.email)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Mail size={12} color="#3B82F6" />
                  <Text style={[styles.actionChipText, { color: "#3B82F6" }]}>
                    Email
                  </Text>
                </TouchableOpacity>
              ) : null}
              {customer?.company ? (
                <View style={styles.companyChip}>
                  <Building2 size={11} color={Colors.textSecondary} />
                  <Text style={styles.companyChipText} numberOfLines={1}>
                    {customer.company}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <ChevronRight size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      );
    },
    [handleDeleteKH, router, handleCall, handleEmail]
  );

  const keyExtractor = useCallback(
    (item: any) => item.maKH?.toString(),
    []
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    []
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Khách hàng",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBtn}
            >
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/customer/new")}
              style={styles.headerBtn}
            >
              <Plus color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.topSection}>
        <View style={styles.searchBar}>
          <Search color={Colors.textTertiary} size={17} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên, SĐT, email..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="customer-search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X color={Colors.textSecondary} size={17} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "personal" && styles.tabActive]}
              onPress={() => setActiveTab("personal")}
              activeOpacity={0.8}
            >
              <User
                color={
                  activeTab === "personal" ? Colors.primary : Colors.textTertiary
                }
                size={14}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "personal" && styles.tabLabelActive,
                ]}
              >
                Cá nhân
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "business" && styles.tabActive,
              ]}
              onPress={() => setActiveTab("business")}
              activeOpacity={0.8}
            >
              <Building2
                color={
                  activeTab === "business" ? Colors.primary : Colors.textTertiary
                }
                size={14}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "business" && styles.tabLabelActive,
                ]}
              >
                Doanh nghiệp
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>{dataKH?.length ?? 0}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : dataKH.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Users color={Colors.textTertiary} size={32} />
          </View>
          <Text style={styles.emptyTitle}>Chưa có khách hàng</Text>
          <Text style={styles.emptySubtitle}>
            Nhấn + để thêm khách hàng mới
          </Text>
        </View>
      ) : (
        <FlatList
          data={dataKH}
          renderItem={renderCustomerItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          testID="customer-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FA",
  },
  headerBtn: {
    padding: 4,
  },
  topSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F3F5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 9 : 3,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: Platform.OS === "ios" ? 0 : 6,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabBar: {
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F2F3F5",
  },
  tabActive: {
    backgroundColor: "rgba(232,111,37,0.1)",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.textTertiary,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 28,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  listContent: {
    paddingVertical: 4,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  rowContent: {
    flex: 1,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  dateLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  rowBottom: {
    marginBottom: 5,
  },
  subInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#10B981",
  },
  companyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#F2F3F5",
    maxWidth: 160,
  },
  companyChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginLeft: 70,
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
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F2F3F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
