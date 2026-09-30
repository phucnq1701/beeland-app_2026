/**
 * QR thanh toán Booking qua tài khoản định danh (Module BOOKING) — cùng luồng với web
 * (beeland/src/pages/Sales/form/BookingVAQRDialog.tsx), dùng chung edge function
 * `payment-gateway` nên tài khoản định danh + trạng thái thanh toán đồng bộ hai bên:
 *  chọn tài khoản cấu hình → tạo VA (create) → hiện QR VietQR → kiểm tra paid_amount mỗi 5s
 *  → hết hạn giữ chỗ mà chưa nhận tiền thì yêu cầu máy chủ xoá VA (expire_sweep).
 * Riêng app: sao chép từng dòng, lưu QR vào thư viện ảnh, chia sẻ, kiểm tra lại ngay
 * khi quay về từ app ngân hàng, kéo để làm mới.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
  AppState,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  QrCode,
  Share2,
  AlertTriangle,
  Landmark,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { BookingService } from "@/sevicesSupabase/BookingService";
import {
  PaymentGatewayService,
  vietQrUrl,
  type ContractVA,
  type GatewayAccount,
} from "@/sevicesSupabase/PaymentGatewayService";

const BLUE = "#1D4ED8";

const fmtVND = (v: any) =>
  `${new Intl.NumberFormat("vi-VN").format(Math.round(Number(v) || 0))} đ`;

const fmtRemain = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.max(0, s % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const errMsg = (e: any, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export default function QRPaymentScreen() {
  const router = useRouter();
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
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Số tiền booking chuẩn = "Tiền booking" của cài đặt bán hàng (dự án + ngày giữ chỗ)
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expiredHandled = useRef(false);

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
        setExpiredNotice(true);
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

  // ── Hết giờ mà chưa nhận tiền → yêu cầu máy chủ xoá VA ─────────────────────
  useEffect(() => {
    if (!va || paid || !expiresAtMs || remain > 0 || expiredHandled.current) return;
    expiredHandled.current = true;
    PaymentGatewayService.expireSweep(pgcId)
      .then(() => {
        setVa(null);
        setExpiredNotice(true);
      })
      .catch((e) => Alert.alert("Lỗi", errMsg(e, "Không xoá được tài khoản thanh toán")));
  }, [va, paid, remain, expiresAtMs, pgcId]);

  // ── Tạo mã QR ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!acc || !booking) return;
    if (!expiresAtMs || remain <= 0) return Alert.alert("Thông báo", "Booking đã hết thời gian giữ chỗ");
    if (!expectedAmount || expectedAmount <= 0)
      return Alert.alert("Thông báo", amountError || "Chưa xác định được số tiền booking");
    if (!pgcId) return Alert.alert("Thông báo", "Booking chưa có phiếu giữ chỗ");
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
      if (Math.round(Number(created.amount) || 0) !== expectedAmount) {
        Alert.alert(
          "Cảnh báo",
          `Số tiền trên mã QR (${fmtVND(created.amount)}) khác số tiền booking (${fmtVND(
            expectedAmount
          )}). Vui lòng huỷ mã này.`
        );
      }
      expiredHandled.current = false;
      setExpiredNotice(false);
      setVa(created);
      setPaid(Number(created.paid_amount) > 0);
    } catch (e) {
      Alert.alert("Lỗi", errMsg(e, "Tạo QR thất bại"));
    } finally {
      setCreating(false);
    }
  };

  // Mã QR đang mở có số tiền khác cài đặt → không cho quét, cho huỷ để tạo lại
  const amountMismatch =
    !!va &&
    !paid &&
    (expectedAmount == null || Math.round(Number(va.amount) || 0) !== expectedAmount);

  const handleCancelVA = () => {
    if (!va || cancelling) return;
    Alert.alert(
      "Huỷ mã QR",
      `Huỷ tài khoản ${va.account_number} (${fmtVND(va.amount)})? Người chuyển tiền vào tài khoản này sẽ không được ghi nhận.`,
      [
        { text: "Không", style: "cancel" },
        {
          text: "Huỷ mã QR",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await PaymentGatewayService.remove(va.id);
              setVa(null);
              setPaid(false);
              await load();
            } catch (e) {
              Alert.alert("Lỗi", errMsg(e, "Không huỷ được mã QR"));
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Tiện ích ───────────────────────────────────────────────────────────────
  const copy = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

  const shareText = () =>
    va
      ? `Thanh toán Booking ${bookingCode}\nNgân hàng: ${va.bank_code || ""}\nSTK: ${
          va.account_number
        }\nChủ TK: ${va.account_name || ""}\nSố tiền: ${fmtVND(va.amount)}\nNội dung: ${
          va.dien_giai || ""
        }`
      : "";

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
      const target = `${FileSystem.cacheDirectory}QR-${(bookingCode || va.account_number).replace(
        /[^\w-]/g,
        "_"
      )}.png`;
      const { uri } = await FileSystem.downloadAsync(vietQrUrl(va), target);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Đã lưu", "Mã QR đã được lưu vào thư viện ảnh");
    } catch (e) {
      Alert.alert("Lỗi", errMsg(e, "Không lưu được mã QR"));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <Stack.Screen
      options={{
        title: "Thanh toán booking",
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        headerBackTitle: "Quay lại",
      }}
    />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.muted}>Đang tải thông tin thanh toán...</Text>
      </View>
    );
  }

  if (loadError || !booking) {
    return (
      <View style={styles.center}>
        {header}
        <AlertTriangle size={36} color={Colors.error} />
        <Text style={styles.errorText}>{loadError || "Không tìm thấy booking"}</Text>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            setLoading(true);
            void load().finally(() => setLoading(false));
          }}
        >
          <Text style={styles.secondaryBtnText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const expired = !!expiresAtMs && remain <= 0;

  const InfoRow = ({
    label,
    value,
    copyKey,
    copyValue,
    valueStyle,
  }: {
    label: string;
    value: string;
    copyKey?: string;
    copyValue?: string;
    valueStyle?: any;
  }) => (
    <TouchableOpacity
      style={styles.vaRow}
      activeOpacity={copyKey ? 0.6 : 1}
      disabled={!copyKey}
      onPress={() => copyKey && void copy(copyKey, copyValue ?? value)}
    >
      <Text style={styles.vaLabel}>{label}</Text>
      <View style={styles.vaValueWrap}>
        <Text style={[styles.vaValue, valueStyle]} numberOfLines={2}>
          {value}
        </Text>
        {copyKey ? (
          copiedKey === copyKey ? (
            <Check size={16} color={Colors.success} />
          ) : (
            <Copy size={16} color={Colors.textSecondary} />
          )
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Tóm tắt booking */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Số tiền booking</Text>
          <Text style={styles.summaryAmount}>
            {paid && va ? fmtVND(va.amount) : expectedAmount ? fmtVND(expectedAmount) : "—"}
          </Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Khách hàng</Text>
            <Text style={styles.summaryVal} numberOfLines={1}>
              {customerName || "—"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Sản phẩm</Text>
            <Text style={styles.summaryVal}>{productCode || "—"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Mã booking</Text>
            <Text style={styles.summaryVal} numberOfLines={1}>
              {bookingCode || "—"}
            </Text>
          </View>
          {!paid && (
            <View style={[styles.timerPill, expired && styles.timerPillExpired]}>
              <Clock size={14} color={expired ? Colors.error : "#B45309"} />
              <Text style={[styles.timerText, expired && { color: Colors.error }]}>
                {!expiresAtMs ? "Chưa có hạn giữ chỗ" : expired ? "Đã hết hạn" : `Còn lại ${fmtRemain(remain)}`}
              </Text>
            </View>
          )}
        </View>

        {paid && va && (
          <View style={styles.paidCard}>
            <CheckCircle2 size={40} color={Colors.success} />
            <Text style={styles.paidTitle}>Đã nhận thanh toán</Text>
            <Text style={styles.paidSub}>{fmtVND(va.paid_amount)} cho booking {bookingCode}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>Xem chi tiết booking</Text>
            </TouchableOpacity>
          </View>
        )}

        {expiredNotice && !va && (
          <View style={styles.warnBox}>
            <AlertTriangle size={16} color="#B45309" />
            <Text style={styles.warnText}>
              Booking hết thời gian, tài khoản thanh toán đã bị xoá.
            </Text>
          </View>
        )}

        {!va ? (
          // ── Chưa có QR: chọn tài khoản cấu hình và tạo ──
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tài khoản nhận tiền</Text>
            {!projectId ? (
              <Text style={styles.errorInline}>Booking chưa gắn dự án.</Text>
            ) : accountsError ? (
              <Text style={styles.errorInline}>{accountsError}</Text>
            ) : accounts.length === 0 ? (
              <Text style={styles.muted}>Dự án chưa có tài khoản cấu hình thanh toán.</Text>
            ) : (
              accounts.map((a) => {
                const selected = a.MaTK === maTk;
                return (
                  <TouchableOpacity
                    key={a.MaTK}
                    style={[styles.accountItem, selected && styles.accountItemActive]}
                    activeOpacity={0.8}
                    onPress={() => setMaTk(a.MaTK)}
                  >
                    <View style={[styles.radio, selected && styles.radioActive]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <Landmark size={18} color={selected ? Colors.primary : Colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName}>{a.TenCauHinh}</Text>
                      {!!a.Provider && <Text style={styles.accountSub}>{a.Provider}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            {!!amountError && <Text style={styles.errorInline}>{amountError}</Text>}
            <Text style={styles.note}>
              Tài khoản định danh chỉ có hiệu lực tới khi booking hết thời gian giữ chỗ; quá hạn mà
              chưa chuyển tiền sẽ tự bị xoá.
            </Text>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!acc || expired || !expiresAtMs || !projectId || !expectedAmount || creating) &&
                  styles.btnDisabled,
              ]}
              disabled={!acc || expired || !expiresAtMs || !projectId || !expectedAmount || creating}
              onPress={handleCreate}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <QrCode size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Tạo mã QR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : amountMismatch ? (
          // ── QR đang mở sai số tiền: không hiện mã để tránh chuyển nhầm ──
          <View style={styles.card}>
            <View style={styles.dangerBox}>
              <AlertTriangle size={18} color={Colors.error} />
              <Text style={styles.dangerText}>
                {expectedAmount == null
                  ? `Không kiểm tra được số tiền booking${amountError ? `: ${amountError}` : ""}. Mã QR tạm ẩn để tránh chuyển sai tiền.`
                  : `Mã QR đang mở (${va.account_number}) có số tiền ${fmtVND(
                      va.amount
                    )}, khác số tiền booking ${fmtVND(expectedAmount)}. Mã QR tạm ẩn để tránh chuyển sai tiền.`}
              </Text>
            </View>
            {expectedAmount == null ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={onRefresh}>
                <Text style={styles.primaryBtnText}>Thử lại</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.dangerBtn, cancelling && styles.btnDisabled]}
                onPress={handleCancelVA}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Huỷ mã QR này để tạo lại</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // ── Đã có QR ──
          <View style={styles.card}>
            {!paid && (
              <Text style={styles.qrHint}>Mở app ngân hàng và quét mã QR để thanh toán</Text>
            )}
            <View style={styles.qrBox}>
              <Image source={{ uri: vietQrUrl(va) }} style={styles.qrImage} resizeMode="contain" />
            </View>
            <View style={[styles.statusPill, paid ? styles.statusPaid : styles.statusWaiting]}>
              {paid ? (
                <CheckCircle2 size={14} color={Colors.success} />
              ) : (
                <ActivityIndicator size="small" color="#B45309" />
              )}
              <Text style={[styles.statusText, { color: paid ? "#047857" : "#B45309" }]}>
                {paid ? "Đã thanh toán" : "Chờ chuyển tiền"}
              </Text>
            </View>

            <View style={styles.vaList}>
              <InfoRow label="Ngân hàng" value={va.bank_code || va.provider || "—"} />
              <InfoRow
                label="STK định danh"
                value={va.account_number}
                copyKey="stk"
                valueStyle={styles.mono}
              />
              <InfoRow label="Chủ TK" value={va.account_name || "—"} />
              <InfoRow
                label="Số tiền"
                value={fmtVND(va.amount)}
                copyKey="amount"
                copyValue={String(Math.round(Number(va.amount) || 0))}
                valueStyle={{ color: BLUE, fontWeight: "700" }}
              />
              {!!va.dien_giai && (
                <InfoRow label="Nội dung" value={va.dien_giai} copyKey="content" />
              )}
            </View>
            <Text style={styles.tapHint}>Chạm vào dòng có biểu tượng để sao chép</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => void copy("all", shareText())}>
                {copiedKey === "all" ? (
                  <Check size={16} color={Colors.success} />
                ) : (
                  <Copy size={16} color={Colors.text} />
                )}
                <Text style={styles.outlineBtnText}>Sao chép</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={handleSaveQR} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Download size={16} color={Colors.text} />
                )}
                <Text style={styles.outlineBtnText}>Lưu QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={handleShare}>
                <Share2 size={16} color={Colors.text} />
                <Text style={styles.outlineBtnText}>Chia sẻ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F5F3" },
  scroll: { padding: 16, gap: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#F6F5F3",
  },
  muted: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  errorText: { color: Colors.text, fontSize: 15, textAlign: "center" },
  errorInline: { color: Colors.error, fontSize: 14 },

  summaryCard: { backgroundColor: Colors.primary, borderRadius: 20, padding: 20, ...shadow },
  summaryLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  summaryAmount: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 4 },
  summaryDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginVertical: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, gap: 12 },
  summaryKey: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  summaryVal: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  timerPillExpired: { backgroundColor: "#FEE2E2" },
  timerText: { color: "#B45309", fontWeight: "700", fontSize: 13, fontVariant: ["tabular-nums"] },

  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 12, ...shadow },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },

  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#EDEBE8",
    borderRadius: 14,
    padding: 14,
  },
  accountItemActive: { borderColor: Colors.primary, backgroundColor: "#FFF5EE" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C9C5C0",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  accountName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  accountSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  note: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 15,
    alignSelf: "stretch",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: "600" },

  qrHint: { textAlign: "center", color: Colors.textSecondary, fontSize: 13 },
  qrBox: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#EDEBE8",
    borderRadius: 16,
    padding: 8,
    backgroundColor: "#fff",
  },
  qrImage: { width: 260, height: 300 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusWaiting: { backgroundColor: "#FEF3C7" },
  statusPaid: { backgroundColor: "#D1FAE5" },
  statusText: { fontSize: 13, fontWeight: "700" },

  vaList: { borderTopWidth: 1, borderTopColor: "#F0EEEB" },
  vaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EEEB",
    gap: 12,
  },
  vaLabel: { color: Colors.textSecondary, fontSize: 14 },
  vaValueWrap: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  vaValue: { color: Colors.text, fontSize: 14, fontWeight: "600", textAlign: "right", flexShrink: 1 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }), letterSpacing: 0.5 },
  tapHint: { fontSize: 12, color: Colors.textSecondary, textAlign: "center" },

  actionRow: { flexDirection: "row", gap: 10 },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E3E0DC",
    borderRadius: 12,
    paddingVertical: 12,
  },
  outlineBtnText: { color: Colors.text, fontWeight: "600", fontSize: 14 },

  paidCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: "center", gap: 8, ...shadow },
  paidTitle: { fontSize: 18, fontWeight: "800", color: "#047857" },
  paidSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6, textAlign: "center" },

  dangerBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
  },
  dangerText: { color: "#991B1B", fontSize: 14, flex: 1, lineHeight: 20 },
  dangerBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.error,
    borderRadius: 14,
    paddingVertical: 15,
  },
  warnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
  },
  warnText: { color: "#92400E", fontSize: 13, flex: 1 },
});
