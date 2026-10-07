import React, { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AlarmClock, ClipboardCheck, MoreVertical, Pencil, Phone, ShieldCheck, Trash2 } from "lucide-react-native";

import { AttachmentList } from "@/components/signing/AttachmentList";
import { catMeta } from "@/components/request/RequestRowItem";
import { RequestTimeline } from "@/components/request/RequestTimeline";
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
  StatusBadge,
  Text,
  useToast,
} from "@/components/ui";
import { isCustomerSubmitted, isOverdue, mapCatalog, type CustomerRequest, type RequestLog } from "@/lib/customerRequest";
import { formatDateTime } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";
import {
  CustomerRequestService,
  type RequestCatalogs,
  type ResolvedAttachment,
} from "@/sevicesSupabase/CustomerRequestService";

/**
 * Chi tiết yêu cầu – như web RequestDetailDrawer: thông tin, hình ảnh & tài liệu, lịch sử xử lý; "Cập nhật xử lý"
 * (đổi trạng thái + nội dung → fn_customer_request_process), sửa, xoá.
 * Kiểu bo tròn như chi tiết lịch ký: header `soft`, khối navy bo `radius.x3`, card bo `radius.xxl`.
 */
export default function RequestDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<CustomerRequest | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [files, setFiles] = useState<ResolvedAttachment[]>([]);
  const [filesReady, setFilesReady] = useState(false);
  const [contract, setContract] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<RequestCatalogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingMenu = useRef<"edit" | "delete" | null>(null);
  const deleting = useRef(false);
  const loadedOnce = useRef(false);
  const catalogsRef = useRef<RequestCatalogs | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const [d, h, cats] = await Promise.all([
          CustomerRequestService.get(String(id ?? "")),
          CustomerRequestService.logs(String(id ?? "")).catch(() => [] as RequestLog[]),
          catalogsRef.current ?? CustomerRequestService.catalogs().catch(() => null),
        ]);
        setData(d);
        setLogs(h);
        if (cats && !catalogsRef.current) {
          catalogsRef.current = cats;
          setCatalogs(cats);
        }
        setError(null);
        const [att, label] = await Promise.all([
          CustomerRequestService.resolveAttachments(d.attachments).catch(() => [] as ResolvedAttachment[]),
          CustomerRequestService.contractLabel(d.contractId),
        ]);
        setFiles(att);
        setFilesReady(true);
        setContract(label);
      } catch (e: any) {
        setError(e?.message || "Không tải được yêu cầu");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  // Nạp lần đầu và mỗi lần quay lại từ form sửa / cập nhật xử lý
  useFocusEffect(
    useCallback(() => {
      void load(loadedOnce.current);
      loadedOnce.current = true;
    }, [load]),
  );

  const edit = () => data && router.push({ pathname: "/request/form", params: { id: data.id } });
  const process = () =>
    data && router.push({ pathname: "/request/process", params: { id: data.id, status: data.status ?? "" } });

  const remove = async () => {
    if (!data || deleting.current) return;
    const ok = await confirm({
      title: "Xoá yêu cầu",
      message: `Bạn chắc chắn muốn xoá yêu cầu ${data.code}?`,
      confirmText: "Xoá",
      destructive: true,
    });
    if (!ok) return;
    deleting.current = true;
    try {
      await CustomerRequestService.remove(data.id);
      toast.show({ type: "success", message: "Đã xoá yêu cầu" });
      router.back();
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Xoá yêu cầu thất bại" });
    } finally {
      deleting.current = false;
    }
  };

  const header = (
    <AppHeader
      variant="soft"
      title={data?.code || "Yêu cầu"}
      subtitle={data?.customerName || undefined}
      actions={
        data ? (
          <IconButton icon={MoreVertical} variant="soft" accessibilityLabel="Tuỳ chọn" onPress={() => setMenuOpen(true)} />
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
          <ErrorState description={error || "Không tìm thấy yêu cầu"} onRetry={() => void load()} />
        </Screen>
      </>
    );
  }

  const cats = catalogs ?? {
    dm_loai_yeu_cau: mapCatalog([], "dm_loai_yeu_cau"),
    dm_nguon_yeu_cau: mapCatalog([], "dm_nguon_yeu_cau"),
    dm_uu_tien_yeu_cau: mapCatalog([], "dm_uu_tien_yeu_cau"),
    dm_trang_thai_yeu_cau: mapCatalog([], "dm_trang_thai_yeu_cau"),
  };
  const status = catMeta(cats.dm_trang_thai_yeu_cau, data.status, data.statusName);
  const priority = catMeta(cats.dm_uu_tien_yeu_cau, data.priority, data.priorityName);
  const category = catMeta(cats.dm_loai_yeu_cau, data.category, data.categoryName);
  const source = catMeta(cats.dm_nguon_yeu_cau, data.source, data.sourceName);
  const overdue = isOverdue(data, Date.now());
  const fromCustomer = isCustomerSubmitted(data.createdBy, data.source);
  const phone = data.customerPhone.trim();

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
            <Button variant="secondary" icon={Pencil} title="Sửa" onPress={edit} style={styles.pill} />
            <Button icon={ClipboardCheck} title="Cập nhật xử lý" onPress={process} style={[styles.flex, styles.pill]} />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text variant="caption" color={colors.showcase.textMuted} style={styles.flex} numberOfLines={1}>
                {[data.code, source.name].filter(Boolean).join(" · ")}
              </Text>
              {status.name ? <StatusBadge label={status.name} color={status.color} /> : null}
            </View>
            <Text variant="title" color="onInverse">
              {data.title || "(Không có tiêu đề)"}
            </Text>
            <Text variant="caption" color={colors.showcase.textMuted}>
              Tiếp nhận {data.createdAt ? formatDateTime(data.createdAt) : "—"}
            </Text>
            <View style={styles.heroTags}>
              {fromCustomer ? <Badge label="Khách tự gửi" tone="brand" icon={ShieldCheck} /> : null}
              {data.dueDate ? (
                <Badge
                  label={`${overdue ? "Quá hạn" : "Hạn"} ${formatDateTime(data.dueDate)}`}
                  tone={overdue ? "danger" : "neutral"}
                  icon={AlarmClock}
                />
              ) : null}
              {priority.name ? <StatusBadge label={priority.name} color={priority.color} /> : null}
              {category.name ? <Badge label={category.name} tone="info" /> : null}
            </View>
          </View>

          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <Text variant="subhead" style={styles.flex}>
                Khách hàng
              </Text>
              {phone ? (
                <IconButton
                  icon={Phone}
                  variant="soft"
                  accessibilityLabel={`Gọi ${phone}`}
                  onPress={() => void Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`)}
                />
              ) : null}
            </View>
            <KeyValueRow label="Họ tên" value={data.customerName || "—"} />
            <KeyValueRow label="Điện thoại" value={phone || "—"} copyValue={phone || undefined} />
            <KeyValueRow label="Email" value={data.customerEmail || "—"} copyValue={data.customerEmail || undefined} />
            <KeyValueRow label="Dự án" value={data.projectName || data.projectCode || "—"} />
            <KeyValueRow label="Hợp đồng / phiếu" value={contract || "—"} last />
          </Card>

          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Phân loại & phân công
            </Text>
            <KeyValueRow label="Loại / chủ đề" value={category.name || "—"} />
            <KeyValueRow label="Nguồn tiếp nhận" value={source.name || "—"} />
            <KeyValueRow label="Mức ưu tiên" value={priority.name || "—"} />
            <KeyValueRow label="Người tiếp nhận" value={data.receiverName || "—"} />
            <KeyValueRow label="Người xử lý" value={data.assigneeName || "—"} />
            <KeyValueRow label="Hạn xử lý" value={data.dueDate ? formatDateTime(data.dueDate) : "—"} />
            <KeyValueRow label="Cập nhật" value={data.updatedAt ? formatDateTime(data.updatedAt) : "—"} last />
          </Card>

          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              {fromCustomer ? "Nội dung khách gửi" : "Nội dung"}
            </Text>
            <Text variant="body" color={data.content ? "text" : "textSecondary"}>
              {data.content || "Không có nội dung chi tiết."}
            </Text>
            {data.internalNote ? (
              <View style={styles.note}>
                <Text variant="label" color="onWarningSubtle">
                  GHI CHÚ NỘI BỘ · khách không thấy
                </Text>
                <Text variant="body">{data.internalNote}</Text>
              </View>
            ) : null}
          </Card>

          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Hình ảnh & tài liệu ({data.attachments.length})
            </Text>
            {data.attachments.length && !filesReady ? (
              <Text variant="caption" color="textSecondary">
                Đang tải tệp…
              </Text>
            ) : (
              <AttachmentList items={files.map((f) => ({ fileName: f.fileName, url: f.url }))} />
            )}
          </Card>

          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Lịch sử xử lý ({logs.length})
            </Text>
            <RequestTimeline items={logs} />
          </Card>
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
        title="Tuỳ chọn yêu cầu"
      >
        <SheetOption
          icon={Pencil}
          label="Sửa yêu cầu"
          onPress={() => {
            pendingMenu.current = "edit";
            setMenuOpen(false);
          }}
        />
        <SheetOption
          icon={Trash2}
          label="Xoá yêu cầu"
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
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  hero: {
    backgroundColor: colors.showcase.bg,
    borderRadius: radius.x3,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    gap: space.sm,
    ...elevation.soft,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  card: { borderWidth: 0, borderRadius: radius.xxl, paddingHorizontal: space.lg + 2, ...elevation.soft },
  cardTitle: { marginBottom: space.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  note: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSubtle,
    gap: space.xs,
  },
  pill: { borderRadius: radius.full },
});
