import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
  Trash,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { customers, CustomerType } from "@/mocks/customers";
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
      loadData(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeleteKH = async (maKH) => {
    let res:any;
    Alert.alert("Xác nhận", "Bạn có muốn xoá khách hàng?", [
      {
        text: "Có",
        onPress: async () => {
          try {
            res = await CustomerService.delete({ MaKH: [maKH] });
            console.log(res);

            if (res?.status === 2000) {
              loadData(searchQuery);
              Alert.alert("Thành công", res?.message);
            } else {
              Alert.alert("Lỗi", res?.message);
            }
          } catch (error) {
            console.log("delete error:", error);
            Alert.alert("Lỗi", res?.message);
          }
        },
      },
      {
        text: "Không",
        style: "cancel",
      },
    ]);
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesTab = customer.type === activeTab;
    const matchesSearch = searchQuery
      ? customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery) ||
        customer.email.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesTab && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#10B981";
      case "potential":
        return "#F59E0B";
      case "inactive":
        return "#9CA3AF";
      default:
        return "#9CA3AF";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Đang giao dịch";
      case "potential":
        return "Tiềm năng";
      case "inactive":
        return "Không hoạt động";
      default:
        return "";
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Khách hàng",
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackButton}
            >
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/customer/new")}
              style={styles.headerAddButton}
            >
              <Plus color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            styles.tabLeft,
            activeTab === "personal" && styles.tabActive,
          ]}
          onPress={() => setActiveTab("personal")}
          activeOpacity={0.8}
        >
          <User
            color={activeTab === "personal" ? Colors.white : Colors.text}
            size={20}
          />
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
          style={[
            styles.tab,
            styles.tabRight,
            activeTab === "business" && styles.tabActive,
          ]}
          onPress={() => setActiveTab("business")}
          activeOpacity={0.8}
        >
          <Building2
            color={activeTab === "business" ? Colors.white : Colors.text}
            size={20}
          />
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchContainer}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm theo tên, số điện thoại, email..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text style={styles.resultCount}>
          Hiển thị <Text style={styles.resultCountBold}>{dataKH?.length}</Text>{" "}
          khách hàng
        </Text>
        {loading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color="#f5ca1c" />
            <Text style={{ marginTop: 10 }}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <View style={styles.customerList}>
            {dataKH.map((customer) => (
              <View key={customer.maKH} style={styles.customerCard}>
                <View style={styles.customerHeader}>
                  <View style={styles.customerNameRow}>
                    <View
                      style={[
                        styles.customerAvatar,
                        {
                          backgroundColor:
                            activeTab === "personal" ? "#EFF6FF" : "#FDF2F8",
                        },
                      ]}
                    >
                      {activeTab === "personal" ? (
                        <User color={Colors.primary} size={20} />
                      ) : (
                        <Building2 color="#EC4899" size={20} />
                      )}
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        flex: 1,
                      }}
                    >
                      <View style={styles.customerNameContainer}>
                        <Text style={styles.customerName}>
                          {customer.tenKH}
                        </Text>
                        {customer?.company && (
                          <Text style={styles.customerCompany}>
                            {customer.company}
                          </Text>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDeleteKH(customer?.maKH)}
                        activeOpacity={0.7}
                        style={{ padding: 6 }}
                      >
                        <Trash size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(customer.status) },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(customer.status)}
                  </Text>
                </View> */}
                </View>

                <View style={styles.customerInfo}>
                  <View style={styles.infoRow}>
                    <Phone color={Colors.textSecondary} size={16} />
                    <Text style={styles.infoText}>{customer.diDong}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Mail color={Colors.textSecondary} size={16} />
                    <Text style={styles.infoText}>{customer.email}</Text>
                  </View>
                  {customer?.taxCode && (
                    <View style={styles.infoRow}>
                      <Building2 color={Colors.textSecondary} size={16} />
                      <Text style={styles.infoText}>
                        MST: {customer.taxCode}
                      </Text>
                    </View>
                  )}
                </View>

                {/* {customer.projects.length > 0 && (
                <View style={styles.projectsContainer}>
                  <Text style={styles.projectsLabel}>Dự án quan tâm:</Text>
                  <View style={styles.projectTags}>
                    {customer.projects.map((project, index) => (
                      <View key={index} style={styles.projectTag}>
                        <Text style={styles.projectTagText}>{project}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )} */}

                <View style={styles.customerFooter}>
                  <Text style={styles.customerDate}>
                    Tạo:{" "}
                    {new Date(customer.ngayDangKy).toLocaleDateString("vi-VN")}
                  </Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    // onPress={() => router.push(`/customer/${customer.maSoKH}`)}
                    onPress={() => router.push(`/customer/${customer.maKH}`)}
                    activeOpacity={0.7}
                  >
                    <Eye color={Colors.primary} size={18} />
                    <Text style={styles.editButtonText}>Chi tiết</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  headerAddButton: {
    marginRight: 8,
  },
  tabContainer: {
    flexDirection: "row",
    margin: 24,
    marginBottom: 0,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  tabLeft: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  tabRight: {},
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  tabTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  resultCount: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  resultCountBold: {
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  customerList: {
    gap: 16,
  },
  customerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  customerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  customerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  customerNameContainer: {
    // flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customerCompany: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  customerInfo: {
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  projectsContainer: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  projectsLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  projectTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  projectTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF4ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  projectTagText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  customerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: "italic" as const,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
});
