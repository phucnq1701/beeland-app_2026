import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ban, Check, History, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react-native";

import { DiscountList, InfoCard, money, PriceHero, ScheduleList } from "@/components/priceSheet/PriceSheetBlocks";
import { sharePriceSheetPdf } from "@/components/priceSheet/sharePriceSheetPdf";
import {
  AppHeader,
  BottomActionBar,
  BottomSheet,
  Button,
  confirm,
  ErrorState,
  IconButton,
  Screen,
  SheetOption,
  SkeletonDetail,
  StatusBadge,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { formatArea, formatDate, formatDateTime } from "@/lib/format";
import { appEditBlockReason } from "@/lib/priceSheetPayload";
import { canApprove, canReject, priceSheetStatus } from "@/lib/priceSheetStatus";
import { PriceSheetService, type PriceSheetRow } from "@/sevicesSupabase/PriceSheetService";
import { colors, space } from "@/theme";

type Perms = { edit: boolean; del: boolean; approve: boolean };

/**
 * Chi tiết phiếu tính giá (fn_price_sheet_get): số liệu đã lưu (snapshot/payload – không tính lại), chia sẻ PDF
 * theo mẫu in web, duyệt / từ chối (quyền APPROVE), sửa (chỉ phiếu nháp đơn giản – appEditBlockReason), xoá mềm.
 */
export default function PriceSheetDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sheet, setSheet] = useState<PriceSheetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [perms, setPerms] = useState<Perms>({ edit: false, del: false, approve: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [acting, setActing] = useState<null | "share" | "approve" | "reject" | "delete">(null);
  const actingRef = useRef(false);
  const firstFocus = useRef(true);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const row = await PriceSheetService.get(String(id));
        setSheet(row);
        setError(!row);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load();
    Promise.all([
      PriceSheetService.hasPerm("EDIT"),
      PriceSheetService.hasPerm("DELETE"),
      PriceSheetService.hasPerm("APPROVE"),
    ]).then(([edit, del, approve]) => setPerms({ edit, del, approve }));
  }, [load]);

  // Quay lại từ màn sửa → nạp lại
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void load(true);
    }, [load])
  );

  /** Chạy 1 thao tác ghi, chặn bấm lặp */
  const run = async (kind: NonNullable<typeof acting>, fn: () => Promise<void>) => {
    if (actingRef.current) return;
    actingRef.current = true;
    setActing(kind);
    try {
      await fn();
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Thao tác thất bại" });
    } finally {
      actingRef.current = false;
      setActing(null);
    }
  };

  const share = () => run("share", async () => sharePriceSheetPdf(sheet));

  const approve = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: "Duyệt phiếu tính giá?",
      message: "Phiếu sau khi duyệt sẽ chuyển sang trạng thái Đã duyệt.",
      confirmText: "Duyệt",
    });
    if (!ok || !sheet) return;
    await run("approve", async () => {
      const [row] = await PriceSheetService.setStatus([sheet.id], "approved");
      if (row) setSheet((s) => (s ? { ...s, ...row } : s));
      toast.show({ type: "success", message: "Đã duyệt phiếu tính giá" });
    });
  };

  const reject = async () => {
    if (!reason.trim()) {
      setReasonError("Vui lòng nhập lý do từ chối");
      return;
    }
    if (!sheet) return;
    await run("reject", async () => {
      const [row] = await PriceSheetService.setStatus([sheet.id], "rejected", reason.trim());
      if (row) setSheet((s) => (s ? { ...s, ...row } : s));
      setRejectOpen(false);
      setReason("");
      toast.show({ type: "success", message: "Đã từ chối phiếu tính giá" });
    });
  };

  const remove = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: "Xoá phiếu tính giá?",
      message: "Phiếu chuyển vào thùng rác (khôi phục trên web).",
      confirmText: "Xoá",
      destructive: true,
    });
    if (!ok || !sheet) return;
    await run("delete", async () => {
      await PriceSheetService.remove([sheet.id]);
      toast.show({ type: "success", message: "Đã xoá phiếu tính giá" });
      router.back();
    });
  };

  if (loading) {
    return (
      <Screen header={<AppHeader variant="soft" title="Phiếu tính giá" />} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.body}>
          <SkeletonDetail />
        </View>
      </Screen>
    );
  }
  if (error || !sheet) {
    return (
      <Screen header={<AppHeader variant="soft" title="Phiếu tính giá" />} padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState description="Không tải được phiếu tính giá." onRetry={() => void load()} />
      </Screen>
    );
  }

  const snap = sheet.snapshot || sheet.payload?._snapshot || {};
  const t = snap.totals || {};
  const tt = sheet.payload?.TTHopDong || {};
  const g = tt.GiaTriHopDong || {};
  const st = priceSheetStatus(sheet.status);
  const editBlock = appEditBlockReason(sheet);
  const total = t.totalContractValue ?? sheet.gia_tri_hd_sau_ck ?? sheet.base_price;
  const discounts: any[] = Array.isArray(snap.discounts) ? snap.discounts : [];
  const lich: any[] = Array.isArray(sheet.payload?.LichThanhToan) ? sheet.payload.LichThanhToan : [];
  const schedule = lich.length
    ? lich.map((l, i) => ({
        name: l.DotTTText || `Đợt ${l.DotTT ?? i + 1}`,
        ratio: Number(l.TyLeTT) || null,
        dueDate: l.NgayTT,
        vat: Number(l.ThueVAT) || Number(l.TienVATDat) || null,
        maintenance: Number(l.PhiBT) || Number(l.TienXD) || null,
        total: Number(l.SoTien) || 0,
      }))
    : (snap.schedule || []).map((s: any, i: number) => ({
        name: s.name || `Đợt ${i + 1}`,
        ratio: Number(s.ratio) || null,
        dueDate: s.dueDate,
        total: Number(s.amount) || 0,
      }));
  const promos: any[] = Array.isArray(snap.promotions) ? snap.promotions : [];
  const hasMenu = perms.approve || perms.del || perms.edit;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={
          <AppHeader
            variant="soft"
            title={sheet.product_code || "Phiếu tính giá"}
            subtitle={sheet.sheet_code || undefined}
            actions={
              <>
                <IconButton
                  icon={History}
                  variant="soft"
                  accessibilityLabel="Lịch sử phiên bản"
                  onPress={() => router.push({ pathname: "/price-sheet/history/[id]", params: { id: sheet.id } })}
                />
                {hasMenu ? (
                  <IconButton icon={MoreHorizontal} variant="soft" accessibilityLabel="Thao tác khác" onPress={() => setMenuOpen(true)} />
                ) : null}
              </>
            }
          />
        }
        padded={false}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        footer={
          <BottomActionBar>
            <Button title="Chia sẻ PDF" icon={Share2} onPress={share} loading={acting === "share"} fullWidth />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          <PriceHero total={total} listed={t.totalListedPrice} discount={t.discountAmount} discountPercent={t.discountPercent}>
            <View style={styles.heroHead}>
              <View style={styles.flex}>
                <Text variant="heading" color={colors.showcase.text} numberOfLines={2}>
                  {sheet.customer_name || snap.customerName || "Chưa chọn khách hàng"}
                </Text>
                <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={2}>
                  {[sheet.project_name || snap.projectName, sheet.product_type].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <StatusBadge label={st.label} color={st.color} />
            </View>
          </PriceHero>

          {sheet.status === "rejected" && sheet.reject_reason ? (
            <View style={styles.notice}>
              <Text variant="caption" color="onDangerSubtle">
                Lý do từ chối: {sheet.reject_reason}
              </Text>
            </View>
          ) : null}

          <InfoCard
            title="Thông tin"
            rows={[
              ["Căn", sheet.product_code],
              ["Loại", snap.productType || sheet.product_name],
              ["Diện tích thông thủy", snap.area || sheet.area ? `${formatArea(snap.area || sheet.area)} m²` : null],
              ["Chính sách", sheet.ten_chinh_sach || snap.policyName],
              ["Tiến độ thanh toán", sheet.ten_lich_tt || snap.scheduleName],
              ["Ngày ký dự kiến", tt.NgayKy ? formatDate(tt.NgayKy) : null],
              ["Tiền cọc", money(tt.TienCoc ?? sheet.tien_coc)],
              ["SĐT khách", sheet.customer_phone],
              ["Người lập", sheet.created_by],
              ["Ngày lập", formatDateTime(sheet.created_at)],
              ["Ghi chú", tt.GhiChu],
            ]}
          />

          <InfoCard
            title="Giá niêm yết"
            rows={[
              ["Tổng giá chưa VAT", money(g.TongChuaVAT)],
              ["Tiền VAT", money(g.TienVAT)],
              ["Tổng giá gồm VAT", money(g.TongGomVAT)],
              ["Kinh phí bảo trì", money(g.TienPhiBaoTri)],
              ["Tổng gồm VAT + KPBT", money(g.TongGiaGomVATPBT ?? t.totalListedPrice)],
            ]}
          />

          <DiscountList items={discounts} />

          <InfoCard
            title="Giá trị sau chiết khấu"
            rows={[
              ["Tổng giá trị HĐMB (gồm VAT, KPBT)", money(total)],
              ["Tổng gồm VAT chưa KPBT", money(t.totalWithVATNoMaintenance)],
              ["Tổng giá trị chưa VAT", money(tt.GiaTriHopDongSauCK?.TongChuaVAT ?? t.totalNoVAT)],
              ["Thuế GTGT", money(t.vatAmount)],
              ["Kinh phí bảo trì", money(t.maintenanceFee)],
            ]}
          />

          <ScheduleList items={schedule} />

          {promos.length ? (
            <InfoCard
              title="Quà tặng"
              rows={promos.map((p, i) => [
                `${p.name || `Quà ${i + 1}`}${p.quantity ? ` × ${p.quantity}` : ""}`,
                money(p.amount) || "—",
              ])}
            />
          ) : null}
        </View>
      </Screen>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Thao tác">
        {perms.approve && canApprove(sheet.status) ? <SheetOption icon={Check} label="Duyệt" onPress={approve} /> : null}
        {perms.approve && canReject(sheet.status) ? (
          <SheetOption
            icon={Ban}
            label="Từ chối"
            destructive
            onPress={() => {
              setMenuOpen(false);
              setReasonError(null);
              setRejectOpen(true);
            }}
          />
        ) : null}
        {perms.edit ? (
          <SheetOption
            icon={Pencil}
            label={editBlock ? `Sửa (${editBlock})` : "Sửa"}
            onPress={() => {
              setMenuOpen(false);
              if (editBlock) {
                toast.show({ type: "info", message: editBlock });
                return;
              }
              router.push({ pathname: "/price-sheet/new", params: { sheetId: sheet.id } });
            }}
          />
        ) : null}
        {perms.del ? <SheetOption icon={Trash2} label="Xoá" destructive onPress={remove} /> : null}
      </BottomSheet>

      <BottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)} title="Từ chối phiếu tính giá">
        <View style={styles.sheetBody}>
          <TextField
            label="Lý do từ chối"
            required
            multiline
            value={reason}
            onChangeText={(v) => {
              setReason(v);
              if (reasonError) setReasonError(null);
            }}
            error={reasonError}
            placeholder="Nhập lý do"
          />
          <Button title="Từ chối" variant="danger" onPress={reject} loading={acting === "reject"} fullWidth />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  flex: { flex: 1 },
  heroHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginBottom: space.md,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.showcase.surface,
  },
  notice: { padding: space.md, borderRadius: space.md, backgroundColor: colors.dangerSubtle },
  sheetBody: { gap: space.md, paddingBottom: space.md },
});
