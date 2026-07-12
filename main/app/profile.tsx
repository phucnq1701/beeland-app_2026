import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { UserService } from "@/sevices/UserService";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      setLoading(true);
      const res = await UserService.userInfo();
      setUser(res?.data);
    } catch (error) {
      console.log("load user error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: "Thông tin cá nhân" }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang tải thông tin...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Thông tin cá nhân" }} />

      {/* PROFILE CARD */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.HoTen?.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>

        <Text style={styles.name}>{user?.HoTen}</Text>
        <Text style={styles.email}>{user?.Email}</Text>
      </View>

      {/* INFO LIST */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Họ tên</Text>
          <Text style={styles.value}>{user?.HoTen}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.Email}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Số điện thoại</Text>
          <Text style={styles.value}>{user?.DiDong}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7fb",
    paddingHorizontal: 16,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f6f7fb",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },

  profileCard: {
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 28,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#fff",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,

    elevation: 4,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  avatarText: {
    fontSize: 36,
    color: "#fff",
    fontWeight: "700",
  },

  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },

  email: {
    marginTop: 4,
    fontSize: 14,
    color: "#777",
  },

  infoContainer: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,

    elevation: 3,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },

  label: {
    fontSize: 15,
    color: "#666",
    fontWeight: "500",
  },

  value: {
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
    maxWidth: width * 0.55,
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#eee",
  },
});