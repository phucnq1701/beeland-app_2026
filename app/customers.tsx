import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { LogIn, Plus, SearchX, Users } from "lucide-react-native";

import {
  AppHeader,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  SearchBar,
  SegmentedControl,
  SkeletonList,
} from "@/components/ui";
import { CustomerListItem } from "@/components/customer/CustomerListItem";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { colors, space } from "@/theme";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

type CustomerTab = "all" | "personal" | "business";
type StatusOption = { id: string; label: string; value: string; color?: string };

const PAGE_SIZE = 20;
/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

const TABS: { value: CustomerTab; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "personal", label: "Cá nhân" },
  { value: "business", label: "Doanh nghiệp" },
];

export default function CustomersScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CustomerTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [statusId, setStatusId] = useState("all");
  const [statusCatalogs, setStatusCatalogs] = useState<StatusOption[]>([]);

  const [dataKH, setDataKH] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Chỉ nhận kết quả của lần gọi mới nhất (gõ nhanh / đổi bộ lọc liên tục)
  const requestId = useRef(0);
  const latest = useRef({ search: debouncedQuery, tab: activeTab, statusId, statusCatalogs });
  latest.current = { search: debouncedQuery, tab: activeTab, statusId, statusCatalogs };
  const isFirstFocus = useRef(true);

  useEffect(() => {
    CustomerService.getTrangThaiCatalogs()
      .then((list: any[]) => setStatusCatalogs(Array.isArray(list) ? list : []))
      .catch((e: unknown) => console.log("Error loading customer statuses:", e));
  }, []);

  const fetchCustomers = useCallback(async (kind: "load" | "refresh" | "more", offset = 0) => {
    const { search, tab, statusId: st, statusCatalogs: cats } = latest.current;
    const id = ++requestId.current;
    if (kind === "more") setLoadingMore(true);
    else if (kind === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const res: any = await CustomerService.getCustomers({
        search,
        isPersonal: tab === "personal" ? true : tab === "business" ? false : undefined,
        maTtId: st !== "all" ? st : undefined,
        // Tên trạng thái – service dùng để resolve UUID / lọc xác nhận phía client
        statusLabel: st !== "all" ? cats.find((s) => s.value === st)?.label : undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if (id !== requestId.current) return;
      const list = Array.isArray(res?.data) ? res.data : [];
      setDataKH((prev) => (kind === "more" ? [...prev, ...list] : list));
      setTotal(res?.total ?? 0);
      setHasMore(!!res?.hasMore);
      setLoadError(false);
      // Hết phiên đăng nhập → báo đăng nhập lại thay vì "Chưa có khách hàng"
      setAuthError(
        res?.authError ? res?.message || "Chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại." : null
      );
    } catch (error) {
      console.log("Fetch customers error:", error);
      if (id !== requestId.current) return;
      if (kind !== "more") {
        setDataKH([]);
        setTotal(0);
        setLoadError(true);
      }
      setHasMore(false);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchCustomers("load");
  }, [debouncedQuery, activeTab, statusId, fetchCustomers]);

  // Quay về màn này (sau Thêm/Sửa/Xoá) → tải lại để thấy dữ liệu mới; bỏ lần focus đầu
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void fetchCustomers("load");
    }, [fetchCustomers])
  );

  const loadMore = () => {
    if (loading || loadingMore || refreshing || !hasMore || dataKH.length === 0) return;
    void fetchCustomers("more", dataKH.length);
  };

  const openCustomer = useCallback((id: string) => router.push(`/customer/${id}` as any), [router]);
  const addCustomer = () => router.push("/customer/new" as any);

  const renderItem = useCallback(
    ({ item }: { item: any }) => <CustomerListItem item={item} onPress={openCustomer} />,
    [openCustomer]
  );

  const listHeader = (
    <View style={styles.stickyHeader}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Tìm tên, SĐT, CCCD, email, mã KH…"
      />
      <SegmentedControl value={activeTab} options={TABS} onChange={setActiveTab} />
      {statusCatalogs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tất cả" selected={statusId === "all"} onPress={() => setStatusId("all")} />
          {statusCatalogs.map((s) => (
            <Chip
              key={String(s.id ?? s.value)}
              label={s.label}
              selected={statusId === s.value}
              onPress={() => setStatusId(s.value)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  const renderBody = () => {
    if (loading && dataKH.length === 0) return <SkeletonList />;
    if (authError) {
      return (
        <EmptyState
          icon={LogIn}
          title="Phiên đăng nhập đã hết hạn"
          description={`${authError}\nHãy đăng nhập lại bằng đúng tài khoản web để xem danh sách khách hàng.`}
          actionLabel="Đăng nhập lại"
          onAction={() => router.replace("/login" as any)}
        />
      );
    }
    if (loadError) {
      return <ErrorState description="Không tải được danh sách khách hàng." onRetry={() => void fetchCustomers("load")} />;
    }
    if (searchQuery || statusId !== "all" || activeTab !== "all") {
      return (
        <EmptyState
          icon={SearchX}
          title="Không có khách hàng phù hợp"
          description="Thử từ khoá khác hoặc bỏ bớt bộ lọc."
          actionLabel="Xoá bộ lọc"
          onAction={() => {
            setSearchQuery("");
            setStatusId("all");
            setActiveTab("all");
          }}
        />
      );
    }
    return (
      <EmptyState
        icon={Users}
        title="Chưa có khách hàng"
        description="Thêm khách hàng đầu tiên để bắt đầu tạo booking."
        actionLabel="Thêm khách hàng"
        onAction={addCustomer}
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={
          <AppHeader
            title="Khách hàng"
            subtitle={`${total} khách hàng`}
            // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
            hideBack={embedded}
            actions={<IconButton icon={Plus} accessibilityLabel="Thêm khách hàng" onPress={addCustomer} />}
          />
        }
      >
        <FlatList
          data={loading && dataKH.length === 0 ? [] : dataKH}
          keyExtractor={(item, index) => `${item?.id ?? "kh"}-${index}`}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={listHeader}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={renderBody()}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchCustomers("refresh")}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: embedded ? TAB_BAR_SPACE : space.xxl }}
        />
      </Screen>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  chips: { gap: space.sm, paddingRight: space.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 72 },
  footerSpinner: { paddingVertical: space.lg },
});
