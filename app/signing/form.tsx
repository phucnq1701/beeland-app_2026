import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import dayjs from "dayjs";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  FileUp,
  Image as ImageIcon,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react-native";

import { AttachmentList } from "@/components/signing/AttachmentList";
import { CustomerPickerSheet, DepositPickerSheet, type PickedCustomer } from "@/components/signing/PickerSheets";
import {
  AppHeader,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  KeyValueRow,
  Screen,
  SearchBar,
  SegmentedControl,
  SelectField,
  SheetOption,
  SkeletonDetail,
  SkeletonList,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { useWebShiftPicker, buildAppointmentText } from "@/lib/web/pages/sales/giao-dich/dat-lich-ky/ShiftPickerFields.hook";
import { useWebSigningForm } from "@/lib/web/pages/sales/giao-dich/dat-lich-ky/SigningDrawer.hook";
import { useWebSigningFund } from "@/lib/web/pages/sales/giao-dich/dat-lich-ky/SigningFundField.hook";
import { RESET_THEO_QUY } from "@/lib/web/_extract/pages/sales/giao-dich/dat-lich-ky/SigningFundField";
import { BAO_LANH, HINH_THUC_TT_FALLBACK, PHAN_LOAI_CN, PHAN_LOAI_DN } from "@/lib/web/pages/sales/giao-dich/dat-lich-ky/types";
import { NGUON_OPTIONS } from "@/lib/web/pages/sales/giao-dich/dat-lich-ky/signingSource";
import { listRowOut } from "@/lib/web/services/sales/signing-appointment/mapper";
import { SigningAppointmentCloudService } from "@/lib/web/services/sales/signing-appointment";
import { primeWebSession } from "@/lib/web/_shims/lib/session";
import { installWebRuntime } from "@/lib/web/_shims/runtime";
import { onWebToast } from "@/lib/web/_shims/sonner";
import { colors, elevation, radius, space } from "@/theme";
import { uploadTenantFile } from "@/sevicesSupabase/BookingService";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { SigningService } from "@/sevicesSupabase/SigningService";

const NONE = "__none__";
type Opt = { value: any; label: string };
type Attach = { fileName: string; url: string; uploadedAt?: string; hoSoId?: string | null; hoSoTen?: string | null; _kho?: boolean };

const parseJson = (v: unknown) => {
  try {
    return typeof v === "string" && v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

/** Người đồng đứng tên (dạng web CustomerSection: MaKH + thông tin hiển thị) */
const ownerFrom = (x: any) => ({
  id: String(x?.MaKH ?? x?.id ?? ""),
  MaKH: String(x?.MaKH ?? x?.id ?? ""),
  IsPersonal: x?.IsPersonal !== false && x?.is_personal !== false,
  TenKH: x?.TenKH || x?.ten_kh || x?.TenCongTy || x?.ten_cong_ty || "",
  SoCMND: x?.SoCMND || x?.cccd || "",
  DiDong: x?.DiDong || x?.dien_thoai || "",
});

/**
 * Thêm / sửa lịch ký — luồng + logic ĐÚNG form web Đặt lịch ký (lib/web chép nguyên văn: SigningDrawer ⇒ useWebSigningForm,
 * ShiftPickerFields ⇒ useWebShiftPicker, SigningFundField ⇒ useWebSigningFund): Nguồn (Đặt cọc / Hợp đồng) → chứng từ → Quỹ → Điểm ký →
 * Loại thủ tục → ngày (14 ngày tới / lịch tháng, chỗ còn) → Ca còn lượt → hồ sơ cần chuẩn bị (theo phân loại khách) → thanh toán
 * (giao dịch có lịch TT ⇒ khoá) → tệp theo từng hồ sơ (thừa hưởng kho hồ sơ của giao dịch). Lưu = submit web (bắt buộc nhập theo cấu
 * hình kể cả trường có điều kiện, kiểm lại chỗ của ca, fn_signing_appointment_upsert). Giao diện riêng app.
 * Params: `id` (sửa — uuid hoặc seq) | `kind`, `projectId`, `pgcId` (mở từ phiếu đặt cọc ⇒ khoá nguồn + phiếu).
 * Quay về từ customer/new: `newCustomer` (JSON) + `newCustomerFor` (owner).
 */
export default function SigningFormScreen() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    installWebRuntime();
    primeWebSession().finally(() => setReady(true));
  }, []);
  if (!ready) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={<AppHeader variant="soft" title="Lịch ký" />}>
          <SkeletonDetail />
        </Screen>
      </>
    );
  }
  return <SigningForm />;
}

function SigningForm() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    id?: string;
    kind?: string;
    projectId?: string;
    pgcId?: string;
    newCustomer?: string;
    newCustomerFor?: string;
  }>();
  const editingKey = params.id ? String(params.id) : "";

  // Toast của module web ⇒ toast app
  useEffect(
    () =>
      onWebToast((t) => {
        if (t.message) toast.show({ type: t.type === "success" ? "success" : t.type === "info" ? "info" : "error", message: t.message });
      }),
    [toast]
  );

  const drawer = useRef<any>(null);
  const savedRef = useRef<{ row: any; isEdit: boolean } | null>(null);
  const [saved, setSaved] = useState<{ row: any; isEdit: boolean } | null>(null);
  const w = useWebSigningForm(
    {
      maDA: params.projectId || null,
      onSaved: (row: any, isEdit: boolean) => {
        savedRef.current = { row, isEdit };
        setSaved({ row, isEdit });
      },
    },
    drawer
  );
  const form = w.form;
  const setForm = w.setForm;
  const patch = useCallback((p: Record<string, any>) => setForm((prev: any) => ({ ...prev, ...p })), [setForm]);
  const fund = useWebSigningFund({ value: form, onChange: setForm });
  const sp = useWebShiftPicker({ value: form, onChange: setForm, editingId: w.editingId });
  const fc = w.fieldCfg;
  const show = (k: string) => fc?.show?.(k) !== false;
  const ro = (k: string) => fc?.readonly?.(k) === true;
  const req = (k: string) => fc?.required?.(k, form) === true;

  // ── Mở form như web open(kind, row, prefill) ────────────────────────────────
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const boot = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try {
      if (editingKey) {
        const d = await SigningService.get(editingKey);
        const raw = listRowOut(d.raw);
        await drawer.current?.open(d.IsPersonal ? "individual" : "enterprise", { ID: raw.ID, raw });
      } else {
        const kind = params.kind === "enterprise" ? "enterprise" : "individual";
        await drawer.current?.open(kind, null, params.pgcId ? { MaPGC: String(params.pgcId) } : undefined);
      }
    } catch (e: any) {
      setBootError(e?.message || "Không tải được dữ liệu lịch ký");
    } finally {
      setBooting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingKey]);
  useEffect(() => {
    void boot();
  }, [boot]);

  // Mở từ phiếu cọc (không chỉ loại khách): theo khách của phiếu như web openSigningForDeposit
  useEffect(() => {
    if (editingKey || !params.pgcId || params.kind) return;
    const want = Number(form?.MaPhanLoaiKH) === 3 ? "enterprise" : "individual";
    if (form?.MaKH && w.kind !== want) w.setKind(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.MaKH, form?.MaPhanLoaiKH]);

  // Lưu xong (onSaved của web) ⇒ sửa: quay lại; thêm: mở chi tiết lịch vừa tạo
  useEffect(() => {
    if (!saved) return;
    if (saved.isEdit || !saved.row?.ID) router.back();
    else router.replace({ pathname: "/signing/[id]", params: { id: String(saved.row.UID ?? saved.row.ID) } });
  }, [saved, router]);

  // ── Khách hàng chính: đọc hồ sơ theo uuid (nạp lại khi quay về từ màn Sửa khách) ──
  const [customer, setCustomer] = useState<any>(null);
  const loadCustomer = useCallback(async (maKH: string | null | undefined) => {
    if (!maKH) return setCustomer(null);
    setCustomer(await CustomerService.getCustomerById(String(maKH)).catch(() => null));
  }, []);
  useEffect(() => {
    void loadCustomer(form?.MaKH);
  }, [form?.MaKH, loadCustomer]);
  const returningFromEdit = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!returningFromEdit.current) return;
      returningFromEdit.current = false;
      void loadCustomer(form?.MaKH);
    }, [form?.MaKH, loadCustomer])
  );

  // Quay về từ customer/new (người đồng sở hữu mới)
  useEffect(() => {
    const c = parseJson(params.newCustomer);
    if (!c?.id) return;
    const picked = ownerFrom({ ...c, MaKH: c.id });
    setForm((prev: any) =>
      (prev?.CoOwners || []).some((o: any) => o.MaKH === picked.MaKH) ? prev : { ...prev, CoOwners: [...(prev?.CoOwners || []), picked] }
    );
    toast.show({ type: "success", message: "Đã thêm người đồng sở hữu" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.newCustomer]);

  // ── Chọn chứng từ ────────────────────────────────────────────────────────────
  const [depositOpen, setDepositOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [ownerPicker, setOwnerPicker] = useState(false);
  const lockDocument = !!w.lockDeposit || !!w.sourceLocked;
  const pickNguon = (n: string) => {
    if (w.sourceLocked || n === form?.Nguon) return;
    setForm((prev: any) => ({ ...prev, Nguon: n, HopDongId: null, MaPGC: null, SoHopDong: null }));
  };

  // ── Hồ sơ đính kèm (theo từng hồ sơ cần chuẩn bị — DK15) ────────────────────
  const [attachFor, setAttachFor] = useState<{ id: string | null; name: string | null } | null>(null);
  const [attachSheet, setAttachSheet] = useState(false);
  const pendingAttach = useRef<"camera" | "library" | "file" | null>(null);
  // Đóng sheet trước rồi mới mở camera / thư viện (onClosed) — iOS không trình bày 2 lớp cùng lúc
  const pickAttach = (k: "camera" | "library" | "file") => {
    pendingAttach.current = k;
    setAttachSheet(false);
  };
  const [uploading, setUploading] = useState(false);
  const files: Attach[] = Array.isArray(form?.TaiLieu) ? form.TaiLieu : [];
  const hoSo: any[] = sp.hoSo || [];
  const groups = useMemo(() => {
    const ids = new Set(hoSo.map((h) => h.id));
    const list = hoSo.map((h) => ({ id: h.id as string | null, name: h.name as string, note: [h.note, h.ghiChu].filter(Boolean).join("; ") }));
    const other = files.some((f) => !f.hoSoId || !ids.has(f.hoSoId));
    return other || !list.length ? [...list, { id: null, name: "Tài liệu khác", note: "" }] : list;
  }, [hoSo, files]);
  const filesOf = (id: string | null) => {
    const ids = new Set(hoSo.map((h) => h.id));
    return files.map((f, i) => ({ f, i })).filter(({ f }) => (id ? f.hoSoId === id : !f.hoSoId || !ids.has(f.hoSoId)));
  };

  const uploadAssets = async (list: { uri: string; name?: string; type?: string }[], target: { id: string | null; name: string | null }) => {
    if (!list.length) return;
    setUploading(true);
    const added: Attach[] = [];
    let failed = 0;
    for (const f of list) {
      try {
        const url = await uploadTenantFile(f, "signing");
        added.push({
          fileName: f.name || url.split("/").pop() || "tep",
          url,
          uploadedAt: new Date().toISOString(),
          ...(target.id ? { hoSoId: target.id, hoSoTen: target.name } : {}),
        });
      } catch {
        failed += 1;
      }
    }
    setForm((prev: any) => ({ ...prev, TaiLieu: [...(prev?.TaiLieu || []), ...added] }));
    setUploading(false);
    if (failed) toast.show({ type: "error", message: `${failed} tệp tải lên không thành công` });
  };

  const runAttach = async (kind: "camera" | "library" | "file", target: { id: string | null; name: string | null }) => {
    try {
      if (kind === "file") {
        const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
        if (r.canceled) return;
        await uploadAssets(r.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType || "application/octet-stream" })), target);
        return;
      }
      if (kind === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.show({ type: "error", message: "Cần cấp quyền camera để chụp ảnh" });
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        // iOS: chuyển HEIC sang JPEG để web hiển thị được
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const r =
        kind === "camera"
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 10 });
      if (r.canceled) return;
      await uploadAssets(
        r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName || `lich-ky-${Date.now()}-${i}.jpg`, type: a.mimeType || "image/jpeg" })),
        target
      );
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Không thêm được tệp" });
    }
  };

  // ── Thông tin hẹn gửi khách (web copyInfo — clipboard của app) ───────────────
  const copyInfo = async () => {
    const text = buildAppointmentText({
      thuTuc: sp.tenThuTuc,
      tenKH: customer?.tenKH || form?.TenKH,
      maCan: form?.MaCan,
      ngay: sp.dateStr ? dayjs(sp.dateStr).format("DD/MM/YYYY") : null,
      ca: form?.TenCa,
      diem: sp.chosen,
      hoSo,
    });
    await Clipboard.setStringAsync(text);
    toast.show({ type: "success", message: "Đã sao chép thông tin hẹn — dán gửi khách qua Zalo / SMS" });
  };

  // ── Hiển thị ─────────────────────────────────────────────────────────────────
  const isPersonal = w.kind !== "enterprise";
  const header = (
    <AppHeader
      variant="soft"
      title={w.editingId ? "Sửa lịch ký" : "Thêm lịch ký"}
      subtitle={isPersonal ? "Khách hàng cá nhân" : "Khách hàng doanh nghiệp"}
    />
  );

  if (booting) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <SkeletonDetail />
        </Screen>
      </>
    );
  }
  if (bootError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <ErrorState description={bootError} onRetry={() => void boot()} />
        </Screen>
      </>
    );
  }

  const typeOptions: Opt[] = isPersonal ? PHAN_LOAI_CN : PHAN_LOAI_DN;
  const showOwners = isPersonal && Number(form?.MaPhanLoaiKH) === 2;
  const agencyOptions: Opt[] = (w.agencySan ? [{ value: w.agencySan.id, label: w.agencySan.name }] : w.agencies).map((a: any) => ({
    value: String(a.value),
    label: String(a.label ?? a.value),
  }));
  const httt: Opt[] = (w.httt?.length ? w.httt : HINH_THUC_TT_FALLBACK).map((o: any) => ({ value: String(o.value), label: o.label }));
  const planLocked = !!form?.MaLichTT;
  const diemDs: any[] = sp.diemDs || [];
  const thuTucOpts: Opt[] = (sp.chosenDs?.thuTuc ?? []).map((t: any) => ({ value: t.code, label: t.name }));
  const days: any[] = sp.quickDays || [];
  const dayKey = (d: any) => d.format("YYYY-MM-DD");
  const wd = (d: any) => (d.day() === 0 ? "CN" : `T${d.day() + 1}`);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={header}
        padded={false}
        keyboardAware
        footer={
          <BottomActionBar>
            <Button variant="secondary" title="Huỷ" onPress={() => router.back()} style={styles.pill} />
            <Button
              title={w.editingId ? "Lưu thay đổi" : "Lưu lịch ký"}
              loading={!!w.saving}
              disabled={uploading}
              onPress={() => void w.submit()}
              style={[styles.flex, styles.pill]}
            />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          {!w.editingId && !params.pgcId ? (
            <SegmentedControl
              variant="soft"
              value={isPersonal ? "individual" : "enterprise"}
              options={[
                { value: "individual", label: "Cá nhân" },
                { value: "enterprise", label: "Doanh nghiệp" },
              ]}
              onChange={(v) => {
                w.setKind(v);
                patch({ MaPhanLoaiKH: v === "enterprise" ? 3 : 1, CoOwners: v === "enterprise" ? [] : form?.CoOwners });
              }}
            />
          ) : null}

          {/* ── Nguồn + chứng từ ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Nguồn lịch ký
            </Text>
            {/* Nguồn đã khoá (sửa lịch / mở từ chứng từ) ⇒ chỉ hiện chứng từ, như web khoá ô Nguồn */}
            {w.sourceLocked ? null : (
              <SegmentedControl
                variant="soft"
                value={form?.Nguon ?? "DAT_COC"}
                options={NGUON_OPTIONS.map((o: any) => ({ value: o.value, label: o.label }))}
                onChange={(v) => pickNguon(String(v))}
              />
            )}
            {form?.Nguon === "HOP_DONG" ? (
              <DocRow
                label="Hợp đồng"
                value={form?.HopDongId ? `${form?.SoHopDong || "Đã chọn"}${form?.MaCan ? ` · ${form.MaCan}` : ""}` : null}
                placeholder="Chọn hợp đồng"
                locked={lockDocument}
                onPress={() => setContractOpen(true)}
              />
            ) : (
              <DocRow
                label="Phiếu đặt cọc"
                value={form?.MaPGC ? `${form?.SoPhieu || "—"}${form?.MaCan ? ` · ${form.MaCan}` : ""}` : null}
                placeholder="Chọn phiếu đặt cọc"
                locked={lockDocument || ro("MaPGC")}
                onPress={() => setDepositOpen(true)}
              />
            )}
            {show("MaPhanLoaiKH") ? (
              <SelectField
                variant="soft"
                label="Phân loại khách hàng"
                value={form?.MaPhanLoaiKH ?? null}
                options={typeOptions}
                disabled={ro("MaPhanLoaiKH") || !isPersonal}
                onChange={(v) => patch({ MaPhanLoaiKH: v })}
              />
            ) : null}
            {show("MaSan") ? (
              <SelectField
                variant="soft"
                label="Đại lý phụ trách"
                placeholder="Chọn đại lý"
                value={form?.MaSan ? String(form.MaSan) : null}
                options={agencyOptions}
                disabled={!!w.agencySan || ro("MaSan")}
                onChange={(v) => patch({ MaSan: v })}
              />
            ) : null}
          </Card>

          {/* ── Quỹ → Điểm ký → Thủ tục → Ngày → Ca ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Điểm ký, ngày & ca
            </Text>
            <SelectField
              variant="soft"
              label="Quỹ"
              required
              placeholder="Chọn quỹ"
              value={form?.QuyKy ?? null}
              options={(fund.funds || []).map((f: any) => ({ value: f.value, label: f.label }))}
              onChange={(v) => setForm((prev: any) => ({ ...prev, QuyKy: v ?? null, ...RESET_THEO_QUY }))}
            />
            {sp.quyLech ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  sp.patch({ QuyKy: sp.quyLech?.id, MaCauHinh: null, DiemKy: null, TenDiemKy: null, MaLoaiThuTuc: null, TenLoaiThuTuc: null, LoaiThuTuc: null, MaCa: null, TenCa: null })
                }
                style={styles.hint}
              >
                <Text variant="caption" color="textSecondary">
                  Giao dịch theo {sp.quyLech.ten} ({sp.quyLech.nguon}).{" "}
                  <Text variant="caption" weight="semibold" color="primary">
                    Đổi sang
                  </Text>
                </Text>
              </Pressable>
            ) : null}

            <Text variant="caption" weight="semibold" color="textSecondary">
              Điểm ký
            </Text>
            {!form?.MaPGC ? (
              <Hint text={form?.Nguon === "HOP_DONG" ? "Chọn hợp đồng để xem điểm ký." : "Chọn phiếu đặt cọc để xem điểm ký."} />
            ) : sp.optErr ? (
              <Hint text={sp.optErr} />
            ) : sp.loading && !diemDs.length ? (
              <SkeletonList count={2} />
            ) : !diemDs.length ? (
              <Hint text="Quỹ của giao dịch chưa có điểm ký đang áp dụng." />
            ) : (
              <View style={styles.list}>
                {diemDs.map((d: any) => {
                  const active = String(form?.MaCauHinh ?? "").toLowerCase() === d.configId;
                  const full = (sp.opt?.diem ?? []).find((x: any) => x.configId === d.configId);
                  return (
                    <Pressable
                      key={d.configId}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => sp.pickDiem(d)}
                      style={[styles.option, active ? styles.optionActive : null]}
                    >
                      <MapPin size={18} color={active ? colors.primary : colors.textSecondary} />
                      <View style={styles.flex}>
                        <Text variant="body" weight="semibold" color={active ? "primary" : "text"}>
                          {d.ten || "Điểm ký"}
                        </Text>
                        {d.diaChi ? (
                          <Text variant="caption" color="textSecondary" numberOfLines={2}>
                            {d.diaChi}
                          </Text>
                        ) : null}
                        <Text variant="caption" color="textTertiary" numberOfLines={2}>
                          {(d.thuTuc || []).map((t: any) => t.name).join(" · ") || "Chưa có loại thủ tục"}
                          {full && full.remaining != null ? ` · còn ${full.remaining}` : ""}
                        </Text>
                      </View>
                      {active ? <Check size={18} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {show("LoaiThuTuc") ? (
              <SelectField
                variant="soft"
                label="Loại thủ tục"
                required
                disabled={!sp.chosenDs || ro("LoaiThuTuc")}
                placeholder={sp.chosenDs ? "Chọn thủ tục của điểm ký" : "Chọn điểm ký trước"}
                value={form?.MaLoaiThuTuc ?? null}
                options={thuTucOpts}
                onChange={(v) =>
                  sp.patch({
                    MaLoaiThuTuc: v ?? null,
                    TenLoaiThuTuc: thuTucOpts.find((t) => t.value === v)?.label ?? null,
                    LoaiThuTuc: null,
                    MaCa: null,
                    TenCa: null,
                  })
                }
              />
            ) : null}

            {show("NgayBookKy") ? (
              <>
                <View style={styles.row}>
                  <Text variant="caption" weight="semibold" color="textSecondary" style={styles.flex}>
                    Ngày ký{sp.ngayLabel ? ` · ${sp.ngayLabel}` : ""}
                  </Text>
                  {sp.availArgs ? (
                    <Pressable accessibilityRole="button" onPress={() => sp.setShowCalendar(!sp.showCalendar)} hitSlop={8}>
                      <Text variant="caption" weight="semibold" color="primary">
                        {sp.showCalendar ? "Ẩn lịch tháng" : "Lịch tháng"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.row}>
                  <QuickChip label="Ngày mai" onPress={() => sp.pickDate(dayjs().startOf("day").add(1, "day"))} />
                  {sp.availArgs ? (
                    <QuickChip
                      accent
                      label={sp.firstFreeDay ? `Trống gần nhất ${sp.firstFreeDay.format("DD/MM")}` : "Không còn ngày trống"}
                      disabled={!sp.firstFreeDay}
                      onPress={() => sp.firstFreeDay && sp.pickDate(sp.firstFreeDay)}
                    />
                  ) : null}
                </View>
                {sp.showCalendar && sp.availArgs ? (
                  <MonthGrid sp={sp} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip} style={styles.dayStripScroll}>
                    {days.map((d: any) => {
                      const k = dayKey(d);
                      const active = k === sp.dateStr;
                      const n = sp.dayAvail?.[k];
                      const full = !!sp.availArgs && n !== undefined && n <= 0;
                      return (
                        <Pressable
                          key={k}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${wd(d)} ${d.format("DD/MM")}${full ? ", hết chỗ" : ""}`}
                          onPress={() => sp.pickDate(d)}
                          style={[styles.dayChip, active ? styles.dayActive : full ? styles.dayFull : null]}
                        >
                          <Text variant="label" color={active ? "onPrimary" : "textSecondary"}>
                            {k === sp.todayKey ? "Hôm nay" : wd(d)}
                          </Text>
                          <Text variant="subhead" color={active ? "onPrimary" : full ? "textTertiary" : "text"}>
                            {d.format("DD/MM")}
                          </Text>
                          <Text variant="label" color={active ? "onPrimary" : full ? "danger" : "success"}>
                            {!sp.availArgs || n === undefined ? " " : full ? "Hết chỗ" : `Còn ${n}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            ) : null}

            <View style={styles.row}>
              <Text variant="caption" weight="semibold" color="textSecondary" style={styles.flex}>
                Ca ký (lượt còn lại){sp.dateStr ? ` · ${dayjs(sp.dateStr).format("DD/MM")}` : ""}
              </Text>
              {sp.canQuery ? <IconButton icon={RefreshCw} accessibilityLabel="Làm mới số lượt" onPress={() => void sp.refreshSlots()} /> : null}
            </View>
            {!sp.canQuery ? (
              <Hint text="Chọn điểm ký, loại thủ tục và ngày ký để xem lượt còn lại của từng ca." />
            ) : !(sp.shiftOptions || []).length ? (
              <Hint text="Ngày này không còn ca trống ở điểm ký đã chọn." />
            ) : (
              <View style={styles.list}>
                {(sp.shiftOptions || []).map((o: any) => {
                  const active = form?.MaCa === o.value;
                  const s = o.raw;
                  const low = s ? s.capacity > 0 && s.remaining / s.capacity <= 0.2 : false;
                  return (
                    <Pressable
                      key={o.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => sp.pickShift(o.value)}
                      style={[styles.shift, active ? styles.optionActive : low ? styles.shiftLow : null]}
                    >
                      <Text variant="body" weight="semibold" color={active ? "primary" : "text"}>
                        {s ? s.name : o.label}
                      </Text>
                      {s ? (
                        <Text variant="caption" color={active ? "primary" : "textSecondary"}>
                          {s.from}–{s.to} · còn {s.remaining}/{s.capacity}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {sp.place && form?.MaCa ? (
              <View style={styles.summary}>
                <Text variant="caption" weight="semibold" color="textSecondary">
                  Lịch hẹn
                </Text>
                <Text variant="body">
                  {[form?.TenCa, sp.ngayLabel].filter(Boolean).join(", ")} · {sp.place.ten || "Điểm ký"}
                </Text>
                {sp.place.diaChi ? (
                  <Text variant="caption" color="textSecondary">
                    {sp.place.diaChi}
                  </Text>
                ) : null}
                <Button variant="secondary" icon={ClipboardCopy} title="Sao chép gửi khách" onPress={() => void copyInfo()} style={styles.pill} />
              </View>
            ) : null}
          </Card>

          {/* ── Khách hàng ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              {isPersonal ? "Thông tin khách hàng" : "Thông tin doanh nghiệp"}
            </Text>
            {form?.MaKH ? (
              <>
                <View>
                  <KeyValueRow label={isPersonal ? "Họ và tên" : "Tên công ty"} value={customer?.tenKH || form?.TenKH || "—"} />
                  <KeyValueRow
                    label={isPersonal ? "CCCD / Hộ chiếu" : "Mã số thuế"}
                    value={(isPersonal ? customer?.cccd || customer?.cccd_masked : customer?.ma_so_thue_ct) || "—"}
                  />
                  <KeyValueRow label="Điện thoại" value={customer?.dien_thoai || "—"} />
                  <KeyValueRow label="Email" value={customer?.email || "—"} last={isPersonal} />
                  {!isPersonal ? <KeyValueRow label="Người đại diện" value={customer?.nguoi_dai_dien_pl || "—"} last /> : null}
                </View>
                <Button
                  variant="secondary"
                  icon={Pencil}
                  title="Sửa hồ sơ"
                  onPress={() => {
                    returningFromEdit.current = true;
                    router.push(`/customer/${form.MaKH}/edit` as any);
                  }}
                  style={styles.pill}
                />
              </>
            ) : (
              <Hint text="Khách hàng lấy theo chứng từ đã chọn." />
            )}
            <Text variant="caption" color="textTertiary">
              Lịch ký lấy thông tin theo hồ sơ khách hàng; sửa hồ sơ để cập nhật.
            </Text>
          </Card>

          {showOwners ? (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Users size={18} color={colors.textSecondary} />
                <Text variant="subhead" style={styles.flex}>
                  Khách hàng đồng sở hữu ({form?.CoOwners?.length ?? 0})
                </Text>
              </View>
              {(form?.CoOwners || []).map((o: any, i: number) => (
                <View key={`${o.MaKH}-${i}`} style={styles.owner}>
                  <View style={styles.flex}>
                    <Text variant="body" weight="semibold">
                      {i + 1}. {o.TenKH || "—"}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {[o.SoCMND ? `CCCD ${o.SoCMND}` : null, o.DiDong].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </View>
                  <IconButton
                    icon={Trash2}
                    color={colors.danger}
                    accessibilityLabel={`Bỏ ${o.TenKH}`}
                    onPress={() => patch({ CoOwners: (form.CoOwners || []).filter((_: any, j: number) => j !== i) })}
                  />
                </View>
              ))}
              <Button variant="secondary" icon={Plus} title="Thêm người đồng sở hữu" onPress={() => setOwnerPicker(true)} style={styles.pill} />
            </Card>
          ) : null}

          {/* ── Thanh toán ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Thanh toán
            </Text>
            {show("MaPhuongAnTT") ? (
              planLocked ? (
                <View style={styles.locked}>
                  <Lock size={16} color={colors.textTertiary} />
                  <View style={styles.flex}>
                    <Text variant="caption" color="textSecondary">
                      Phương án thanh toán (theo lịch thanh toán của giao dịch)
                    </Text>
                    <Text variant="body">{form?.TenLichTT || "Lịch thanh toán của giao dịch"}</Text>
                  </View>
                </View>
              ) : (
                <SelectField
                  variant="soft"
                  label="Phương án thanh toán"
                  required={req("MaPhuongAnTT")}
                  placeholder="Chọn phương án"
                  value={form?.MaPhuongAnTT ? String(form.MaPhuongAnTT) : NONE}
                  options={[{ value: NONE, label: "Không chọn" }, ...(w.plans || []).map((p: any) => ({ value: String(p.value), label: p.label }))]}
                  disabled={ro("MaPhuongAnTT")}
                  onChange={(v) => patch({ MaPhuongAnTT: v === NONE ? null : v })}
                />
              )
            ) : null}
            {show("LaChuyenKhoan") ? (
              <SelectField
                variant="soft"
                label="Hình thức thanh toán"
                required={req("LaChuyenKhoan")}
                value={form?.LaChuyenKhoan == null ? NONE : String(form.LaChuyenKhoan)}
                options={[{ value: NONE, label: "Không chọn" }, ...httt]}
                disabled={ro("LaChuyenKhoan")}
                onChange={(v) => patch({ LaChuyenKhoan: v === NONE ? null : v === "true" })}
              />
            ) : null}
            {show("CoBaoLanh") ? (
              <SelectField
                variant="soft"
                label="Bảo lãnh"
                required={req("CoBaoLanh")}
                value={form?.CoBaoLanh == null ? NONE : String(form.CoBaoLanh)}
                options={[{ value: NONE, label: "Không chọn" }, ...BAO_LANH.map((o: any) => ({ value: String(o.value), label: o.label }))]}
                disabled={ro("CoBaoLanh")}
                onChange={(v) => patch({ CoBaoLanh: v === NONE ? null : v === "true" })}
              />
            ) : null}
            {show("GhiChu") ? (
              <TextField
                variant="soft"
                label="Ghi chú"
                value={form?.GhiChu || ""}
                onChangeText={(t) => patch({ GhiChu: t })}
                editable={!ro("GhiChu")}
                multiline
                style={styles.note}
              />
            ) : null}
          </Card>

          {/* ── Hồ sơ khách (theo từng hồ sơ cần chuẩn bị) ── */}
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text variant="subhead" style={styles.flex}>
                Hồ sơ cần chuẩn bị
              </Text>
              {hoSo.length ? (
                <Text variant="caption" color="textSecondary">
                  Đã nộp {sp.hoSoDone}/{hoSo.length}
                </Text>
              ) : null}
            </View>
            {groups.map((g) => (
              <View key={g.id ?? "other"} style={styles.group}>
                <Text variant="body" weight="semibold">
                  {g.name}
                </Text>
                {g.note ? (
                  <Text variant="caption" color="textSecondary">
                    {g.note}
                  </Text>
                ) : null}
                <AttachmentList
                  items={filesOf(g.id).map(({ f }) => f) as any}
                  uploading={uploading && attachFor?.id === g.id}
                  onAdd={() => {
                    setAttachFor({ id: g.id, name: g.id ? g.name : null });
                    setAttachSheet(true);
                  }}
                  onRemove={(k) => {
                    const idx = filesOf(g.id)[k]?.i;
                    if (idx == null) return;
                    patch({ TaiLieu: files.filter((_, j) => j !== idx) });
                  }}
                />
              </View>
            ))}
            {files.some((f) => f._kho) ? (
              <Text variant="caption" color="textTertiary">
                Tệp có sẵn từ kho hồ sơ của giao dịch được dùng lại cho lịch này.
              </Text>
            ) : null}
          </Card>
        </View>
      </Screen>

      <DepositPickerSheet
        visible={depositOpen}
        projectId={params.projectId || null}
        selectedId={form?.MaPGC ?? null}
        onClose={() => setDepositOpen(false)}
        onPick={(d) => {
          setDepositOpen(false);
          // Như web handlePickDeposit: ghi phiếu ⇒ form web nạp lại đầy đủ theo uuid (khách, đại lý, đồng sở hữu, lịch TT, kho hồ sơ)
          setForm((prev: any) => ({ ...prev, Nguon: "DAT_COC", HopDongId: null, MaPGC: d.MaPGC, SoPhieu: d.SoPhieu, MaCan: d.MaCan }));
        }}
      />

      <ContractPickerSheet
        visible={contractOpen}
        projectId={params.projectId || null}
        onClose={() => setContractOpen(false)}
        onPick={(c) => {
          setContractOpen(false);
          // Như web SigningSourceField.pickContract
          setForm((prev: any) => ({ ...prev, Nguon: "HOP_DONG", HopDongId: c.id, MaPGC: c.phieu_giu_cho_id ?? null, SoHopDong: c.so_hd ?? null }));
        }}
      />

      <CustomerPickerSheet
        visible={ownerPicker}
        title="Thêm người đồng sở hữu"
        excludeIds={[form?.MaKH, ...(form?.CoOwners || []).map((o: any) => o.MaKH)].filter(Boolean)}
        onClose={() => setOwnerPicker(false)}
        onPick={(c: PickedCustomer) => {
          setOwnerPicker(false);
          setForm((prev: any) => ({
            ...prev,
            CoOwners: [...(prev?.CoOwners || []), ownerFrom({ MaKH: c.id, TenKH: c.name, SoCMND: c.idNo, DiDong: c.phone, IsPersonal: c.isPersonal })],
          }));
          toast.show({ type: "success", message: "Đã thêm người đồng sở hữu" });
        }}
        onAddNew={(personal) => {
          setOwnerPicker(false);
          router.push({
            pathname: "/customer/new",
            params: {
              returnToSigning: "1",
              personal: personal ? "1" : "0",
              newCustomerFor: "owner",
              signingParams: JSON.stringify({ id: params.id, kind: params.kind, projectId: params.projectId, pgcId: params.pgcId }),
            },
          });
        }}
      />

      <BottomSheet
        visible={attachSheet}
        onClose={() => setAttachSheet(false)}
        onClosed={() => {
          const k = pendingAttach.current;
          pendingAttach.current = null;
          if (k && attachFor) void runAttach(k, attachFor);
        }}
        title={attachFor?.name ? `Tải lên: ${attachFor.name}` : "Thêm tài liệu"}
      >
        <SheetOption icon={Camera} label="Chụp ảnh" onPress={() => pickAttach("camera")} />
        <SheetOption icon={ImageIcon} label="Chọn ảnh từ thư viện" onPress={() => pickAttach("library")} />
        <SheetOption icon={FileUp} label="Chọn tệp (PDF, Word…)" onPress={() => pickAttach("file")} />
      </BottomSheet>
    </>
  );

}

function DocRow({
  label,
  value,
  placeholder,
  locked,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [styles.picker, pressed ? styles.pressed : null]}
    >
      <View style={styles.flex}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        <Text variant="body" weight="semibold" color={value ? "text" : "textTertiary"} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      {locked ? <Lock size={18} color={colors.textTertiary} /> : <ChevronRight size={20} color={colors.textTertiary} />}
    </Pressable>
  );
}

/** Lịch tháng: chỗ còn theo ngày (web monthGrid / monthAvail) */
function MonthGrid({ sp }: { sp: any }) {
  const anchor = sp.monthAnchor;
  const cells: any[] = sp.monthGrid || [];
  return (
    <View style={styles.month}>
      <View style={styles.row}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Tháng trước" onPress={() => sp.setMonthAnchor(anchor.subtract(1, "month"))} />
        <Text variant="subhead" align="center" style={styles.flex}>
          Tháng {anchor.format("MM/YYYY")}
        </Text>
        <IconButton icon={ChevronRight} accessibilityLabel="Tháng sau" onPress={() => sp.setMonthAnchor(anchor.add(1, "month"))} />
      </View>
      <View style={styles.grid}>
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
          <Text key={d} variant="label" color="textSecondary" align="center" style={styles.cell}>
            {d}
          </Text>
        ))}
        {cells.map((d) => {
          const k = d.format("YYYY-MM-DD");
          const inMonth = d.month() === anchor.month();
          const past = k < sp.todayKey;
          const n = sp.monthAvail?.[k];
          const active = k === sp.dateStr;
          const disabled = !inMonth || past || (n !== undefined && n <= 0);
          return (
            <Pressable
              key={k}
              disabled={disabled}
              onPress={() => sp.pickDate(d)}
              style={[styles.cell, styles.cellBox, active ? styles.dayActive : null, disabled && !active ? styles.disabled : null]}
            >
              <Text variant="body" color={active ? "onPrimary" : inMonth ? "text" : "textTertiary"} align="center">
                {d.date()}
              </Text>
              <Text variant="label" color={active ? "onPrimary" : n !== undefined && n <= 0 ? "danger" : "success"} align="center">
                {inMonth && !past && n !== undefined ? (n > 0 ? n : "Hết") : " "}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Chọn HĐMB / HĐ góp vốn làm nguồn lịch ký (web SigningSourceField — fn_signing_contract_search) */
function ContractPickerSheet({
  visible,
  projectId,
  onClose,
  onPick,
}: {
  visible: boolean;
  projectId: string | null;
  onClose: () => void;
  onPick: (c: any) => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setRows(null);
    const t = setTimeout(() => {
      SigningAppointmentCloudService.searchContracts(q, projectId)
        .then((r: any[]) => alive && (setRows(r), setError(null)))
        .catch((e: any) => alive && (setRows([]), setError(e?.message || "Không tìm được hợp đồng")));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [visible, q, projectId]);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Chọn hợp đồng">
      <View style={styles.sheet}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Số HĐ / khách hàng / mã căn" variant="soft" />
        {rows === null ? (
          <SkeletonList count={3} />
        ) : error ? (
          <Hint text={error} />
        ) : !rows.length ? (
          <EmptyState title="Không có hợp đồng phù hợp" description="Thử từ khoá khác." />
        ) : (
          rows.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => onPick(c)} style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}>
              <View style={styles.flex}>
                <Text variant="body" weight="semibold">
                  {c.loai_hd === "HDGV" ? "HĐ góp vốn" : "HĐMB"} {c.so_hd || "—"}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {[c.khach_hang, c.ma_can].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </Pressable>
          ))
        )}
      </View>
    </BottomSheet>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <View style={styles.hint}>
      <Text variant="caption" color="textSecondary">
        {text}
      </Text>
    </View>
  );
}

function QuickChip({ label, onPress, accent, disabled }: { label: string; onPress: () => void; accent?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, accent ? styles.quickAccent : null, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}
    >
      <Text variant="caption" weight="semibold" color={accent ? "primary" : "textSecondary"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  card: { borderWidth: 0, borderRadius: radius.xxl, paddingHorizontal: space.lg + 2, gap: space.md, ...elevation.soft },
  cardTitle: { marginBottom: -space.xs },
  pill: { borderRadius: radius.full },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  list: { gap: space.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.surfaceMuted,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  quick: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.full, backgroundColor: colors.surfaceMuted },
  quickAccent: { backgroundColor: colors.primarySubtle },
  dayStripScroll: { marginHorizontal: -(space.lg + 2) },
  dayStrip: { gap: space.sm, paddingHorizontal: space.lg + 2 },
  dayChip: { width: 76, alignItems: "center", gap: 2, paddingVertical: space.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  dayActive: { backgroundColor: colors.primary },
  dayFull: { backgroundColor: colors.dangerSubtle },
  hint: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  shift: { padding: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: "transparent", backgroundColor: colors.surfaceMuted, gap: 2 },
  shiftLow: { backgroundColor: colors.warningSubtle },
  summary: { gap: space.xs, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle },
  owner: { flexDirection: "row", alignItems: "center", gap: space.xs, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  locked: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  note: { minHeight: 72, textAlignVertical: "top", paddingTop: space.sm },
  group: { gap: space.xs },
  month: { gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%` },
  cellBox: { paddingVertical: space.xs, borderRadius: radius.md },
  sheet: { gap: space.sm, paddingBottom: space.lg },
});
