/**
 * QR thanh toán đặt cọc qua tài khoản định danh (Module DATCOC) — cùng luồng với web
 * (beeland/src/pages/sales/components/BookingVAQRDialog.tsx, module="DATCOC", mở từ
 * beeland/src/pages/sales/giao-dich/dat-coc/index.tsx), dùng chung edge function `payment-gateway`:
 *  chỉ phiếu đặt cọc chờ duyệt → chọn tài khoản cấu hình → tạo VA (không có hạn) với số tiền
 *  max(0, TienCoc − DaThu) → hiện QR VietQR → kiểm tra paid_amount mỗi 5s.
 * Khách chuyển đủ tiền cọc → máy chủ (fn_payment_webhook_apply) tự tạo phiếu thu và duyệt đặt cọc.
 * Mở lại màn thì hiện QR DATCOC đang hiệu lực (không tạo trùng).
 *
 * Giao diện theo lib/qrPaymentState (requiresDeadline: false). Không bao giờ tự tạo QR.
 * Kiểu bo tròn như chi tiết đặt cọc: header `soft`, lề 20, card bo `radius.xxl` bóng nhẹ, nút dạng viên.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Image, Share, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { AlertTriangle, Copy, Download, MoreVertical, QrCode, Send, Trash2 } from "lucide-react-native";

import {
  AppHeader,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  confirm,
  ErrorState,
  IconButton,
  KeyValueRow,
  MoneyText,
  Screen,
  SelectField,
  SheetOption,
  SkeletonDetail,
  Text,
  useToast,
} from "@/components/ui";
import { QrPaid } from "@/components/booking/QrResult";
import { canCreateDepositQr, depositQrAmount } from "@/lib/depositQr";
import { formatVND } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import { getQrScreenState, showsQrImage } from "@/lib/qrPaymentState";
import { colors, elevation, radius, space } from "@/theme";
import {
  PaymentGatewayService,
  vietQrUrl,
  type ContractVA,
  type GatewayAccount,
} from "@/sevicesSupabase/PaymentGatewayService";

const errMsg = (e: any, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export default function DepositQRPaymentScreen() {
  const router = useRouter();
  const toast = useToast();
  const { data: dataParam } = useLocalSearchParams<{ data?: string }>();
  // Dòng đặt cọc (fn_deposit_list + chi tiết) truyền từ màn chi tiết – như web lấy từ dòng lưới
  const row = useMemo(() => {
    try {
      return dataParam ? JSON.parse(String(dataParam)) : null;
    } catch {
      return null;
    }
  }, [dataParam]);

  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [maTk, setMaTk] = useState<number | null>(null);
  const [va, setVa] = useState<ContractVA | null>(null);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [hadPreviousQr, setHadPreviousQr] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingMenuAction = useRef<"cancel" | null>(null);
  const wasPaid = useRef(false);
  const createInFlight = useRef(false);

  // Cùng khoá với web: VA gắn id phiếu giữ chỗ (webhook tra cloud_deposits.phieu_giu_cho_id)
  const pgcId = String(row?.PhieuGiuChoId ?? row?.MaPGC ?? "");
  const projectId = String(row?.ProjectId ?? "");
  const docCode = String(row?.SoPhieu ?? "");
  const customerName = String(row?.KhachHang ?? row?.TenKH ?? "");
  const productCode = String(row?.MaSanPham ?? row?.KyHieu ?? row?.MaSP ?? "");
  const amount = depositQrAmount(row);
  const allowed = canCreateDepositQr(row);

  const acc = useMemo(() => accounts.find((a) => a.MaTK === maTk), [accounts, maTk]);

  // ── Nạp tài khoản cấu hình + VA đặt cọc đang hiệu lực ──────────────────────
  const load = useCallback(async () => {
    setLoadError(null);
    setAccountsError(null);
    try {
      if (!row) throw new Error("Không tìm thấy phiếu đặt cọc");
      const [accs, list] = await Promise.all([
        projectId
          ? PaymentGatewayService.getAccounts(projectId).catch((e) => {
              setAccountsError(errMsg(e, "Không tải được tài khoản cấu hình"));
              return [] as GatewayAccount[];
            })
          : Promise.resolve([] as GatewayAccount[]),
        pgcId ? PaymentGatewayService.listByContract(pgcId).catch(() => null) : Promise.resolve(null),
      ]);
      setAccounts(accs || []);
      setMaTk((prev) =>
        prev != null && (accs || []).some((a) => a.MaTK === prev) ? prev : (accs || [])[0]?.MaTK ?? null
      );
      const active = list?.accounts?.find((a) => a.status === "ACTIVE" && a.module === "DATCOC");
      setVa(active ?? null);
      setPaid(!!active && Number(active.paid_amount) > 0);
      setHadPreviousQr(!!list?.accounts?.some((a) => a.module === "DATCOC" && a.status === "DELETED"));
    } catch (e) {
      setLoadError(errMsg(e, "Không tải được thông tin thanh toán"));
    }
  }, [row, projectId, pgcId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Kiểm tra thanh toán ────────────────────────────────────────────────────
  const checkPaid = useCallback(async (): Promise<boolean> => {
    if (!va || paid || !pgcId) return paid;
    try {
      const list = await PaymentGatewayService.listByContract(pgcId);
      const cur = list.accounts.find((a) => a.id === va.id);
      if (cur && Number(cur.paid_amount) > 0) {
        setPaid(true);
        setVa(cur);
        return true;
      } else if (cur && cur.status === "DELETED") {
        setVa(null);
        setHadPreviousQr(true);
      }
    } catch {
      /* thử lại lần sau */
    }
    return false;
  }, [va, paid, pgcId]);

  const checkNow = async () => {
    if (checking) return;
    setChecking(true);
    const found = await checkPaid();
    setChecking(false);
    if (!found) {
      toast.show({ type: "info", message: "Chưa thấy tiền về. Ứng dụng vẫn tự kiểm tra mỗi 5 giây." });
    }
  };

  // Mỗi 5s giống web
  useEffect(() => {
    if (!va || paid) return;
    const t = setInterval(() => void checkPaid(), 5000);
    return () => clearInterval(t);
  }, [va, paid, checkPaid]);

  // Quay lại từ app ngân hàng → kiểm tra ngay
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void checkPaid();
    });
    return () => sub.remove();
  }, [checkPaid]);

  useEffect(() => {
    if (paid && !wasPaid.current) hapticSuccess();
    wasPaid.current = paid;
  }, [paid]);

  // Web (module DATCOC) không đối chiếu lại số tiền VA đang mở → không có trạng thái mismatch.
  const screenState = getQrScreenState({
    loading,
    loadError: loadError ?? (!loading && !row ? "Không tìm thấy phiếu đặt cọc" : null),
    paid: paid && !!va,
    hasActiveVa: !!va,
    amountMismatch: false,
    remainingSec: null,
    hadPreviousQr,
    requiresDeadline: false,
  });

  // ── Tạo mã QR (chỉ khi người dùng bấm) ─────────────────────────────────────
  const handleCreate = async () => {
    if (createInFlight.current) return;
    createInFlight.current = true;
    try {
      await createQr();
    } finally {
      createInFlight.current = false;
    }
  };

  const createQr = async () => {
    if (!acc || !row || creating) return;
    if (!allowed) {
      toast.show({ type: "error", message: "Chỉ tạo QR cho phiếu đặt cọc chờ duyệt còn tiền cọc phải thu" });
      return;
    }
    if (!pgcId) {
      toast.show({ type: "error", message: "Phiếu đặt cọc chưa gắn phiếu giữ chỗ" });
      return;
    }
    if (screenState === "needsNewQr") {
      const ok = await confirm({
        title: "Tạo mã QR mới?",
        message: "Mã QR cũ đã bị huỷ và sẽ được thay bằng mã mới.",
        confirmText: "Tạo mã mới",
      });
      if (!ok) return;
    }
    setCreating(true);
    try {
      const res = await PaymentGatewayService.create({
        project_id: projectId,
        ma_tk: acc.MaTK,
        ten_cau_hinh: acc.TenCauHinh,
        provider: acc.Provider,
        module: "DATCOC",
        expires_at: null,
        items: [
          {
            pgc_id: pgcId,
            so_hop_dong: docCode,
            khach_hang_id: row?.KhachHangId ?? row?.MaKH ?? null,
            ten_kh: customerName,
            ky_hieu: productCode || undefined,
            amount,
            dien_giai: `Thanh toan dat coc ${docCode}`.trim(),
          },
        ],
      });
      const r = res?.results?.[0];
      if (!r?.success) throw new Error(r?.message || res?.message || "Tạo tài khoản thất bại");
      const list = await PaymentGatewayService.listByContract(pgcId);
      const created =
        list.accounts.find((a) => a.id === r.id) ||
        list.accounts.find((a) => a.account_number === r.account_number && a.status === "ACTIVE");
      if (!created) throw new Error("Không đọc lại được tài khoản vừa tạo");
      setVa(created);
      setPaid(Number(created.paid_amount) > 0);
    } catch (e) {
      toast.show({ type: "error", message: errMsg(e, "Tạo QR thất bại") });
    } finally {
      setCreating(false);
    }
  };

  const handleCancelVA = async () => {
    if (!va || cancelling) return;
    const ok = await confirm({
      title: "Huỷ mã QR",
      message: `Huỷ tài khoản ${va.account_number} (${formatVND(va.amount)})? Người chuyển tiền vào tài khoản này sẽ không được ghi nhận.`,
      confirmText: "Huỷ mã QR",
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await PaymentGatewayService.remove(va.id);
      setVa(null);
      setPaid(false);
      await load();
    } catch (e) {
      toast.show({ type: "error", message: errMsg(e, "Không huỷ được mã QR") });
    } finally {
      setCancelling(false);
    }
  };

  // ── Tiện ích ───────────────────────────────────────────────────────────────
  const shareText = () =>
    va
      ? `Thanh toán đặt cọc ${docCode}\nNgân hàng: ${va.bank_code || ""}\nSTK: ${
          va.account_number
        }\nChủ TK: ${va.account_name || ""}\nSố tiền: ${formatVND(va.amount)}\nNội dung: ${va.dien_giai || ""}`
      : "";

  const handleCopyAll = async () => {
    setMenuOpen(false);
    await Clipboard.setStringAsync(shareText());
    toast.show({ type: "success", message: "Đã sao chép thông tin chuyển khoản" });
  };

  const handleShare = async () => {
    if (!va) return;
    try {
      await Share.share({ message: shareText() });
    } catch {
      /* người dùng đóng */
    }
  };

  const handleSaveQR = async () => {
    if (!va || saving) return;
    setSaving(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert("Thông báo", "Cần cấp quyền lưu ảnh vào thư viện");
        return;
      }
      const target = `${FileSystem.cacheDirectory}QR-${(docCode || va.account_number).replace(/[^\w-]/g, "_")}.png`;
      const { uri } = await FileSystem.downloadAsync(vietQrUrl(va), target);
      await MediaLibrary.saveToLibraryAsync(uri);
      toast.show({ type: "success", message: "Đã lưu mã QR vào thư viện ảnh" });
    } catch (e) {
      toast.show({ type: "error", message: errMsg(e, "Không lưu được mã QR") });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <AppHeader
      variant="soft"
      title="Thu tiền cọc"
      subtitle={docCode ? `${docCode}${customerName ? " · " + customerName : ""}` : undefined}
      actions={
        screenState === "active" ? (
          <IconButton icon={MoreVertical} variant="soft" accessibilityLabel="Tuỳ chọn" onPress={() => setMenuOpen(true)} />
        ) : null
      }
    />
  );

  const canCreate = !!acc && !!projectId && allowed;

  const footer = (() => {
    switch (screenState) {
      case "paid":
        return (
          <BottomActionBar>
            <Button size="lg" fullWidth title="Về chi tiết đặt cọc" onPress={() => router.back()} style={[styles.flex, styles.pill]} />
          </BottomActionBar>
        );
      case "active":
        return (
          <BottomActionBar>
            <Button variant="secondary" icon={Download} title="Lưu QR" loading={saving} onPress={handleSaveQR} style={styles.pill} />
            <Button icon={Send} title="Gửi cho khách" onPress={handleShare} style={[styles.flex, styles.pill]} />
          </BottomActionBar>
        );
      case "needsQr":
      case "needsNewQr":
        return (
          <BottomActionBar>
            <Button
              size="lg"
              fullWidth
              icon={QrCode}
              title={screenState === "needsNewQr" ? "Tạo mã QR mới" : "Tạo mã QR"}
              loading={creating}
              disabled={!canCreate}
              onPress={handleCreate}
              style={[styles.flex, styles.pill]}
            />
          </BottomActionBar>
        );
      default:
        return null;
    }
  })();

  const renderBody = () => {
    switch (screenState) {
      case "loading":
        return <SkeletonDetail />;
      case "error":
        return (
          <ErrorState
            description={loadError || "Không tìm thấy phiếu đặt cọc"}
            onRetry={() => {
              setLoading(true);
              void load().finally(() => setLoading(false));
            }}
          />
        );
      case "paid":
        return (
          <QrPaid
            amount={va?.paid_amount}
            bookingCode={docCode}
            docLabel="Đặt cọc"
            note="Thu đủ tiền cọc thì hệ thống tự duyệt phiếu đặt cọc."
          />
        );
      case "active":
        return va && showsQrImage(screenState) ? (
          <>
            <Card style={styles.card}>
              <View style={styles.amountBlock}>
                <Text variant="caption" color="textSecondary">
                  Số tiền cần chuyển
                </Text>
                <MoneyText value={va.amount} variant="display" />
              </View>
              <View style={styles.qrBox}>
                <Image
                  source={{ uri: vietQrUrl(va) }}
                  style={styles.qrImage}
                  resizeMode="contain"
                  accessibilityLabel={`Mã QR chuyển khoản ${formatVND(va.amount)}`}
                />
              </View>
              <View style={styles.waiting} accessibilityLiveRegion="polite">
                <View style={styles.dot} />
                <Text variant="caption" color="textSecondary">
                  Đang chờ tiền về · tự cập nhật
                </Text>
              </View>
              <Text variant="caption" color="textTertiary" align="center">
                Ngân hàng thường báo về sau 10–30 giây kể từ khi chuyển.
              </Text>
              <Button
                variant="ghost"
                title="Kiểm tra ngay"
                loading={checking}
                onPress={() => void checkNow()}
                style={styles.checkNow}
              />
            </Card>
            <Card style={styles.card}>
              <KeyValueRow label="Ngân hàng" value={va.bank_code || va.provider || "—"} />
              <KeyValueRow label="Số tài khoản" value={va.account_number} copyValue={va.account_number} />
              <KeyValueRow label="Chủ tài khoản" value={va.account_name || "—"} />
              <KeyValueRow
                label="Số tiền"
                value={formatVND(va.amount)}
                copyValue={String(Math.round(Number(va.amount) || 0))}
                last={!va.dien_giai}
              />
              {va.dien_giai ? <KeyValueRow label="Nội dung" value={va.dien_giai} copyValue={va.dien_giai} last /> : null}
            </Card>
            <Text variant="caption" color="textTertiary" align="center">
              Mở app ngân hàng và quét mã QR, hoặc chạm dòng có biểu tượng để sao chép.
            </Text>
          </>
        ) : null;
      case "needsQr":
      case "needsNewQr":
        return (
          <>
            <Card style={styles.card}>
              <View style={styles.amountBlock}>
                <Text variant="caption" color="textSecondary">
                  Tiền cọc còn phải thu
                </Text>
                {amount > 0 ? (
                  <MoneyText value={amount} variant="display" />
                ) : (
                  <Text variant="display" color="textTertiary">
                    —
                  </Text>
                )}
              </View>
              <View style={styles.qrPlaceholder}>
                <View style={styles.qrIcon}>
                  <QrCode size={32} color={colors.textTertiary} />
                </View>
                <Text variant="caption" color="textSecondary" align="center">
                  {screenState === "needsNewQr"
                    ? "Mã QR cũ đã bị huỷ. Bấm “Tạo mã QR mới” để thu tiền."
                    : "Bấm “Tạo mã QR” để tạo tài khoản nhận tiền cọc cho phiếu này."}
                </Text>
              </View>
            </Card>

            {!allowed ? (
              <Banner tone="warning">Chỉ tạo QR cho phiếu đặt cọc chờ duyệt còn tiền cọc phải thu.</Banner>
            ) : !projectId ? (
              <Banner tone="danger">Phiếu đặt cọc chưa gắn dự án.</Banner>
            ) : accountsError ? (
              <Banner tone="danger">{accountsError}</Banner>
            ) : accounts.length === 0 ? (
              <Banner tone="warning">Dự án chưa có tài khoản cấu hình thanh toán.</Banner>
            ) : accounts.length > 1 ? (
              <SelectField
                label="Tài khoản nhận tiền"
                value={maTk}
                options={accounts.map((a) => ({ value: a.MaTK, label: a.TenCauHinh, description: a.Provider || undefined }))}
                onChange={setMaTk}
                variant="raised"
              />
            ) : (
              <Card style={styles.card}>
                <KeyValueRow label="Tài khoản nhận tiền" value={acc?.TenCauHinh || "—"} last />
              </Card>
            )}
            <Text variant="caption" color="textTertiary" style={styles.note}>
              Khách chuyển đủ tiền cọc vào tài khoản định danh, hệ thống tự tạo phiếu thu và duyệt đặt cọc.
            </Text>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen header={header} footer={footer} padded={false} refreshing={refreshing} onRefresh={onRefresh}>
        <View style={styles.body}>{renderBody()}</View>
      </Screen>

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onClosed={() => {
          const action = pendingMenuAction.current;
          pendingMenuAction.current = null;
          if (action === "cancel") void handleCancelVA();
        }}
        title="Tuỳ chọn mã QR"
      >
        <SheetOption icon={Copy} label="Sao chép toàn bộ thông tin" onPress={() => void handleCopyAll()} />
        <SheetOption
          icon={Trash2}
          label="Huỷ mã QR này để tạo lại"
          destructive
          onPress={() => {
            pendingMenuAction.current = "cancel";
            setMenuOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

function Banner({ tone, children }: { tone: "danger" | "warning"; children: React.ReactNode }) {
  const danger = tone === "danger";
  return (
    <View
      style={[styles.banner, { backgroundColor: danger ? colors.dangerSubtle : colors.warningSubtle }]}
      accessibilityLiveRegion="polite"
    >
      <AlertTriangle size={18} color={danger ? colors.onDangerSubtle : colors.onWarningSubtle} />
      <Text variant="caption" color={danger ? "onDangerSubtle" : "onWarningSubtle"} style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

const QR_SIZE = 200;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  card: { borderWidth: 0, borderRadius: radius.xxl, paddingHorizontal: space.lg + 2, ...elevation.soft },
  pill: { borderRadius: radius.full },
  note: { paddingHorizontal: space.xs },
  amountBlock: { alignItems: "center", gap: 2, marginBottom: space.md },
  qrBox: {
    alignSelf: "center",
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  qrImage: { width: QR_SIZE, height: QR_SIZE },
  qrPlaceholder: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
  },
  qrIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  checkNow: { alignSelf: "center" },
  banner: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
  },
});
