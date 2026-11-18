import { getFreshJwt, getSessionInfo, getSessionToken } from "@/services/session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { Landmark } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { FeatureGrid } from "@/components/home/FeatureGrid";
import { useChatUnreadCount } from "@/components/chat/useChat";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { ProjectCarousel } from "@/components/home/ProjectCarousel";
import { RecentSection } from "@/components/home/RecentSection";
import { Avatar, Badge, ListItem, MoneyText, Screen, StatusBadge } from "@/components/ui";
import { bookingStateBadge } from "@/lib/bookingState";
import { getScopedKey } from "@/components/utils/accountScope";
import { MENU_TAB_FEATURE_IDS } from "@/components/utils/menuTabs";
import { formatDate, maskPhone } from "@/lib/format";
import { isFeatureAllowed, resolveHomeFeatureIds, routeForFeature } from "@/lib/featureConfig";
import { features, Feature } from "@/mocks/features";
import { BookingService } from "@/services/BookingService";
import { CustomerService as CustomerSupabaseService } from "@/services/CustomerService";
import { DatCocService } from "@/services/DatCocService";
import { ProjectService } from "@/services/ProjectService";
import { colors, radius, space } from "@/theme";

const STORAGE_KEY = "@home_features_config";
const MAX_HOME_FEATURES = 6;
/** Chừa chỗ cho tab bar nổi. */
const TAB_BAR_SPACE = 100;

type SectionState = { loading: boolean; error: boolean };
const IDLE: SectionState = { loading: true, error: false };

function normalizeCustomer(item: any) {
  const raw = item?.raw || {};
  return {
    maKH: item?.maKH ?? item?.ma_kh ?? item?.id ?? raw?.MaKH ?? "",
    tenKH: (item?.tenKH ?? item?.ho_ten ?? item?.ten_kh ?? raw?.TenKH ?? "").toString().trim(),
    diDong: item?.diDong ?? item?.dien_thoai ?? item?.di_dong ?? raw?.DiDong ?? "",
    _raw: item,
  };
}

const errText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function HomeScreen() {
  const router = useRouter();
  const chatUnread = useChatUnreadCount();
  const [displayedFeatures, setDisplayedFeatures] = useState<Feature[]>([]);
  const [isAgency, setIsAgency] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);

  const [duAn, setDuAn] = useState<any[]>([]);
  const [booking, setBooking] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [khachHang, setKhachHang] = useState<any[]>([]);

  const [projectsState, setProjectsState] = useState<SectionState>(IDLE);
  const [bookingsState, setBookingsState] = useState<SectionState>(IDLE);
  const [depositsState, setDepositsState] = useState<SectionState>(IDLE);
  const [customersState, setCustomersState] = useState<SectionState>(IDLE);
  // Mục nào hiện ở Trang chủ (theo quyền module như web). Chưa đọc phiên ⇒ ẩn để không nháy mục ngoài quyền.
  const [showSection, setShowSection] = useState({ projects: false, bookings: false, deposits: false, customers: false });

  useEffect(() => {
    const checkAgency = async () => {
      const agency = (await getSessionInfo()).isAgency;
      setIsAgency(agency);
      // Mục gần đây theo quyền module như menu (getSessionInfo đã đặt luật menu theo nhóm quyền)
      setShowSection({
        projects: isFeatureAllowed("1", agency),
        bookings: isFeatureAllowed("5", agency),
        deposits: isFeatureAllowed("13", agency),
        customers: isFeatureAllowed("6", agency),
      });
    };
    checkAgency();

    const checkToken = async () => {
      const token = await getSessionToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      // JWT sắp / đã hết hạn ⇒ tự làm mới bằng token phiên (services/session.ts); chỉ về Đăng nhập khi phiên hết hẳn.
      const jwt = await getFreshJwt();
      if (!jwt) {
        console.log("[Home] không còn phiên hợp lệ -> về login");
        router.replace("/login");
      }
    };

    void checkToken();
  }, [router]);

  /* ---------------- Tải dữ liệu từng khối (lỗi khối nào báo khối đó) ---------------- */

  const loadProjects = async () => {
    setProjectsState({ loading: true, error: false });
    try {
      const resDA = await ProjectService.getProjects({ limit: 5 });
      setDuAn((resDA?.data || []).slice(0, 5));
      setProjectsState({ loading: false, error: false });
    } catch (error) {
      console.log("[Home] Error loading projects:", errText(error));
      setProjectsState({ loading: false, error: true });
    }
  };

  const loadBookings = async () => {
    setBookingsState((s) => ({ ...s, loading: true }));
    try {
      const resBooking = await BookingService.listBookingsFromCloud({
        limit: 5,
        offset: 0,
      });
      setBooking((resBooking?.data || []).slice(0, 5));
      setBookingsState({ loading: false, error: false });
    } catch (error) {
      console.log("[Home] Error loading bookings:", errText(error));
      setBookingsState({ loading: false, error: true });
    }
  };

  const loadDeposits = async () => {
    setDepositsState({ loading: true, error: false });
    try {
      if ((await getSessionInfo()).isAgency) {
        const resDC = await DatCocService.get({ Offset: 1, Limit: 5 });
        setDeposits((resDC?.data || []).slice(0, 5));
      } else {
        setDeposits([]);
      }
      setDepositsState({ loading: false, error: false });
    } catch (error) {
      console.log("[Home] Error loading deposits:", errText(error));
      setDepositsState({ loading: false, error: true });
    }
  };

  const loadCustomers = async () => {
    setCustomersState({ loading: true, error: false });
    try {
      const resKH = await CustomerSupabaseService.getCustomers({
        limit: 5,
        offset: 0,
      });
      setKhachHang((resKH?.data || []).map(normalizeCustomer).slice(0, 5));
      setCustomersState({ loading: false, error: false });
    } catch (error) {
      console.log("[Home] Error loading customers:", errText(error));
      setCustomersState({ loading: false, error: true });
    }
  };

  const loadData = () => Promise.all([loadProjects(), loadBookings(), loadDeposits(), loadCustomers()]);

  const loadFeatureConfiguration = async () => {
    // Không đọc được loại tài khoản → null (resolveHomeFeatureIds coi như đại lý cho an toàn)
    let agency: boolean | null = null;
    try {
      agency = (await getSessionInfo()).isAgency;
    } catch (error) {
      console.log("[Home] Read account type error:", errText(error));
    }
    let stored: unknown = undefined;
    try {
      const raw = await AsyncStorage.getItem(await getScopedKey(STORAGE_KEY));
      stored = raw ? JSON.parse(raw) : undefined;
    } catch (error) {
      console.log("[Home] Load feature config error:", errText(error));
      stored = null; // hỏng → dùng mặc định
    }
    const ids = resolveHomeFeatureIds({
      stored,
      isAgency: agency,
      allIds: features.map((f) => f.id),
      menuEligible: MENU_TAB_FEATURE_IDS,
      max: MAX_HOME_FEATURES,
    });
    setDisplayedFeatures(ids.map((id) => features.find((f) => f.id === id)).filter((f): f is Feature => !!f));
  };

  useEffect(() => {
    loadFeatureConfiguration().catch(() => {});
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quay lại màn Home (sau thanh toán / duyệt / huỷ booking...) → nạp lại booking gần đây
  // để trạng thái khớp chi tiết. Lần focus đầu bỏ qua vì useEffect mount đã tải.
  const hasFocusedOnce = useRef(false);
  const refreshRecentBookings = useCallback(async () => {
    try {
      const resBooking = await BookingService.listBookingsFromCloud({
        limit: 5,
        offset: 0,
      });
      setBooking((resBooking?.data || []).slice(0, 5));
    } catch (error) {
      console.log("[Home] Error refreshing bookings:", errText(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFeatureConfiguration();
      if (hasFocusedOnce.current) void refreshRecentBookings();
      hasFocusedOnce.current = true;
    }, [refreshRecentBookings]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadFeatureConfiguration()]);
    setRefreshing(false);
  };

  /* ---------------- Điều hướng ---------------- */

  const openProject = (property: any) =>
    router.push({
      pathname: "/project/[id]" as const,
      params: { id: property.MaDA, project: JSON.stringify(property) },
    });

  const openFeature = (featureId: string) => {
    const route = routeForFeature(featureId);
    if (route) router.push(route as never);
  };

  return (
    <Screen
      padded={false}
      bottomInset={TAB_BAR_SPACE}
      refreshing={refreshing}
      onRefresh={onRefresh}
      header={
        <HomeHeader
          // Kính lúp ⇒ màn Sản phẩm với ô tìm focus sẵn (gõ ngay được)
          onSearchPress={() => router.push({ pathname: "/products", params: { search: "1" } })}
          onBellPress={() => router.push("/notifications")}
          onChatPress={() => router.push("/chat")}
          chatUnread={chatUnread}
        />
      }
    >
      <View style={styles.sections}>
        <View style={styles.block}>
          <HomeSectionHeader title="Quản lý" actionLabel="Tất cả" onAction={() => router.push("/all-management")} />
          <FeatureGrid
            items={displayedFeatures.map((f) => ({
              key: f.id,
              feature: f,
              onPress: () => openFeature(f.id),
            }))}
          />
        </View>

        {showSection.projects ? (
          <View style={styles.carousel}>
            <View style={styles.carouselHead}>
              <HomeSectionHeader
                title="Dự án nổi bật"
                actionLabel="Xem tất cả"
                onAction={() => router.push("/projects")}
              />
            </View>
            <ProjectCarousel
              projects={duAn}
              loading={projectsState.loading}
              error={projectsState.error}
              onRetry={() => void loadProjects()}
              onPress={openProject}
            />
          </View>
        ) : null}

        {showSection.bookings ? (
          <RecentSection
            title="Booking gần đây"
            items={booking}
            loading={bookingsState.loading}
            error={bookingsState.error}
            onRetry={() => void loadBookings()}
            onSeeAll={() => router.push("/bookings")}
            emptyText="Chưa có booking nào."
            renderItem={(b: any) => (
              <ListItem
                leading={<Avatar name={b.khachHang || "?"} size={44} round />}
                title={b.khachHang || "—"}
                subtitle={[b.maSanPham, b.tenDA].filter(Boolean).join(" · ")}
                meta={formatDate(b.ngayGiuCho)}
                trailing={
                  <>
                    <MoneyText value={b.tongGiaGomVAT ?? b.tong_gia} short />
                    <Badge {...bookingStateBadge(b.state)} />
                  </>
                }
                onPress={() =>
                  router.push({
                    pathname: "/booking/[id]",
                    params: { id: b.id ?? b.maPGC },
                  })
                }
              />
            )}
          />
        ) : null}

        {isAgency ? (
          showSection.deposits ? (
            <RecentSection
              title="Đặt cọc gần đây"
              items={deposits}
              loading={depositsState.loading}
              error={depositsState.error}
              onRetry={() => void loadDeposits()}
              onSeeAll={() => router.push("/deposits")}
              emptyText="Chưa có phiếu đặt cọc nào."
              renderItem={(d: any) => (
                <ListItem
                  leading={
                    <View style={styles.depositIcon}>
                      <Landmark size={20} color={colors.brand} />
                    </View>
                  }
                  title={d.KhachHang || "—"}
                  subtitle={[d.MaSanPham, d.TenDA].filter(Boolean).join(" · ")}
                  meta={formatDate(d.NgayDatCoc)}
                  trailing={
                    <>
                      <MoneyText value={d.TienCoc} short />
                      {d.TenTT ? <StatusBadge label={d.TenTT} color={d.MauNen} /> : null}
                    </>
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/deposit/[id]",
                      params: {
                        id: String(d.MaPDC ?? ""),
                        data: JSON.stringify({
                          ...d,
                          maDC: String(d.MaPDC ?? ""),
                          soPhieu: d.SoPhieu || "",
                          tenKH: d.KhachHang || "",
                          maSP: d.MaSanPham || "",
                          soTienCoc: d.TienCoc || 0,
                          trangThai: d.TenTT || "",
                          tenDA: d.TenDA || "",
                        }),
                      },
                    })
                  }
                />
              )}
            />
          ) : null
        ) : showSection.customers ? (
          <RecentSection
            title="Khách hàng gần đây"
            items={khachHang}
            loading={customersState.loading}
            error={customersState.error}
            onRetry={() => void loadCustomers()}
            onSeeAll={() => router.push("/customers")}
            emptyText="Chưa có khách hàng nào."
            renderItem={(c: any) => (
              <ListItem
                leading={<Avatar name={c.tenKH || "?"} size={44} round />}
                title={c.tenKH || "—"}
                subtitle={maskPhone(c.diDong) || undefined}
                chevron
                onPress={() =>
                  router.push({
                    pathname: "/customer/[id]",
                    params: { id: c._raw?.id || c.maKH },
                  })
                }
              />
            )}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.x3 - 4 },
  block: { gap: space.md, paddingHorizontal: space.xl },
  carousel: { gap: space.sm },
  carouselHead: { paddingHorizontal: space.xl },
  depositIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
});
