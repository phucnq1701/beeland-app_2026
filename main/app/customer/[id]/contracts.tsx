import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Search,
  FileText,
  Calendar,
  Hash,
  Package,
  DollarSign,
  X,
  AlertCircle,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevices/CustomerService";
import { useFocusEffect } from "expo-router";

interface Contract {
  maHD: string;
  soHopDong: string;
  ngayKy: string;
  tenKH: string;
  maSP: string;
  tongGiaTri: number;
  trangThai?: string;
}

function formatCurrency(value: number): string {
  if (!value && value !== 0) return "0";
  return value.toLocaleString("vi-VN") + " đ";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
}

export default function ContractHistoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await CustomerService.getHopDong({ MaKH: id });
      console.log("[Contracts] Response:", JSON.stringify(res));
      if (res?.data?.length) {
        const mapped: Contract[] = res.data.map((item: any) => ({
          maHD: item.maHD?.toString() || item.id?.toString() || "",
          soHopDong: item.soHopDong || item.soHD || "",
          ngayKy: item.ngayKy || item.ngayHD || "",
          tenKH: item.tenKH || item.tenKhachHang || "",
          maSP: item.maSP || item.maCanHo || item.maCan || "",
          tongGiaTri: item.tongGiaTri || item.giaTriHD || item.giaTri || 0,
          trangThai: item.trangThai || item.tenTT || "",
        }));
        setContracts(mapped);
      } else {
        setContracts([]);
      }
    } catch (err) {
      console.log("[Contracts] Error:", err);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        void loadContracts();
      }
    }, [id, loadContracts])
  );

  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;
    const q = searchQuery.toLowerCase().trim();
    return contracts.filter(
      (c) =>
        c.tenKH?.toLowerCase().includes(q) ||
        c.soHopDong?.toLowerCase().includes(q) ||
        c.maSP?.toLowerCase().includes(q)
    );
  }, [contracts, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const renderContract = useCallback(
    ({ item, index }: { item: Contract; index: number }) => (
      <View style={styles.contractCard} testID={`contract-card-${index}`}>
        <View style={styles.cardHeader}>
          <View style={styles.contractNumberWrap}>
            <Hash color={Colors.primary} size={14} />
            <Text style={styles.contractNumber} numberOfLines={1}>
              {item.soHopDong || "—"}
            </Text>
          </View>
          {item.trangThai ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{item.trangThai}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Calendar color={Colors.textTertiary} size={13} />
              <Text style={styles.infoLabel}>Ngày ký</Text>
            </View>
            <Text style={styles.infoValue}>{formatDate(item.ngayKy) || "—"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <FileText color={Colors.textTertiary} size={13} />
              <Text style={styles.infoLabel}>Tên KH</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {item.tenKH || "—"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Package color={Colors.textTertiary} size={13} />
              <Text style={styles.infoLabel}>Mã SP</Text>
            </View>
            <Text style={styles.infoValueHighlight} numberOfLines={1}>
              {item.maSP || "—"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <DollarSign color={Colors.textTertiary} size={13} />
              <Text style={styles.infoLabel}>Tổng giá trị</Text>
            </View>
            <Text style={styles.infoValuePrice}>
              {formatCurrency(item.tongGiaTri)}
            </Text>
          </View>
        </View>
      </View>
    ),
    []
  );

  const keyExtractor = useCallback(
    (item: Contract, index: number) => item.maHD || index.toString(),
    []
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <AlertCircle color={Colors.textTertiary} size={36} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery.trim() ? "Không tìm thấy hợp đồng" : "Chưa có hợp đồng"}
        </Text>
        <Text style={styles.emptyDesc}>
          {searchQuery.trim()
            ? "Thử tìm kiếm với từ khóa khác"
            : "Khách hàng này chưa có hợp đồng nào"}
        </Text>
      </View>
    ),
    [searchQuery]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Lịch sử hợp đồng",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            searchFocused && styles.searchBarFocused,
          ]}
        >
          <Search
            color={searchFocused ? Colors.primary : Colors.textTertiary}
            size={18}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên, SĐT, số hợp đồng..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            testID="search-input"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.textTertiary} size={18} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.resultCount}>
          <Text style={styles.resultCountText}>
            {filteredContracts.length} hợp đồng
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContracts}
          renderItem={renderContract}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmptyComponent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F6F8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  searchBarFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  resultCount: {
    marginTop: 8,
  },
  resultCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  contractCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(232,111,37,0.04)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(232,111,37,0.08)",
  },
  contractNumberWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  contractNumber: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.primary,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#10B981",
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
    maxWidth: "55%" as const,
    textAlign: "right" as const,
  },
  infoValueHighlight: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.accent.blue,
    maxWidth: "55%" as const,
    textAlign: "right" as const,
  },
  infoValuePrice: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
