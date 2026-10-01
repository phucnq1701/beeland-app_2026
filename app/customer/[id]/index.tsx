import React, { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Mail, MessageCircle, Pencil, Phone, ScrollText, Trash2 } from "lucide-react-native";

import {
  AppHeader,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  IconButton,
  KeyValueRow,
  ListItem,
  Screen,
  SkeletonDetail,
  StatusBadge,
  Text,
  confirm,
  useToast,
} from "@/components/ui";
import { callPhone, openZalo } from "@/components/customer/CustomerListItem";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors, space } from "@/theme";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

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
      title="Khách hàng"
      actions={
        customer ? (
          <>
            <IconButton
              icon={Pencil}
              accessibilityLabel="Sửa khách hàng"
              onPress={() => router.push(`/customer/${customer.id}/edit` as any)}
            />
            <IconButton
              icon={Trash2}
              accessibilityLabel="Xoá khách hàng"
              color={colors.danger}
              disabled={deleting}
              onPress={() => void handleDelete()}
            />
          </>
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
      <Screen header={header} refreshing={loading} onRefresh={() => void load()}>
        <View style={styles.hero}>
          <Avatar name={c.name} size={56} />
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
        </View>

        {c.phone || c.email ? (
          <View style={styles.quick}>
            {c.phone ? (
              <>
                <Button title="Gọi" icon={Phone} variant="secondary" style={styles.flex} onPress={() => void callPhone(c.phone)} />
                <Button title="Zalo" icon={MessageCircle} variant="secondary" style={styles.flex} onPress={() => void openZalo(c.phone)} />
              </>
            ) : null}
            {c.email ? (
              <Button
                title="Email"
                icon={Mail}
                variant="secondary"
                style={styles.flex}
                onPress={() => void Linking.openURL(`mailto:${c.email}`)}
              />
            ) : null}
          </View>
        ) : null}

        <Card padding={0}>
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

        <Card padding={0}>
          <ListItem
            title="Giao dịch"
            subtitle="Giữ chỗ, đặt cọc, hợp đồng của khách"
            leading={<ScrollText size={20} color={colors.info} />}
            chevron
            onPress={() => router.push(`/customer/${c.id}/contracts` as any)}
          />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: space.xs, paddingVertical: space.md },
  center: { textAlign: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.xs, marginTop: space.xs },
  quick: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
  rows: { paddingHorizontal: space.lg },
  empty: { padding: space.lg },
});
