import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { Landmark } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { FeatureGrid } from "@/components/home/FeatureGrid";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ProjectCarousel } from "@/components/home/ProjectCarousel";
import { RecentSection } from "@/components/home/RecentSection";
import {
  Avatar,
  ListItem,
  MoneyText,
  Screen,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { getScopedKey } from "@/components/utils/accountScope";
import { MENU_TAB_FEATURE_IDS } from "@/components/utils/menuTabs";
import { formatDate, maskPhone } from "@/lib/format";
import { resolveHomeFeatureIds, routeForFeature } from "@/lib/featureConfig";
import { features, Feature } from "@/mocks/features";
import { BookingService } from "@/sevicesSupabase/BookingService";
import { CustomerService as CustomerSupabaseService } from "@/sevicesSupabase/CustomerService";
import { DatCocService } from "@/sevicesSupabase/DatCocService";
import { LichHenService } from "@/sevicesSupabase/LichHenService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
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
  const [displayedFeatures, setDisplayedFeatures] = useState<Feature[]>([]);
  const [isAgency, setIsAgency] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);

  const [duAn, setDuAn] = useState<any[]>([]);
  const [booking, setBooking] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [khachHang, setKhachHang] = useState<any[]>([]);
  const [, setLichHen] = useState<any[]>([]);

  const [projectsState, setProjectsState] = useState<SectionState>(IDLE);
  const [bookingsState, setBookingsState] = useState<SectionState>(IDLE);
  const [depositsState, setDepositsState] = useState<SectionState>(IDLE);
  const [customersState, setCustomersState] = useState<SectionState>(IDLE);

  useEffect(() => {
    const checkAgency = async () => {
      const typeAccount = await AsyncStorage.getItem("@type_account");
      setIsAgency(typeAccount === "AGENCY");
    };
    checkAgency();

    const checkToken = async () => {
      const token = await AsyncStorage.getItem("@token");
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const supabaseJwt = await AsyncStorage.getItem("@supabase_jwt");
        if (!supabaseJwt) {
          console.log("[Home] chưa có cloud_jwt -> về login");
          router.replace("/login");
          return;
        }
        // Giữ require lười như bản cũ (tránh vòng import lúc khởi động)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cloudTenant = require("@/sevicesSupabase/cloudTenant");
        if (cloudTenant.isJwtExpired(supabaseJwt)) {
          const p = cloudTenant.decodeJwtPayload(supabaseJwt);
          console.log(
            `[Home] cloud_jwt expired (exp=${p?.exp}, now=${Math.floor(Date.now() / 1000)}) -> về login lấy JWT mới`
          );
          router.replace("/login");
          return;
        }
      } catch {}
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
      const resBooking = await BookingService.listBookingsFromCloud({ limit: 5, offset: 0 });
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
      const typeAccount = await AsyncStorage.getItem("@type_account");
      if (typeAccount === "AGENCY") {
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
      const resKH = await CustomerSupabaseService.getCustomers({ limit: 5, offset: 0 });
      setKhachHang((resKH?.data || []).map(normalizeCustomer).slice(0, 5));
      setCustomersState({ loading: false, error: false });
    } catch (error) {
      console.log("[Home] Error loading customers:", errText(error));
      setCustomersState({ loading: false, error: true });
    }
  };

  const loadAppointments = async () => {
    try {
      const resLH = await LichHenService.listRecent({ limit: 5 });
      setLichHen((resLH?.data || []).slice(0, 5));
    } catch (error) {
      console.log("[Home] Error loading appointments:", errText(error));
    }
  };

  const loadData = () =>
    Promise.all([loadProjects(), loadBookings(), loadDeposits(), loadCustomers(), loadAppointments()]);

  const loadFeatureConfiguration = async () => {
    // Không đọc được loại tài khoản → null (resolveHomeFeatureIds coi như đại lý cho an toàn)
    let agency: boolean | null = null;
    try {
      agency = (await AsyncStorage.getItem("@type_account")) === "AGENCY";
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
      const resBooking = await BookingService.listBookingsFromCloud({ limit: 5, offset: 0 });
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
    }, [refreshRecentBookings])
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
          onSearchPress={() => router.push("/products")}
          onBellPress={() => router.push("/notifications")}
        />
      }
    >
      <View style={styles.block}>
        <SectionHeader title="Quản lý" actionLabel="Tất cả" onAction={() => router.push("/all-management")} />
        <FeatureGrid
          items={displayedFeatures.map((f) => ({ key: f.id, feature: f, onPress: () => openFeature(f.id) }))}
        />
      </View>

      <View style={styles.carouselHead}>
        <SectionHeader title="Dự án nổi bật" actionLabel="Xem tất cả" onAction={() => router.push("/projects")} />
      </View>
      <ProjectCarousel
        projects={duAn}
        loading={projectsState.loading}
        error={projectsState.error}
        onRetry={() => void loadProjects()}
        onPress={openProject}
      />

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
            leading={<Avatar name={b.khachHang || "?"} />}
            title={b.khachHang || "—"}
            subtitle={[b.maSanPham, b.tenDA].filter(Boolean).join(" · ")}
            meta={formatDate(b.ngayGiuCho)}
            trailing={
              <>
                <MoneyText value={b.tongGiaGomVAT ?? b.tong_gia} short />
                {b.tenTT ? <StatusBadge label={b.tenTT} color={b.colorCode} /> : null}
              </>
            }
            onPress={() => router.push({ pathname: "/booking/[id]", params: { id: b.id ?? b.maPGC } })}
          />
        )}
      />

      {isAgency ? (
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
      ) : (
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
              leading={<Avatar name={c.tenKH || "?"} />}
              title={c.tenKH || "—"}
              subtitle={maskPhone(c.diDong) || undefined}
              chevron
              onPress={() =>
                router.push({ pathname: "/customer/[id]", params: { id: c._raw?.id || c.maKH } })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  carouselHead: { paddingHorizontal: space.lg },
  depositIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
});
