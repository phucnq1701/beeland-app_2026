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
  Eye,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "./sevices/CustomerService";

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

  const renderCustomerItem = useCallback(
    ({ item: customer }: { item: any }) => {
      const avatarBg = getAvatarColor(customer.tenKH || "");
      return (
        <TouchableOpacity
          style={styles.customerCard}
          onPress={() => router.push(`/customer/${customer.maKH}`)}
          activeOpacity={0.7}
          testID={`customer-card-${customer.maKH}`}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>
                {getInitials(customer.tenKH)}
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.customerName} numberOfLines={1}>
                {customer.tenKH}
              </Text>
              {customer?.company ? (
                <Text style={styles.customerCompany} numberOfLines={1}>
                  {customer.company}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => handleDeleteKH(customer?.maKH)}
              activeOpacity={0.6}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.contactRow}>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrap}>
                <Phone color={Colors.primary} size={14} />
              </View>
              <Text style={styles.contactText} numberOfLines={1}>
                {customer.diDong || "—"}
              </Text>
            </View>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrap}>
                <Mail color={Colors.accent.blue} size={14} />
              </View>
              <Text style={styles.contactText} numberOfLines={1}>
                {customer.email || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.dateText}>
              {new Date(customer.ngayDangKy).toLocaleDateString("vi-VN")}
            </Text>
            <View style={styles.viewDetailBtn}>
              <Eye color={Colors.primary} size={15} />
              <Text style={styles.viewDetailText}>Chi tiết</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleDeleteKH, router]
  );

  const keyExtractor = useCallback(
    (item: any) => item.maKH?.toString(),
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
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
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
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "personal" && styles.tabActive]}
            onPress={() => setActiveTab("personal")}
            activeOpacity={0.8}
          >
            <User
              color={activeTab === "personal" ? Colors.white : Colors.textSecondary}
              size={18}
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
            style={[styles.tab, activeTab === "business" && styles.tabActive]}
            onPress={() => setActiveTab("business")}
            activeOpacity={0.8}
          >
            <Building2
              color={activeTab === "business" ? Colors.white : Colors.textSecondary}
              size={18}
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

        <View style={styles.searchBar}>
          <Search color={Colors.textSecondary} size={18} />
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
              <X color={Colors.textSecondary} size={18} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.countRow}>
          <Users color={Colors.textSecondary} size={14} />
          <Text style={styles.countText}>
            <Text style={styles.countNumber}>{dataKH?.length ?? 0}</Text> khách
            hàng
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : dataKH.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Users color={Colors.textTertiary} size={48} />
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
    backgroundColor: "#F5F6F8",
  },
  headerBtn: {
    padding: 4,
  },
  topSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 6px rgba(0,0,0,0.04)" },
    }),
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F0F1F3",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
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
  tabLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F1F3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: Platform.OS === "ios" ? 0 : 6,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  countNumber: {
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  customerCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 3px 10px rgba(0,0,0,0.06)" },
    }),
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  cardInfo: {
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
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 10,
  },
  contactRow: {
    gap: 8,
    marginBottom: 10,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F5F6F8",
    justifyContent: "center",
    alignItems: "center",
  },
  contactText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  viewDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(232,111,37,0.08)",
    borderRadius: 6,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.primary,
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
    gap: 8,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
