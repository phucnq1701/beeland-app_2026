import React, { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Code2, LayoutGrid, LogOut, Trash2, User } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { FeatureGrid } from "@/components/home/FeatureGrid";
import {
  Avatar,
  Button,
  Card,
  confirm,
  ListItem,
  Screen,
  SectionHeader,
  Text,
  useToast,
} from "@/components/ui";
import { MENU_TAB_FEATURE_IDS } from "@/components/utils/menuTabs";
import { routeForFeature, visibleFeatureIds } from "@/lib/featureConfig";
import { features } from "@/mocks/features";
import { colors, radius, space } from "@/theme";
import { CloudProfileService, CloudProfile } from "@/sevicesSupabase/CloudProfileService";
import {
  deleteCurrentEmployee,
  clearDeletedEmployeeSession,
  DeletedEmployeeSession,
} from "@/sevicesSupabase/AccountDeletionService";

/** Chừa chỗ cho tab bar nổi. */
const TAB_BAR_SPACE = 100;

export default function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const [showAllManagement, setShowAllManagement] = React.useState(false);
  const [isAgency, setIsAgency] = useState<boolean>(false);
  const [data, setData] = useState<CloudProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [employeeDeleted, setEmployeeDeleted] = useState(false);
  const deleteBusy = useRef(false);
  const confirmationOpen = useRef(false);
  const deletedSession = useRef<DeletedEmployeeSession | null>(null);
  // Chặn bấm "Đăng xuất" 2 lần làm mở 2 màn đăng nhập chồng nhau
  const loggingOut = useRef(false);

  const handleLogout = () => {
    if (deleteBusy.current || loggingOut.current) return;
    if (deletedSession.current) {
      void performDeleteAccount();
      return;
    }
    loggingOut.current = true;
    router.push("/login");
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    loggingOut.current = false;
    setData(null);
    setLoadingProfile(true);
    setProfileError(null);
    void AsyncStorage.getItem('@type_account').then((type: string | null) => {
      if (active) setIsAgency(type === 'AGENCY');
    });
    void CloudProfileService.userInfo().then((res) => {
      if (active && !deleteBusy.current && !deletedSession.current) setData(res.data);
    }).catch((error: unknown) => {
      if (active) setProfileError(error instanceof Error ? error.message : "Không tải được hồ sơ.");
    }).finally(() => {
      if (active) setLoadingProfile(false);
    });
    return () => { active = false; };
    // `retry` cố ý: bấm "Thử lại" tăng retry để tải lại hồ sơ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]));

  const performDeleteAccount = async () => {
    if (deleteBusy.current) return;
    deleteBusy.current = true;
    setDeleting(true);
    try {
      // Khi đã xóa nhưng dọn phiên lỗi, chỉ thử dọn phiên lại, không DELETE lần hai.
      if (!deletedSession.current) {
        deletedSession.current = await deleteCurrentEmployee();
        setEmployeeDeleted(true);
        setData(null);
      }
      await clearDeletedEmployeeSession(deletedSession.current);
      queryClient.clear();
      if (router.canDismiss()) router.dismissAll();
      router.replace("/login");
    } catch (error: unknown) {
      const title = deletedSession.current ? "Chưa đăng xuất được" : "Không thể xóa";
      const message = error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
      toast.show({ type: "error", message: `${title}: ${message}` });
    } finally {
      deleteBusy.current = false;
      setDeleting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteBusy.current || confirmationOpen.current) return;
    if (deletedSession.current) {
      void performDeleteAccount();
      return;
    }
    confirmationOpen.current = true;
    const confirmed = await confirm({
      title: "Xóa tài khoản",
      message:
        "Bạn có chắc chắn muốn xóa hồ sơ nhân viên của mình như trên web và đăng xuất khỏi app? Không thể hoàn tác việc xóa hồ sơ. Tài khoản đăng nhập trên hệ thống không bị vô hiệu hóa.",
      confirmText: "Xóa",
      cancelText: "Hủy",
      destructive: true,
    });
    confirmationOpen.current = false;
    if (confirmed) void performDeleteAccount();
  };

  const managementIds = visibleFeatureIds(
    features.map((f) => f.id),
    { isAgency, menuOnly: false, menuEligible: MENU_TAB_FEATURE_IDS }
  );
  const managementFeatures = features.filter((f) => managementIds.includes(f.id));

  const profileBody = loadingProfile ? (
    <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải hồ sơ" />
  ) : profileError ? (
    <View style={styles.profileTexts}>
      <Text variant="caption" color="danger">
        {profileError}
      </Text>
      <View style={styles.links}>
        <Pressable accessibilityRole="button" hitSlop={12} style={styles.link} onPress={() => setRetry((v) => v + 1)}>
          <Text variant="caption" weight="semibold" color="primary">
            Thử lại
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={12} style={styles.link} onPress={() => router.push("/login")}>
          <Text variant="caption" weight="semibold" color="primary">
            Đăng nhập lại
          </Text>
        </Pressable>
      </View>
    </View>
  ) : (
    <View style={styles.profileTexts}>
      <Text variant="heading" numberOfLines={1}>
        {data?.HoTen || "Chưa cập nhật họ tên"}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {data?.Email || "Chưa cập nhật email"}
      </Text>
    </View>
  );

  const settingsDisabled = deleting || employeeDeleted;

  return (
    <Screen bottomInset={TAB_BAR_SPACE}>
      <Text variant="title" accessibilityRole="header" style={styles.pageTitle}>
        Tài khoản
      </Text>

      <Card
        onPress={data ? () => router.push("/profile") : undefined}
        accessibilityLabel="Xem thông tin cá nhân"
      >
        <View style={styles.profile}>
          <Avatar name={data?.HoTen || "?"} size={56} />
          {profileBody}
        </View>
      </Card>

      <SectionHeader
        title="Quản lý nhanh"
        actionLabel={showAllManagement ? "Thu gọn" : "Tất cả"}
        onAction={() => setShowAllManagement(!showAllManagement)}
      />
      {showAllManagement ? (
        <FeatureGrid
          items={managementFeatures.map((f) => ({
            key: f.id,
            feature: f,
            onPress: () => {
              const route = routeForFeature(f.id);
              if (route) router.push(route as never);
            },
          }))}
        />
      ) : null}

      <SectionHeader title="Cài đặt" />
      <Card padding={0}>
        <View pointerEvents={settingsDisabled ? "none" : "auto"} style={settingsDisabled ? styles.disabled : null}>
          <ListItem
            leading={<RowIcon icon={User} />}
            title="Thông tin cá nhân"
            chevron
            onPress={() => router.push("/profile")}
          />
        </View>
        <View
          pointerEvents={settingsDisabled ? "none" : "auto"}
          style={[styles.divider, settingsDisabled ? styles.disabled : null]}
        >
          <ListItem
            leading={<RowIcon icon={LayoutGrid} />}
            title="Cấu hình trang chủ & menu"
            chevron
            onPress={() => router.push("/all-management")}
          />
        </View>
        <View pointerEvents={deleting ? "none" : "auto"} style={styles.divider}>
          <ListItem
            leading={<RowIcon icon={Trash2} danger />}
            title={employeeDeleted ? "Thử đăng xuất lại" : "Xóa tài khoản"}
            chevron
            onPress={() => void handleDeleteAccount()}
          />
        </View>
        {__DEV__ ? (
          // Chỉ có ở bản dev: xem toàn bộ component của design system
          <View style={styles.divider}>
            <ListItem
              leading={<RowIcon icon={Code2} />}
              title="UI Gallery (dev)"
              chevron
              onPress={() => router.push("/dev/ui-gallery" as never)}
            />
          </View>
        ) : null}
      </Card>

      <Button
        variant="secondary"
        icon={LogOut}
        title="Đăng xuất"
        loading={deleting}
        onPress={handleLogout}
        fullWidth
      />

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.overlay}>
          <Card style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text variant="body" align="center">
              {employeeDeleted ? "Đang đăng xuất..." : "Đang xóa hồ sơ nhân viên..."}
            </Text>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function RowIcon({ icon: Icon, danger }: { icon: typeof User; danger?: boolean }) {
  return (
    <View style={[styles.rowIcon, danger ? styles.rowIconDanger : null]}>
      <Icon size={20} color={danger ? colors.danger : colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: { marginTop: space.sm },
  profile: { flexDirection: "row", alignItems: "center", gap: space.md },
  profileTexts: { flex: 1, gap: 2 },
  links: { flexDirection: "row", gap: space.lg, marginTop: space.xs },
  // 20 (dòng chữ) + 2×12 hitSlop = 44
  link: { minHeight: 20, justifyContent: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  disabled: { opacity: 0.5 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySubtle,
  },
  rowIconDanger: { backgroundColor: colors.dangerSubtle },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
    backgroundColor: colors.backdrop,
  },
  overlayCard: { alignItems: "center", gap: space.md, minWidth: 240 },
});
