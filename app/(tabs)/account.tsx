import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  User,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Building2,
  Package,
  Lock,
  Calendar,
  Users,
  Receipt,
  Coins,
  FileText,
  BarChart3,
  Crown,
  Sparkles,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { UserService } from "../sevices/UserService";
import { ProjectService } from "../sevices/ProjectService";
import { CustomerService } from "../sevices/CustomerService";

const { width } = Dimensions.get("window");

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface ManagementItem {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  route: string;
  color: string;
}

const menuItems: MenuItem[] = [
  { id: "1", title: "Thông tin cá nhân", icon: User, color: Colors.iconOrange },
  { id: "2", title: "Cài đặt", icon: Settings, color: Colors.iconBlue },
  { id: "3", title: "Thông báo", icon: Bell, color: Colors.iconGreen },
  { id: "4", title: "Trợ giúp", icon: HelpCircle, color: Colors.iconPurple },
];

const managementItems: ManagementItem[] = [
  {
    id: "1",
    title: "Dự án",
    icon: Building2,
    route: "/projects",
    color: Colors.iconOrange,
  },
  {
    id: "2",
    title: "Sản phẩm",
    icon: Package,
    route: "/products",
    color: Colors.iconBlue,
  },
  {
    id: "3",
    title: "Lock căn",
    icon: Lock,
    route: "/locked-units",
    color: Colors.iconYellow,
  },
  {
    id: "4",
    title: "Lịch hẹn",
    icon: Calendar,
    route: "/appointments",
    color: Colors.iconGreen,
  },
  {
    id: "5",
    title: "Khách hàng",
    icon: Users,
    route: "/customers",
    color: Colors.iconPink,
  },
  {
    id: "6",
    title: "Booking",
    icon: Receipt,
    route: "/bookings",
    color: Colors.iconBlue,
  },
  {
    id: "7",
    title: "Hoa hồng",
    icon: Coins,
    route: "/commissions",
    color: Colors.iconGreen,
  },
  {
    id: "8",
    title: "Hợp đồng",
    icon: FileText,
    route: "/contracts",
    color: Colors.iconPurple,
  },
  {
    id: "9",
    title: "Báo cáo",
    icon: BarChart3,
    route: "/reports",
    color: Colors.iconPink,
  },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showAllManagement, setShowAllManagement] = React.useState(false);
  const [data, setData] = useState<any>(null);
  const [duAn, setDuAn] = useState<any[]>([]);
  const [khachHang, setKhachHang] = useState<any>(null);

  const handleLogout = () => {
    router.push("/login");
  };

  const handleManagementItemPress = (route: string) => {
    router.push(route as never);
  };

  const loadData = async () => {
    let res = await UserService.userInfo();
    setData(res?.data ?? null);

    const resDA = await ProjectService.getProjects({});
    setDuAn(resDA?.data ?? []);

    let resKH = await CustomerService.getCustomers("");
    setKhachHang(resKH?.data?.[0] ?? null);
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradients.background}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.greetingRow}>
                <Sparkles size={14} color={Colors.primary} />
                <Text style={styles.greeting}>{data?.HoTen}</Text>
              </View>
              <Text style={styles.headerTitle}>Cài đặt</Text>
            </View>
            <View style={styles.premiumBadge}>
              <Crown size={14} color={Colors.primary} />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileCardContainer}>
          <View style={styles.profileCard}>
            <LinearGradient
              colors={[
                "rgba(232, 111, 37, 0.08)",
                "rgba(255, 138, 76, 0.04)",
                "transparent",
              ]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={Colors.gradients.primary}
                style={styles.avatar}
              >
                <User color={Colors.white} size={36} />
              </LinearGradient>
              <View style={styles.statusDot} />
            </View>
            <Text style={styles.profileName}>{data?.HoTen}</Text>
            <Text style={styles.profileEmail}>{data?.Email}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{duAn?.length}</Text>
                <Text style={styles.statLabel}>Dự án</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{khachHang?.totalRows}</Text>
                <Text style={styles.statLabel}>Khách hàng</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>89%</Text>
                <Text style={styles.statLabel}>Tỷ lệ</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={Colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sectionIndicator}
              />
              <Text style={styles.sectionTitle}>Quản lý</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAllManagement(!showAllManagement)}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>
                {showAllManagement ? "Thu gọn" : "Tất cả"}
              </Text>
              <ChevronRight color={Colors.primary} size={16} />
            </TouchableOpacity>
          </View>

          {showAllManagement && (
            <View style={styles.managementGrid}>
              {managementItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.managementCard}
                  onPress={() => handleManagementItemPress(item.route)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.managementIconContainer,
                      { backgroundColor: `${item.color}18` },
                    ]}
                  >
                    <item.icon color={item.color} size={24} />
                  </View>
                  <Text style={styles.managementCardTitle}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <LinearGradient
              colors={Colors.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sectionIndicator}
            />
            <Text style={styles.sectionTitle}>Cài đặt</Text>
          </View>

          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.menuItemLast,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (item.id === "1") {
                    router.push("/profile");
                  }
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View
                    style={[
                      styles.menuIconContainer,
                      { backgroundColor: `${item.color}18` },
                    ]}
                  >
                    <item.icon color={item.color} size={22} />
                  </View>
                  <Text style={styles.menuItemText}>{item.title}</Text>
                </View>
                <ChevronRight color={Colors.textTertiary} size={20} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={["rgba(239, 68, 68, 0.1)", "rgba(239, 68, 68, 0.05)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <LogOut color={Colors.error} size={20} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(232, 111, 37, 0.06)",
    top: -100,
    right: -100,
    ...(Platform.OS === "web" ? { filter: "blur(80px)" } : { opacity: 0.6 }),
  },
  orb2: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255, 138, 76, 0.05)",
    bottom: 200,
    left: -80,
    ...(Platform.OS === "web" ? { filter: "blur(60px)" } : { opacity: 0.5 }),
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  premiumText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  profileCardContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  profileCard: {
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(232, 111, 37, 0.15)",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 8px 32px rgba(232, 111, 37, 0.08)",
        backdropFilter: "blur(16px)",
      },
    }),
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
    }),
  },
  statusDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.glass.border,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  managementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
  },
  managementCard: {
    width: (width - 40 - 24) / 3,
    aspectRatio: 1,
    borderRadius: 20,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(232, 111, 37, 0.1)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 4px 16px rgba(232, 111, 37, 0.06)",
        backdropFilter: "blur(12px)",
      },
    }),
  },
  managementIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  managementCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  menuContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(232, 111, 37, 0.06)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0 2px 8px rgba(232, 111, 37, 0.04)",
        backdropFilter: "blur(12px)",
      },
    }),
  },
  menuItemLast: {
    marginBottom: 0,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    padding: 18,
    borderRadius: 18,
    gap: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    ...Platform.select({
      ios: {
        shadowColor: Colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 4px 16px rgba(239, 68, 68, 0.06)",
      },
    }),
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.error,
  },
});
