/**
 * QR thanh toán Booking qua tài khoản định danh (Module BOOKING) — cùng luồng với web
 * (beeland/src/pages/Sales/form/BookingVAQRDialog.tsx), dùng chung edge function
 * `payment-gateway` nên tài khoản định danh + trạng thái thanh toán đồng bộ hai bên:
 *  chọn tài khoản cấu hình → tạo VA (create) → hiện QR VietQR → kiểm tra paid_amount mỗi 5s
 *  → hết hạn giữ chỗ mà chưa nhận tiền thì yêu cầu máy chủ xoá VA (expire_sweep).
 * Riêng app: sao chép từng dòng, lưu QR vào thư viện ảnh, chia sẻ, kiểm tra lại ngay
 * khi quay về từ app ngân hàng, kéo để làm mới.
 *
 * Giao diện theo trạng thái lib/qrPaymentState (spec 5.4, 5.5). Không bao giờ tự tạo QR.
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
  CountdownPill,
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
import { QrExpired, QrNoDeadline, QrPaid } from "@/components/booking/QrResult";
import { formatVND } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import { getQrScreenState } from "@/lib/qrPaymentState";
import { colors, radius, space } from "@/theme";
import { BookingService } from "@/sevicesSupabase/BookingService";
import {
  PaymentGatewayService,
  vietQrUrl,
  type ContractVA,
  type GatewayAccount,
} from "@/sevicesSupabase/PaymentGatewayService";

const errMsg = (e: any, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export default function QRPaymentScreen() {
  const router = useRouter();
  const toast = useToast();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  const [booking, setBooking] = useState<any>(null);
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
  // Booking từng có QR nhưng đã bị huỷ/hết hạn → tạo mới phải hỏi xác nhận (spec D10)
  const [hadPreviousQr, setHadPreviousQr] = useState(false);
  // Số tiền booking chuẩn = "Tiền booking" của cài đặt bán hàng (dự án + ngày giữ chỗ)
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expiredHandled = useRef(false);
  const wasPaid = useRef(false);

  // Cùng khoá với web: Key = id phiếu giữ chỗ (cloud_pgc_phieu_giucho.id)
  const pgcId = String(booking?.maPGC || "");
  const projectId = String(booking?.project?.id || "");
  const bookingCode = String(booking?.soPhieu || "");
  const customerName = booking?.customer?.tenKH || "";
  const productCode = booking?.product?.ky_hieu || booking?.product?.ma_sp || "";
  const expiresAtMs = useMemo(() => {
    const t = booking?.hetHanLuc ? new Date(booking.hetHanLuc).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  }, [booking?.hetHanLuc]);
  const remain = expiresAtMs ? Math.max(0, Math.floor((expiresAtMs - now) / 1000)) : 0;

  const acc = useMemo(() => accounts.find((a) => a.MaTK === maTk), [accounts, maTk]);

  // ── Nạp booking + tài khoản cấu hình + VA booking đang hiệu lực ─────────────
  const load = useCallback(async () => {
    setLoadError(null);
    setAccountsError(null);
    setAmountError(null);
    try {
      const res = await BookingService.getBookingEditDetail(String(bookingId ?? ""));
      const b = res?.data;
      if (!b) throw new Error("Không tìm thấy booking");
      setBooking(b);
      const pid = String(b?.project?.id || "");
      const pgc = String(b?.maPGC || "");
      const bookingDay = b?.ngayGiuCho ?? b?.ngayNhap ?? null;
      const [resolved, accs, list] = await Promise.all([
        pid
          ? BookingService.resolveBookingAmount(pid, bookingDay).catch((e) => {
              setAmountError(errMsg(e, "Không tải được cài đặt bán hàng"));
              return null;
            })
          : Promise.resolve(null),
        pid
          ? PaymentGatewayService.getAccounts(pid).catch((e) => {
              setAccountsError(errMsg(e, "Không tải được tài khoản cấu hình"));
              return [] as GatewayAccount[];
            })
          : Promise.resolve([] as GatewayAccount[]),
        pgc ? PaymentGatewayService.listByContract(pgc).catch(() => null) : Promise.resolve(null),
      ]);
      setExpectedAmount(resolved?.amount ?? null);
      if (resolved && resolved.amount == null) {
        const [y, m, d] = resolved.day.split("-");
        setAmountError(
          `Dự án chưa cài "Tiền booking" trong Cài đặt bán hàng áp dụng cho ngày ${d}/${m}/${y}.`
        );
      }
      setAccounts(accs || []);
      setMaTk((prev) =>
        prev != null && (accs || []).some((a) => a.MaTK === prev) ? prev : (accs || [])[0]?.MaTK ?? null
      );
      const active = list?.accounts?.find((a) => a.status === "ACTIVE" && a.module === "BOOKING");
      setVa(active ?? null);
      setPaid(!!active && Number(active.paid_amount) > 0);
      setHadPreviousQr(
        !!list?.accounts?.some((a) => a.module === "BOOKING" && a.status === "DELETED")
      );
    } catch (e) {
      setLoadError(errMsg(e, "Không tải được thông tin thanh toán"));
    }
  }, [bookingId]);

  useEffect(() => {
    expiredHandled.current = false;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Đồng hồ ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Kiểm tra thanh toán ────────────────────────────────────────────────────
  const checkPaid = useCallback(async () => {
    if (!va || paid || !pgcId) return;
    try {
      const list = await PaymentGatewayService.listByContract(pgcId);
      const cur = list.accounts.find((a) => a.id === va.id);
      if (cur && Number(cur.paid_amount) > 0) {
        setPaid(true);
        setVa(cur);
      } else if (cur && cur.status === "DELETED") {
        setVa(null);
        setHadPreviousQr(true);
      }
    } catch {
      /* thử lại lần sau */
    }
  }, [va, paid, pgcId]);

  // Mỗi 5s giống web
  useEffect(() => {
    if (!va || paid) return;
    const t = setInterval(() => void checkPaid(), 5000);
    return () => clearInterval(t);
  }, [va, paid, checkPaid]);

  // Quay lại từ app ngân hàng → kiểm tra ngay, không chờ vòng 5s
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void checkPaid();
    });
    return () => sub.remove();
  }, [checkPaid]);

  // Vừa nhận tiền → rung báo thành công đúng một lần
  useEffect(() => {
    if (paid && !wasPaid.current) hapticSuccess();
    wasPaid.current = paid;
  }, [paid]);

  // ── Hết giờ mà chưa nhận tiền → yêu cầu máy chủ xoá VA ─────────────────────
  useEffect(() => {
    if (!va || paid || !expiresAtMs || remain > 0 || expiredHandled.current) return;
    expiredHandled.current = true;
    PaymentGatewayService.expireSweep(pgcId)
      .then(() => {
        setVa(null);
        setHadPreviousQr(true);
      })
      .catch((e) => toast.show({ type: "error", message: errMsg(e, "Không xoá được tài khoản thanh toán") }));
  }, [va, paid, remain, expiresAtMs, pgcId, toast]);

  // Mã QR đang mở có số tiền khác cài đặt → không cho quét, cho huỷ để tạo lại
  const amountMismatch =
    !!va &&
    !paid &&
    (expectedAmount == null || Math.round(Number(va.amount) || 0) !== expectedAmount);

  const screenState = getQrScreenState({
    loading,
    loadError: loadError ?? (!loading && !booking ? "Không tìm thấy booking" : null),
    paid: paid && !!va,
    hasActiveVa: !!va,
    amountMismatch,
    remainingSec: expiresAtMs ? remain : null,
    hadPreviousQr,
  });

  // ── Tạo mã QR (chỉ khi người dùng bấm) ─────────────────────────────────────
  const handleCreate = async () => {
    if (!acc || !booking || creating) return;
    // Các điều kiện dưới đã được chặn bằng trạng thái nút; giữ lại để phòng thủ.
    if (!expiresAtMs || remain <= 0) {
      toast.show({ type: "error", message: "Booking đã hết thời gian giữ chỗ" });
      return;
    }
    if (!expectedAmount || expectedAmount <= 0) {
      toast.show({ type: "error", message: amountError || "Chưa xác định được số tiền booking" });
      return;
    }
    if (!pgcId) {
      toast.show({ type: "error", message: "Booking chưa có phiếu giữ chỗ" });
      return;
    }
    if (screenState === "needsNewQr") {
      const ok = await confirm({
        title: "Tạo mã QR mới?",
        message: "Mã QR cũ đã hết hạn hoặc đã bị huỷ và sẽ được thay bằng mã mới.",
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
        module: "BOOKING",
        expires_at: new Date(expiresAtMs).toISOString(),
        items: [
          {
            pgc_id: pgcId,
            so_hop_dong: bookingCode,
            khach_hang_id: booking?.customer?.id ?? null,
            ten_kh: customerName,
            ky_hieu: productCode || undefined,
            amount: expectedAmount,
            dien_giai: `Thanh toan booking ${bookingCode}`.trim(),
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
      // Lệch số tiền → trạng thái "mismatch" tự hiển thị cảnh báo, không cần Alert.
      expiredHandled.current = false;
      setVa(created);
      setPaid(Number(created.paid_amount) > 0);
    } catch (e) {
      toast.show({ type: "error", message: errMsg(e, "Tạo QR thất bại") });
    } finally {
      setCreating(false);
    }
  };

  const handleCancelVA = async () => {
    setMenuOpen(false);
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
      ? `Thanh toán Booking ${bookingCode}\nNgân hàng: ${va.bank_code || ""}\nSTK: ${
          va.account_number
        }\nChủ TK: ${va.account_name || ""}\nSố tiền: ${formatVND(va.amount)}\nNội dung: ${
          va.dien_giai || ""
        }`
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
        // Lỗi chặn → giữ Alert
        Alert.alert("Thông báo", "Cần cấp quyền lưu ảnh vào thư viện");
        return;
      }
      const target = `${FileSystem.cacheDirectory}QR-${(bookingCode || va.account_number).replace(
        /[^\w-]/g,
        "_"
      )}.png`;
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
      title="Thu tiền booking"
      subtitle={bookingCode ? `${bookingCode}${customerName ? " · " + customerName : ""}` : undefined}
      actions={
        screenState === "active" ? (
          <IconButton icon={MoreVertical} accessibilityLabel="Tuỳ chọn" onPress={() => setMenuOpen(true)} />
        ) : null
      }
    />
  );

  const canCreate = !!acc && !!projectId && !!expectedAmount;

  const footer = (() => {
    switch (screenState) {
      case "paid":
        return (
          <BottomActionBar>
            <Button size="lg" fullWidth title="Xem chi tiết booking" onPress={() => router.back()} style={styles.flex} />
          </BottomActionBar>
        );
      case "expired":
        return (
          <BottomActionBar>
            <Button variant="secondary" fullWidth title="Về chi tiết booking" onPress={() => router.back()} style={styles.flex} />
          </BottomActionBar>
        );
      case "mismatch":
        return (
          <BottomActionBar>
            {expectedAmount == null ? (
              <Button fullWidth title="Thử lại" onPress={onRefresh} style={styles.flex} />
            ) : (
              <Button
                variant="danger"
                fullWidth
                title="Huỷ mã QR này để tạo lại"
                loading={cancelling}
                onPress={handleCancelVA}
                style={styles.flex}
              />
            )}
          </BottomActionBar>
        );
      case "active":
        return (
          <BottomActionBar>
            <Button variant="secondary" icon={Download} title="Lưu QR" loading={saving} onPress={handleSaveQR} />
            <Button icon={Send} title="Gửi cho khách" onPress={handleShare} style={styles.flex} />
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
              style={styles.flex}
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
            description={loadError || "Không tìm thấy booking"}
            onRetry={() => {
              setLoading(true);
              void load().finally(() => setLoading(false));
            }}
          />
        );
      case "paid":
        return <QrPaid amount={va?.paid_amount} bookingCode={bookingCode} />;
      case "noDeadline":
        return <QrNoDeadline />;
      case "expired":
        return <QrExpired />;
      case "mismatch":
        return (
          <>
            <Banner tone="danger">
              {expectedAmount == null
                ? `Không kiểm tra được số tiền booking${amountError ? `: ${amountError}` : ""}. Mã QR tạm ẩn để tránh chuyển sai tiền.`
                : `Số tiền trên mã QR (${formatVND(va?.amount)}) khác số tiền booking (${formatVND(expectedAmount)}). Vui lòng huỷ mã này để tạo lại.`}
            </Banner>
            {va ? (
              <View style={[styles.qrBox, styles.qrDim]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Image source={{ uri: vietQrUrl(va) }} style={styles.qrImage} resizeMode="contain" />
              </View>
            ) : null}
          </>
        );
      case "active":
        return va ? (
          <>
            <CountdownPill expiresAt={expiresAtMs} />
            <Card>
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
            </Card>
            <Card>
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
            <CountdownPill expiresAt={expiresAtMs} />
            <Card>
              <View style={styles.amountBlock}>
                <Text variant="caption" color="textSecondary">
                  Số tiền booking
                </Text>
                {expectedAmount ? (
                  <MoneyText value={expectedAmount} variant="display" />
                ) : (
                  <Text variant="display" color="textTertiary">
                    —
                  </Text>
                )}
              </View>
              <View style={styles.qrPlaceholder}>
                <QrCode size={56} color={colors.textTertiary} />
                <Text variant="caption" color="textSecondary" align="center">
                  {screenState === "needsNewQr"
                    ? "Mã QR cũ đã hết hạn hoặc đã bị huỷ. Bấm “Tạo mã QR mới” để thu tiền."
                    : "Bấm “Tạo mã QR” để tạo tài khoản nhận tiền cho booking này."}
                </Text>
              </View>
            </Card>

            {!projectId ? (
              <Banner tone="danger">Booking chưa gắn dự án.</Banner>
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
              />
            ) : (
              <Card>
                <KeyValueRow label="Tài khoản nhận tiền" value={acc?.TenCauHinh || "—"} last />
              </Card>
            )}
            {amountError ? <Banner tone="warning">{amountError}</Banner> : null}
            <Text variant="caption" color="textTertiary">
              Tài khoản định danh chỉ có hiệu lực tới khi booking hết thời gian giữ chỗ; quá hạn mà chưa chuyển
              tiền sẽ tự bị xoá.
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
      <Screen header={header} footer={footer} refreshing={refreshing} onRefresh={onRefresh}>
        {renderBody()}
      </Screen>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Tuỳ chọn mã QR">
        <SheetOption icon={Copy} label="Sao chép toàn bộ thông tin" onPress={() => void handleCopyAll()} />
        <SheetOption icon={Trash2} label="Huỷ mã QR này để tạo lại" destructive onPress={() => void handleCancelVA()} />
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
  amountBlock: { alignItems: "center", gap: 2, marginBottom: space.md },
  qrBox: {
    alignSelf: "center",
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  qrDim: { opacity: 0.3 },
  qrImage: { width: QR_SIZE, height: QR_SIZE },
  qrPlaceholder: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
  },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  banner: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
});
