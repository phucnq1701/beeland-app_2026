import React, { useCallback, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, LucideIcon, Mail, MessageCircle, Pencil, Phone, ScrollText, Trash2 } from "lucide-react-native";

import {
  AppHeader,
  Avatar,
  Badge,
  Card,
  ErrorState,
  IconButton,
  KeyValueRow,
  Screen,
  SkeletonDetail,
  StatusBadge,
  Text,
  confirm,
  useToast,
} from "@/components/ui";
import { callPhone, openZalo } from "@/components/customer/CustomerListItem";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors, elevation, hitSlop, radius, space } from "@/theme";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

/** Nút liên hệ nhanh: vòng tròn nền nhạt + nhãn bên dưới (kiểu danh bạ). */
function QuickAction({
  icon: Icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [styles.quickItem, pressed ? styles.pressedFade : null]}
    >
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Icon size={20} color={color} strokeWidth={2.2} />
      </View>
      <Text variant="caption" weight="medium" color="textSecondary">
        {label}
      </Text>
    </Pressable>
  );
}

type Detail = {
  id: string;
  maSoKh: string;
  name: string;
  phone: string;
  phone2: string;
  email: string;
  company: string;
  cccd: string;
  taxCode: string;
  isPersonal: boolean;
  status: string;
  statusColor: string | null;
  source: string;
  diaChi: string;
  nguoiDaiDienPl: string;
  chucVu: string;
};

function toDetail(d: any): Detail {
  const isPersonal = d.is_personal !== false;
  return {
    id: String(d.id),
    maSoKh: d.ma_so_kh || "",
    name: (isPersonal ? d.ten_kh : d.ten_cong_ty) || d.tenKH || "",
    phone: d.diDong || d.dien_thoai || "",
    phone2: d.di_dong2 || "",
    email: d.email || d.email_ct || "",
    company: !isPersonal
      ? d.ten_cong_ty || d.cty?.ten_ct_vt || d.cty?.ten_ct || ""
      : d.tenSan || d.cty?.ten_ct_vt || d.cty?.ten_ct || "",
    cccd: d.cccd || d.so_cmnd || "",
    taxCode: d.ma_so_thue_ct || d.ma_so_ttncn || "",
    isPersonal,
    // Chưa chọn trạng thái → không hiện badge (như danh sách)
    status: d.tenTT || d.status || "",
    statusColor: d.statusColor || null,
    source: d.tenNguon || "",
    diaChi: d.diaChi || d.dia_chi || d.thuong_tru || d.dia_chi_ct || "",
    nguoiDaiDienPl: d.nguoi_dai_dien_pl || "",
    chucVu: d.chuc_vu || "",
  };
}

export default function CustomerDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams();
  const [customer, setCustomer] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await CustomerService.getCustomerDetailCloud(String(id));
      setCustomer(d ? toDetail(d) : null);
    } catch (err) {
      console.log("Error get customer detail:", err);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDelete = async () => {
    if (!customer || deletingRef.current) return;
    const ok = await confirm({
      title: "Xoá khách hàng?",
      message: `Khách hàng "${customer.name}" sẽ bị xoá vĩnh viễn.`,
      confirmText: "Xoá",
      cancelText: "Huỷ",
      destructive: true,
    });
    if (!ok) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      const res: any = await CustomerService.deleteCustomer(customer.id);
      if (res?.status === 2000) {
        hapticSuccess();
        toast.show({ type: "success", message: "Đã xoá khách hàng" });
        router.back();
      } else {
        hapticError();
        toast.show({ type: "error", message: res?.message || "Không thể xoá khách hàng" });
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const header = (
    <AppHeader
      variant="soft"
      title="Khách hàng"
      actions={
        customer ? (
          <View style={styles.headerActions}>
            <IconButton
              icon={Pencil}
              variant="soft"
              accessibilityLabel="Sửa khách hàng"
              onPress={() => router.push(`/customer/${customer.id}/edit` as any)}
            />
            <IconButton
              icon={Trash2}
              variant="soft"
              accessibilityLabel="Xoá khách hàng"
              color={colors.danger}
              disabled={deleting}
              onPress={() => void handleDelete()}
            />
          </View>
        ) : null
      }
    />
  );

  if (!customer) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          {loading ? <SkeletonDetail /> : <ErrorState description="Không tìm thấy khách hàng." onRetry={() => void load()} />}
        </Screen>
      </>
    );
  }

  const c = customer;
  const rows: [string, string][] = [
    ["Điện thoại chính", c.phone],
    ["Điện thoại phụ", c.phone2],
    ["Email", c.email],
    ...(c.isPersonal ? ([["Số CCCD / CMND", c.cccd]] as [string, string][]) : []),
    [c.isPersonal ? "Mã số thuế TNCN" : "Mã số thuế doanh nghiệp", c.taxCode],
    ["Nguồn khách", c.source],
    ["Địa chỉ", c.diaChi],
    ...(!c.isPersonal && c.nguoiDaiDienPl
      ? ([["Người đại diện PL", c.chucVu ? `${c.nguoiDaiDienPl} (${c.chucVu})` : c.nguoiDaiDienPl]] as [string, string][])
      : []),
  ];
  const visibleRows = rows.filter(([, v]) => !!v);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen header={header} padded={false} refreshing={loading} onRefresh={() => void load()}>
        <View style={styles.body}>
          <View style={styles.hero}>
            <Avatar name={c.name} size={56} round />
            <Text variant="title" style={styles.center} accessibilityRole="header">
              {c.name || "—"}
            </Text>
            {c.company ? (
              <Text variant="caption" color="textSecondary" style={styles.center}>
                {c.company}
              </Text>
            ) : null}
            <View style={styles.badges}>
              <Badge label={c.isPersonal ? "Cá nhân" : "Doanh nghiệp"} />
              {c.maSoKh ? <Badge label={`Mã ${c.maSoKh}`} /> : null}
              {c.status ? <StatusBadge label={c.status} color={c.statusColor} /> : null}
            </View>

            {c.phone || c.email ? (
              <View style={styles.quick}>
                {c.phone ? (
                  <>
                    <QuickAction
                      icon={Phone}
                      label="Gọi"
                      color={colors.success}
                      bg={colors.successSubtle}
                      onPress={() => void callPhone(c.phone)}
                    />
                    <QuickAction
                      icon={MessageCircle}
                      label="Zalo"
                      color={colors.info}
                      bg={colors.infoSubtle}
                      onPress={() => void openZalo(c.phone)}
                    />
                  </>
                ) : null}
                {c.email ? (
                  <QuickAction
                    icon={Mail}
                    label="Email"
                    color={colors.primary}
                    bg={colors.primarySubtle}
                    onPress={() => void Linking.openURL(`mailto:${c.email}`)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          <Card padding={0} style={styles.card}>
            {visibleRows.length ? (
              <View style={styles.rows}>
                {visibleRows.map(([label, value], i) => (
                  <KeyValueRow key={label} label={label} value={value} last={i === visibleRows.length - 1} />
                ))}
              </View>
            ) : (
              <Text variant="caption" color="textSecondary" style={styles.empty}>
                Chưa có thông tin liên hệ.
              </Text>
            )}
          </Card>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Giao dịch của khách"
            onPress={() => router.push(`/customer/${c.id}/contracts` as any)}
            style={({ pressed }) => [styles.link, pressed ? styles.linkPressed : null]}
          >
            <View style={styles.linkIcon}>
              <ScrollText size={20} color={colors.info} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text variant="subhead">Giao dịch</Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                Giữ chỗ, đặt cọc, hợp đồng của khách
              </Text>
            </View>
            <View style={styles.chevron}>
              <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.5} />
            </View>
          </Pressable>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  hero: {
    alignItems: "center",
    gap: space.xs,
    paddingTop: space.xl,
    paddingBottom: space.lg + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.x3,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  center: { textAlign: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.xs, marginTop: space.xs },
  quick: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xxl,
    marginTop: space.md + 2,
    paddingTop: space.md + 2,
    alignSelf: "stretch",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quickItem: { alignItems: "center", gap: space.xs + 2, minWidth: 56 },
  quickIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  pressedFade: { opacity: 0.6 },
  flex: { flex: 1 },
  card: { borderWidth: 0, borderRadius: radius.xxl, ...elevation.soft },
  rows: { paddingHorizontal: space.lg + 2 },
  empty: { padding: space.lg },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    paddingVertical: space.md + 2,
    paddingLeft: space.md + 2,
    paddingRight: space.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  linkPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.98 }] },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.infoSubtle,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
});
