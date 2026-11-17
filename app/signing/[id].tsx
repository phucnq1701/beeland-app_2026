import React, { useCallback, useRef, useState } from "react";
import { Linking, Share, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, MoreVertical, Pencil, Phone, Send, Trash2 } from "lucide-react-native";

import { AttachmentList } from "@/components/signing/AttachmentList";
import {
  AppHeader,
  Badge,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  confirm,
  ErrorState,
  IconButton,
  KeyValueRow,
  Screen,
  SheetOption,
  SkeletonDetail,
  Text,
  useToast,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { dateKey, labelOf, statusMeta, timeOf, weekdayIndex } from "@/lib/signing";
import { colors, elevation, radius, space } from "@/theme";
import { SigningService, type SigningDetail } from "@/services/SigningService";

const WEEKDAY_FULL = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

/**
 * Chi tiết lịch ký (fn_nv_app_lich_ky_chi_tiet = fn_signing_appointment_get) – sửa, xoá như lưới web; xác nhận / từ chối chỉ trên web.
 * Khối đầu = cái cần nhất khi đi ký: giờ (từ – đến), ngày, ca · thủ tục, ĐIỂM KÝ + địa chỉ; nút Gọi khách / Gửi lịch cho khách.
 * Bên dưới chỉ hiện dòng có dữ liệu (không lặp thông tin ở khối đầu, không dòng "—").
 */
export default function SigningDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<SigningDetail | null>(null);
  const [coOwners, setCoOwners] = useState<any[]>([]);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingMenu = useRef<"edit" | "delete" | null>(null);
  const deleting = useRef(false);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const d = await SigningService.get(String(id ?? ""));
        setData(d);
        setError(null);
        const [owners, plans] = await Promise.all([
          SigningService.customersByIds(d.DongSoHuuIds).catch(() => []),
          d.MaPhuongAnTT != null ? SigningService.plans().catch(() => []) : Promise.resolve([]),
        ]);
        setCoOwners(owners);
        setPlanLabel(labelOf(plans, d.MaPhuongAnTT) ?? null);
      } catch (e: any) {
        setError(e?.message || "Không tải được lịch ký");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  // Nạp lần đầu và mỗi lần quay lại từ form sửa
  useFocusEffect(
    useCallback(() => {
      void load(loadedOnce.current);
      loadedOnce.current = true;
    }, [load]),
  );

  const edit = () => {
    if (!data) return;
    router.push({ pathname: "/signing/form", params: { id: String(data.UID ?? data.ID) } });
  };

  const remove = async () => {
    if (!data || deleting.current) return;
    const ok = await confirm({
      title: "Xoá lịch ký",
      message: `Bạn chắc chắn muốn xoá lịch ký của "${data.TenKH || ""}"?`,
      confirmText: "Xoá",
      destructive: true,
    });
    if (!ok) return;
    deleting.current = true;
    try {
      await SigningService.remove([data.ID]);
      toast.show({ type: "success", message: "Đã xoá lịch ký" });
      router.back();
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Xoá lịch ký thất bại" });
    } finally {
      deleting.current = false;
    }
  };

  const header = (
    <AppHeader
      variant="soft"
      title="Lịch ký"
      subtitle={data?.MaCan ? `${data.MaCan}${data.TenKH ? " · " + data.TenKH : ""}` : undefined}
      actions={
        data ? (
          <IconButton
            icon={MoreVertical}
            variant="soft"
            accessibilityLabel="Tuỳ chọn"
            onPress={() => setMenuOpen(true)}
          />
        ) : null
      }
    />
  );

  if (loading && !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <SkeletonDetail />
        </Screen>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <ErrorState description={error || "Không tìm thấy lịch ký"} onRetry={() => void load()} />
        </Screen>
      </>
    );
  }

  const meta = statusMeta(data.State);
  const day = data.NgayBookKy ? dateKey(data.NgayBookKy) : "";
  const idLabel = data.IsPersonal ? "CCCD / Hộ chiếu" : "Số ĐKKD";
  const timeText = data.TuGio ? `${data.TuGio}${data.DenGio ? ` – ${data.DenGio}` : ""}` : timeOf(data.NgayBookKy);
  const dayText = day ? `${WEEKDAY_FULL[weekdayIndex(day)]}, ${formatDate(data.NgayBookKy)}` : "";
  const plan = data.TenLichTT || planLabel || (data.MaPhuongAnTT != null ? String(data.MaPhuongAnTT) : null);
  const rows = (list: [string, string | null | undefined, boolean?][]) =>
    list.filter(([, v]) => v != null && String(v).trim() !== "") as [string, string, boolean?][];
  const deal = rows([
    data.Nguon === "HOP_DONG" ? ["Hợp đồng", data.SoHopDong] : ["Phiếu đặt cọc", data.SoPhieu],
    ["Căn", [data.MaCan, data.TenDA].filter(Boolean).join(" · ")],
    ["Phân loại", data.PhanLoai],
    ["Đại lý phụ trách", data.DaiLy],
    ["Lịch thanh toán", plan],
    ["Hình thức thanh toán", data.HinhThucTT],
    ["Bảo lãnh", data.BaoLanh],
    ["Ghi chú", data.GhiChu],
  ]);
  const cust = rows([
    [data.IsPersonal ? "Họ và tên" : "Tên công ty", data.TenKH],
    [idLabel, data.SoGiayTo, true],
    ["Điện thoại", data.DienThoai, true],
    ["Email", data.Email],
  ]);

  const shareToCustomer = async () => {
    const text = [
      `Lịch ký${data.TenLoaiThuTuc ? ` ${data.TenLoaiThuTuc}` : ""}${data.MaCan ? ` căn ${data.MaCan}` : ""}`,
      data.TenKH ? `Khách hàng: ${data.TenKH}` : null,
      dayText ? `Thời gian: ${timeText}, ${dayText}${data.TenCa ? ` (${data.TenCa})` : ""}` : null,
      data.TenDiemKy ? `Địa điểm: ${data.TenDiemKy}${data.DiaChiDiemKy ? ` — ${data.DiaChiDiemKy}` : ""}` : null,
      data.DienThoaiDiemKy ? `Liên hệ điểm ký: ${data.DienThoaiDiemKy}` : null,
      data.HuongDanDiemKy ? `Hướng dẫn: ${data.HuongDanDiemKy}` : null,
    ].filter(Boolean).join("\n");
    try {
      await Share.share({ message: text });
    } catch {
      toast.show({ type: "error", message: "Không mở được chia sẻ" });
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={header}
        padded={false}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        footer={
          <BottomActionBar>
            {/* App không cập nhật trạng thái lịch ký (xác nhận / từ chối làm trên web) */}
            <Button icon={Pencil} title="Sửa lịch ký" onPress={edit} style={[styles.flex, styles.pill]} />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text variant="caption" color={colors.showcase.textMuted} style={styles.flex}>
                {data.TenLoaiThuTuc || "Lịch ký"}
              </Text>
              <Badge label={meta.label} tone={meta.tone} />
            </View>
            {day ? (
              <>
                <Text variant="display" color="onInverse" numeric>
                  {timeText}
                </Text>
                <Text variant="subhead" color="onInverse">
                  {dayText}
                  {data.TenCa ? ` · ${data.TenCa}` : ""}
                </Text>
              </>
            ) : (
              <Text variant="title" color="onInverse">
                Chưa có ngày ký
              </Text>
            )}
            {data.TenDiemKy ? (
              <View style={styles.place}>
                <MapPin size={16} color={colors.showcase.textMuted} />
                <View style={styles.flex}>
                  <Text variant="body" weight="semibold" color="onInverse">
                    {data.TenDiemKy}
                  </Text>
                  {data.DiaChiDiemKy ? (
                    <Text variant="caption" color={colors.showcase.textMuted}>
                      {data.DiaChiDiemKy}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            {data.DienThoai ? (
              <Button
                variant="secondary"
                icon={Phone}
                title="Gọi khách"
                onPress={() => void Linking.openURL(`tel:${data.DienThoai}`)}
                style={[styles.flex, styles.pill]}
              />
            ) : null}
            <Button variant="secondary" icon={Send} title="Gửi lịch cho khách" onPress={() => void shareToCustomer()} style={[styles.flex, styles.pill]} />
          </View>

          {deal.length ? (
            <Card style={styles.card}>
              <Text variant="subhead" style={styles.cardTitle}>
                Giao dịch
              </Text>
              {deal.map(([l, v], i) => (
                <KeyValueRow key={l} label={l} value={v} last={i === deal.length - 1} />
              ))}
            </Card>
          ) : null}

          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              {data.IsPersonal ? "Khách hàng" : "Doanh nghiệp"}
            </Text>
            {cust.map(([l, v, copy], i) => (
              <KeyValueRow key={l} label={l} value={v} copyValue={copy ? v : undefined} last={i === cust.length - 1 && !coOwners.length} />
            ))}
            {coOwners.length ? (
              <View style={styles.owners}>
                <Text variant="caption" weight="semibold" color="textSecondary">
                  Đồng sở hữu ({coOwners.length})
                </Text>
                {coOwners.map((c, i) => (
                  <View key={c.id} style={styles.owner}>
                    <Text variant="body" weight="semibold">
                      {i + 1}. {c.ten_kh || c.ten_cong_ty || "—"}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {[c.cccd ? `CCCD ${c.cccd}` : null, c.dien_thoai].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Hồ sơ đính kèm
            </Text>
            <AttachmentList items={data.TaiLieu} />
          </Card>

          {data.CreatedAt ? (
            <Text variant="caption" color="textTertiary" align="center">
              Tạo lúc {formatDateTime(data.CreatedAt)} · #{data.ID}
            </Text>
          ) : null}
        </View>
      </Screen>

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onClosed={() => {
          const a = pendingMenu.current;
          pendingMenu.current = null;
          if (a === "edit") edit();
          if (a === "delete") void remove();
        }}
        title="Tuỳ chọn lịch ký"
      >
        <SheetOption
          icon={Pencil}
          label="Sửa lịch ký"
          onPress={() => {
            pendingMenu.current = "edit";
            setMenuOpen(false);
          }}
        />
        <SheetOption
          icon={Trash2}
          label="Xoá lịch ký"
          destructive
          onPress={() => {
            pendingMenu.current = "delete";
            setMenuOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  hero: {
    backgroundColor: colors.showcase.bg,
    borderRadius: radius.x3,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    gap: space.xs,
    ...elevation.soft,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  place: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.showcase.surface,
  },
  actions: { flexDirection: "row", gap: space.sm },
  card: { borderWidth: 0, borderRadius: radius.xxl, paddingHorizontal: space.lg + 2, ...elevation.soft },
  cardTitle: { marginBottom: space.xs },
  owners: { marginTop: space.md, gap: space.sm },
  owner: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, gap: 2 },
  pill: { borderRadius: radius.full },
});
