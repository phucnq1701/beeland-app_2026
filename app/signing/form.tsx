import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  ChevronRight,
  FileUp,
  Image as ImageIcon,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react-native";

import { AttachmentList } from "@/components/signing/AttachmentList";
import { CustomerPickerSheet, DepositPickerSheet, type PickedCustomer } from "@/components/signing/PickerSheets";
import { SigningCalendar } from "@/components/signing/SigningCalendar";
import {
  AppHeader,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  ErrorState,
  IconButton,
  KeyValueRow,
  Screen,
  SegmentedControl,
  SelectField,
  SheetOption,
  SkeletonDetail,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  BAO_LANH,
  canQuerySlots,
  coOwnerIdsToSave,
  dateKey,
  ddmm,
  HINH_THUC_TT,
  isLowSlot,
  missingRequired,
  PHAN_LOAI_ALL,
  phanLoaiFromDeposit,
  quickDays,
  requiredValues,
  shiftOptions,
  signingFormKey,
  todayVN,
  WEEKDAY_SHORT,
  weekdayIndex,
  withTime,
  type Attachment,
  type Deposit,
  type ShiftSlot,
} from "@/lib/signing";
import { colors, elevation, radius, space } from "@/theme";
import { uploadTenantFile } from "@/sevicesSupabase/BookingService";
import { CustomerRulesService, type FormRules } from "@/sevicesSupabase/CustomerRulesService";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import { getTypeAccount } from "@/sevicesSupabase/cloudTenant";
import { SigningService, type Procedure } from "@/sevicesSupabase/SigningService";

const RANGE_DAYS = 14;

type CoOwner = {
  MaKH: string;
  TenKH: string;
  SoCMND: string;
  DiDong: string;
  IsPersonal: boolean;
};
type Opt = { value: any; label: string };

const ownerFrom = (x: any): CoOwner => ({
  MaKH: String(x?.MaKH ?? x?.id ?? ""),
  TenKH: x?.TenKH || x?.ten_kh || x?.TenCongTy || x?.ten_cong_ty || "",
  SoCMND: x?.SoCMND || x?.cccd || "",
  DiDong: x?.DiDong || x?.dien_thoai || "",
  IsPersonal: x?.IsPersonal !== false && x?.is_personal !== false,
});

const parseJson = (v: unknown) => {
  try {
    return typeof v === "string" && v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

/**
 * Thêm / sửa lịch ký – như web SigningDrawer + IndividualForm/EnterpriseForm + ShiftPickerFields + CustomerSection:
 * chọn phiếu đặt cọc (điền căn, khách, đại lý, đồng đứng tên, phân loại) → loại thủ tục → ngày (14 ngày tới /
 * lịch tháng, báo hết chỗ) → ca còn lượt (giờ ký = giờ bắt đầu ca) → thanh toán → hồ sơ đính kèm.
 * Lưu: kiểm tra bắt buộc nhập theo cấu hình, bắt buộc loại thủ tục + ca, kiểm tra lại chỗ trống rồi gọi
 * fn_signing_appointment_upsert. Thông tin khách là hồ sơ khách (sửa ở màn Sửa khách), lịch ký chỉ lưu uuid.
 * Params: `id` (sửa) | `kind`, `projectId`, `pgcId` (mở từ phiếu đặt cọc → khoá ô chọn phiếu).
 * Quay về từ customer/new: `newCustomer` (JSON) + `newCustomerFor` (main | owner).
 */
export default function SigningFormScreen() {
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
  const lockDeposit = !!editingKey || !!params.pgcId;

  const [form, setForm] = useState<any>({
    IsPersonal: params.kind !== "enterprise",
    MaPhanLoaiKH: params.kind === "enterprise" ? 3 : 1,
    MaDA: params.projectId || null,
    CoOwners: [] as CoOwner[],
    TaiLieu: [] as Attachment[],
    GhiChu: "",
  });
  const patch = useCallback((p: Record<string, any>) => setForm((prev: any) => ({ ...prev, ...p })), []);

  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [plans, setPlans] = useState<Opt[]>([]);
  const [customerTypes, setCustomerTypes] = useState<Opt[]>([]);
  const [agencies, setAgencies] = useState<Opt[]>([]);
  const [agencySan, setAgencySan] = useState<string | null>(null);
  const [rules, setRules] = useState<FormRules | null>(null);
  const [isAgency, setIsAgency] = useState(false);

  const [slots, setSlots] = useState<ShiftSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dayAvail, setDayAvail] = useState<Record<string, number>>({});
  const [showMonth, setShowMonth] = useState(false);
  const today = todayVN(Date.now());
  const [month, setMonth] = useState(today);
  const [monthAvail, setMonthAvail] = useState<Record<string, number>>({});

  const [depositOpen, setDepositOpen] = useState(false);
  const [customerPicker, setCustomerPicker] = useState<"main" | "owner" | null>(null);
  const [attachSheet, setAttachSheet] = useState(false);
  const pendingAttach = useRef<"camera" | "library" | "file" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const dayStripRef = useRef<ScrollView>(null);

  const days = useMemo(() => quickDays(today, RANGE_DAYS), [today]);
  const day = form.NgayBookKy ? dateKey(form.NgayBookKy) : "";

  // ── Ghi phiếu đặt cọc vào form (web applyDepositRaw) ──────────────────────
  const applyDeposit = useCallback((d: Deposit, agencyId: string | null, fromDeposit = false) => {
    const owners = (d.CoOwners || []).map(ownerFrom).filter((o: CoOwner) => o.MaKH);
    if (d.MaSan && d.TenSan) {
      setAgencies((prev) =>
        prev.some((a) => a.value === d.MaSan) ? prev : [{ value: d.MaSan, label: d.TenSan || "Đại lý" }, ...prev],
      );
    }
    setForm((prev: any) => ({
      ...prev,
      MaPGC: d.MaPGC,
      SoPhieu: d.SoPhieu,
      MaKH: d.MaKH ?? prev.MaKH,
      MaDA: d.MaDA ?? prev.MaDA,
      MaSP: d.MaSP ?? prev.MaSP,
      MaCan: d.MaCan || prev.MaCan,
      TenDA: d.TenDA ?? prev.TenDA,
      // Đại lý phụ trách luôn lấy theo phiếu (trừ tài khoản đại lý)
      MaSan: agencyId ?? d.MaSan ?? prev.MaSan,
      CoOwners: owners,
      MaPhanLoaiKH: phanLoaiFromDeposit(d, owners.length),
      // Mở từ phiếu đặt cọc: loại khách theo khách của phiếu (web openSigningForDeposit);
      // chọn phiếu trong form thì giữ tab Cá nhân / Doanh nghiệp như web
      IsPersonal: fromDeposit ? d.IsPersonal !== false : prev.IsPersonal,
      MaCa: null,
      TenCa: null,
    }));
  }, []);

  // ── Nạp danh mục + dữ liệu ban đầu ─────────────────────────────────────────
  const boot = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try {
      const agency = (await getTypeAccount()) === "AGENCY";
      setIsAgency(agency);
      const [procs, plansList, types, ags, sanId, formRules] = await Promise.all([
        SigningService.procedures().catch(() => []),
        SigningService.plans().catch(() => []),
        SigningService.customerTypes().catch(() => []),
        SigningService.agencies().catch(() => []),
        SigningService.agencySanId().catch(() => null),
        CustomerRulesService.getRulesForForm(signingFormKey(agency)).catch(() => null),
      ]);
      setProcedures(procs);
      setPlans(plansList);
      setCustomerTypes(types);
      setAgencies(ags);
      setAgencySan(sanId);
      setRules(formRules);

      if (editingKey) {
        const d = await SigningService.get(editingKey);
        const owners = await SigningService.customersByIds(d.DongSoHuuIds).catch(() => []);
        setForm({
          ID: d.ID,
          State: d.State,
          IsPersonal: d.IsPersonal,
          MaPGC: d.MaPGC,
          SoPhieu: d.SoPhieu,
          MaDA: d.MaDA,
          TenDA: d.TenDA,
          MaSP: d.MaSP,
          MaCan: d.MaCan,
          MaKH: d.MaKH,
          MaSan: sanId ?? d.MaSan,
          MaPhanLoaiKH: d.MaPhanLoaiKH ?? (d.IsPersonal ? 1 : 3),
          NgayBookKy: d.NgayBookKy,
          LoaiThuTuc: d.LoaiThuTuc,
          TenLoaiThuTuc: d.TenLoaiThuTuc,
          MaCa: d.MaCa,
          TenCa: d.TenCa,
          MaPhuongAnTT: d.MaPhuongAnTT,
          LaChuyenKhoan: d.LaChuyenKhoan,
          CoBaoLanh: d.CoBaoLanh,
          GhiChu: d.GhiChu || "",
          TaiLieu: d.TaiLieu,
          CoOwners: owners.map(ownerFrom),
        });
        if (d.MaSan && d.DaiLy) {
          setAgencies((prev) =>
            prev.some((a) => a.value === d.MaSan) ? prev : [{ value: d.MaSan, label: d.DaiLy || "" }, ...prev],
          );
        }
        if (d.NgayBookKy) setMonth(dateKey(d.NgayBookKy));
      } else {
        if (sanId) patch({ MaSan: sanId });
        if (params.pgcId) {
          const d = await SigningService.getDeposit(String(params.pgcId));
          if (!d) throw new Error("Không tìm thấy phiếu đặt cọc");
          applyDeposit(d, sanId, true);
        }
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

  // ── Khách hàng chính: đọc hồ sơ theo uuid (nạp lại khi quay về từ màn Sửa khách) ──
  const loadCustomer = useCallback(async (maKH: string | null | undefined) => {
    if (!maKH) {
      setCustomer(null);
      return;
    }
    const c = await CustomerService.getCustomerDetailCloud(String(maKH)).catch(() => null);
    setCustomer(c);
  }, []);

  useEffect(() => {
    void loadCustomer(form.MaKH);
  }, [form.MaKH, loadCustomer]);

  const returningFromEdit = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!returningFromEdit.current) return;
      returningFromEdit.current = false;
      void loadCustomer(form.MaKH);
      if (form.CoOwners?.length) {
        SigningService.customersByIds(form.CoOwners.map((o: CoOwner) => o.MaKH))
          .then((list) => list.length && patch({ CoOwners: list.map(ownerFrom) }))
          .catch(() => {});
      }
    }, [form.MaKH, form.CoOwners, loadCustomer, patch]),
  );

  // Quay về từ customer/new → chọn khách vừa tạo
  useEffect(() => {
    const c = parseJson(params.newCustomer);
    if (!c?.id) return;
    const picked = ownerFrom({ ...c, MaKH: c.id });
    if (params.newCustomerFor === "owner") {
      setForm((prev: any) =>
        prev.CoOwners?.some((o: CoOwner) => o.MaKH === picked.MaKH)
          ? prev
          : { ...prev, CoOwners: [...(prev.CoOwners || []), picked] },
      );
      toast.show({ type: "success", message: "Đã thêm người đồng sở hữu" });
    } else {
      patch({ MaKH: picked.MaKH });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.newCustomer]);

  // ── Ca còn lượt của ngày đang chọn ──────────────────────────────────────────
  const slotKey = canQuerySlots(form) ? `${day}|${form.LoaiThuTuc}|${form.MaPGC}` : "";
  const refreshSlots = useCallback(async () => {
    if (!slotKey) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    const [d, proc, pgc] = slotKey.split("|");
    const r = await SigningService.slots(d, proc, pgc);
    setSlots(r);
    setLoadingSlots(false);
  }, [slotKey]);

  useEffect(() => {
    void refreshSlots();
    if (!slotKey) return;
    // Web: không có realtime cho bảng lịch ký → làm mới nhẹ mỗi 20 giây
    const t = setInterval(() => void refreshSlots(), 20000);
    return () => clearInterval(t);
  }, [refreshSlots, slotKey]);

  // ── Lượt trống theo ngày (14 ngày tới + lịch tháng) ─────────────────────────
  useEffect(() => {
    let alive = true;
    SigningService.availability(today, RANGE_DAYS, form.LoaiThuTuc ?? null)
      .then((r) => alive && setDayAvail(r))
      .catch(() => alive && setDayAvail({}));
    return () => {
      alive = false;
    };
  }, [today, form.LoaiThuTuc]);

  useEffect(() => {
    if (!showMonth) return;
    let alive = true;
    const first = `${month.slice(0, 7)}-01`;
    const [y, m] = first.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    SigningService.availability(first, daysInMonth, form.LoaiThuTuc ?? null)
      .then((r) => alive && setMonthAvail(r))
      .catch(() => alive && setMonthAvail({}));
    return () => {
      alive = false;
    };
  }, [showMonth, month, form.LoaiThuTuc]);

  const firstFreeDay = days.find((d) => (dayAvail[d] ?? 0) > 0);

  const pickDay = (d: string) => {
    // Đổi ngày → bỏ ca đã chọn (web pickDate); giữ giờ đang có
    const time = form.NgayBookKy ? String(form.NgayBookKy).slice(11, 16) : "";
    patch({ NgayBookKy: withTime(d, time), MaCa: null, TenCa: null });
  };

  const pickShift = (id: string, slot: ShiftSlot | null, label: string) => {
    const next: any = {
      MaCa: id,
      TenCa: slot ? `${slot.name} (${slot.from}-${slot.to})` : label,
    };
    // Giờ ký = giờ bắt đầu ca
    if (slot?.from && day) next.NgayBookKy = withTime(day, slot.from);
    patch(next);
  };

  const options = shiftOptions(slots, form.MaCa, form.TenCa);

  // ── Hồ sơ đính kèm ──────────────────────────────────────────────────────────
  const uploadAssets = async (files: { uri: string; name?: string; type?: string }[]) => {
    if (!files.length) return;
    setUploading(true);
    const added: Attachment[] = [];
    let failed = 0;
    for (const f of files) {
      try {
        const url = await uploadTenantFile(f, "signing");
        added.push({
          fileName: f.name || url.split("/").pop() || "tep",
          url,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        failed += 1;
      }
    }
    setForm((prev: any) => ({
      ...prev,
      TaiLieu: [...(prev.TaiLieu || []), ...added],
    }));
    setUploading(false);
    if (failed)
      toast.show({
        type: "error",
        message: `${failed} tệp tải lên không thành công`,
      });
  };

  const runAttach = async (kind: "camera" | "library" | "file") => {
    try {
      if (kind === "file") {
        const r = await DocumentPicker.getDocumentAsync({
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (r.canceled) return;
        await uploadAssets(
          r.assets.map((a) => ({
            uri: a.uri,
            name: a.name,
            type: a.mimeType || "application/octet-stream",
          })),
        );
        return;
      }
      if (kind === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.show({
            type: "error",
            message: "Cần cấp quyền camera để chụp ảnh",
          });
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        // iOS: chuyển HEIC sang JPEG để web/ứng dụng hiển thị được
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const r =
        kind === "camera"
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync({
              ...opts,
              allowsMultipleSelection: true,
              selectionLimit: 10,
            });
      if (r.canceled) return;
      await uploadAssets(
        r.assets.map((a, i) => ({
          uri: a.uri,
          name: a.fileName || `lich-ky-${Date.now()}-${i}.jpg`,
          type: a.mimeType || "image/jpeg",
        })),
      );
    } catch (e: any) {
      toast.show({
        type: "error",
        message: e?.message || "Không thêm được tệp",
      });
    }
  };

  // ── Lưu ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (saveLock.current) return;
    if (!form.MaPGC)
      return toast.show({
        type: "error",
        message: "Vui lòng chọn phiếu đặt cọc",
      });
    if (rules) {
      const miss = missingRequired(rules.required, rules.hidden, requiredValues(form, customer), rules.formKey);
      if (miss.length)
        return toast.show({
          type: "error",
          message: `Vui lòng nhập: ${miss.map((m) => m.label).join(", ")}`,
        });
    }
    if (!form.LoaiThuTuc)
      return toast.show({
        type: "error",
        message: "Vui lòng chọn loại thủ tục trước khi lưu",
      });
    if (!form.MaCa)
      return toast.show({
        type: "error",
        message: "Vui lòng chọn ca làm việc trước khi lưu",
      });

    saveLock.current = true;
    setSaving(true);
    try {
      // Kiểm tra lại chỗ trống của ca ngay trước khi lưu (tránh trùng chỗ)
      const fresh = await SigningService.slots(day, form.LoaiThuTuc, form.MaPGC);
      const s = fresh.find((x) => x.id === String(form.MaCa));
      if (s && s.capacity && s.remaining <= 0) {
        setSlots(fresh);
        patch({ MaCa: null, TenCa: null });
        toast.show({
          type: "error",
          message: `Ca "${form.TenCa || ""}" vừa hết chỗ. Vui lòng chọn ca khác.`,
        });
        return;
      }
      const isPersonal = form.IsPersonal !== false;
      const seq = await SigningService.upsert({
        ...form,
        IsPersonal: isPersonal,
        MaPhanLoaiKH: form.MaPhanLoaiKH ?? (isPersonal ? 1 : 3),
        DongSoHuuIds: coOwnerIdsToSave(isPersonal, form.MaPhanLoaiKH, form.CoOwners || []),
      });
      toast.show({
        type: "success",
        message: editingKey ? "Đã cập nhật lịch ký" : "Đã thêm lịch ký",
      });
      if (editingKey || !Number.isFinite(seq)) router.back();
      else
        router.replace({
          pathname: "/signing/[id]",
          params: { id: String(seq) },
        });
    } catch (e: any) {
      toast.show({
        type: "error",
        message: e?.message || "Lưu lịch ký thất bại",
      });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  // ── Khách hàng ──────────────────────────────────────────────────────────────
  const editCustomer = (id: string) => {
    returningFromEdit.current = true;
    router.push(`/customer/${id}/edit` as any);
  };

  const addNewCustomer = (personal: boolean) => {
    const target = customerPicker;
    setCustomerPicker(null);
    router.push({
      pathname: "/customer/new",
      params: {
        returnToSigning: "1",
        personal: personal ? "1" : "0",
        newCustomerFor: target === "owner" ? "owner" : "main",
        signingParams: JSON.stringify({
          id: params.id,
          kind: params.kind,
          projectId: params.projectId,
          pgcId: params.pgcId,
        }),
      },
    });
  };

  const onPickCustomer = (c: PickedCustomer) => {
    if (customerPicker === "owner") {
      setForm((prev: any) => ({
        ...prev,
        CoOwners: [
          ...(prev.CoOwners || []),
          {
            MaKH: c.id,
            TenKH: c.name,
            SoCMND: c.idNo,
            DiDong: c.phone,
            IsPersonal: c.isPersonal,
          },
        ],
      }));
      toast.show({ type: "success", message: "Đã thêm người đồng sở hữu" });
    } else {
      patch({ MaKH: c.id });
    }
    setCustomerPicker(null);
  };

  const isPersonal = form.IsPersonal !== false;
  const hidden = rules?.hidden ?? new Set<string>();
  const readonly = rules?.readonly ?? new Set<string>();
  const show = (k: string) => !hidden.has(k);
  const ro = (k: string) => readonly.has(k);
  const showOwners = isPersonal && (Number(form.MaPhanLoaiKH) === 2 || (form.CoOwners?.length ?? 0) > 0);
  const typeOptions: Opt[] = customerTypes.length ? customerTypes : PHAN_LOAI_ALL;

  const header = (
    <AppHeader
      variant="soft"
      title={editingKey ? "Sửa lịch ký" : "Thêm lịch ký"}
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
              title={editingKey ? "Lưu thay đổi" : "Lưu lịch ký"}
              loading={saving}
              disabled={uploading}
              onPress={() => void save()}
              style={[styles.flex, styles.pill]}
            />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          {!editingKey && !params.pgcId ? (
            <SegmentedControl
              variant="soft"
              value={isPersonal ? "individual" : "enterprise"}
              options={[
                { value: "individual", label: "Cá nhân" },
                { value: "enterprise", label: "Doanh nghiệp" },
              ]}
              onChange={(v) =>
                patch({
                  IsPersonal: v === "individual",
                  MaPhanLoaiKH: v === "individual" ? 1 : 3,
                  CoOwners: v === "individual" ? form.CoOwners : [],
                })
              }
            />
          ) : null}

          {/* ── Thông tin book ký ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Thông tin book ký
            </Text>
            {show("MaPGC") ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chọn phiếu đặt cọc"
                disabled={lockDeposit || ro("MaPGC")}
                onPress={() => setDepositOpen(true)}
                style={({ pressed }) => [styles.picker, pressed ? styles.pressed : null]}
              >
                <View style={styles.flex}>
                  <Text variant="caption" color="textSecondary">
                    Phiếu đặt cọc
                  </Text>
                  <Text variant="body" weight="semibold" color={form.MaPGC ? "text" : "textTertiary"} numberOfLines={1}>
                    {form.MaPGC
                      ? `${form.SoPhieu || "—"}${form.MaCan ? ` · ${form.MaCan}` : ""}`
                      : "Chọn phiếu đặt cọc"}
                  </Text>
                  {form.TenDA ? (
                    <Text variant="caption" color="textSecondary" numberOfLines={1}>
                      {form.TenDA}
                    </Text>
                  ) : null}
                </View>
                {lockDeposit ? (
                  <Lock size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronRight size={20} color={colors.textTertiary} />
                )}
              </Pressable>
            ) : null}
            {show("MaPhanLoaiKH") ? (
              <SelectField
                variant="soft"
                label="Phân loại khách hàng"
                value={form.MaPhanLoaiKH ?? null}
                options={typeOptions}
                onChange={(v) => !ro("MaPhanLoaiKH") && patch({ MaPhanLoaiKH: v })}
              />
            ) : null}
            {show("MaSan") ? (
              agencySan ? (
                <KeyValueRow
                  label="Đại lý phụ trách"
                  value={agencies.find((a) => a.value === agencySan)?.label || "Sàn của tài khoản"}
                  last
                />
              ) : (
                <SelectField
                  variant="soft"
                  label="Đại lý phụ trách"
                  placeholder="Chọn đại lý"
                  value={form.MaSan ?? null}
                  options={agencies}
                  onChange={(v) => !ro("MaSan") && patch({ MaSan: v })}
                />
              )
            ) : null}
          </Card>

          {/* ── Lịch ký: thủ tục → ngày → ca ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Ngày & ca ký
            </Text>
            <SelectField
              variant="soft"
              label="Loại thủ tục"
              required
              placeholder={procedures.length ? "Ký hợp đồng / Ký đặt cọc…" : "Chưa cấu hình loại thủ tục"}
              value={form.LoaiThuTuc ?? null}
              options={procedures.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) =>
                patch({
                  LoaiThuTuc: v,
                  TenLoaiThuTuc: procedures.find((p) => p.id === v)?.name ?? null,
                  MaCa: null,
                  TenCa: null,
                })
              }
            />

            {show("NgayBookKy") ? (
              <>
                <View style={styles.quickRow}>
                  <Text variant="caption" weight="semibold" color="textSecondary" style={styles.flex}>
                    Ngày ký {day ? `· ${formatDate(form.NgayBookKy)}` : ""}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => setShowMonth(!showMonth)} hitSlop={8}>
                    <Text variant="caption" weight="semibold" color="primary">
                      {showMonth ? "Ẩn lịch tháng" : "Lịch tháng"}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.quickRow}>
                  <QuickChip label="Hôm nay" onPress={() => pickDay(today)} />
                  <QuickChip label="Ngày mai" onPress={() => pickDay(days[1])} />
                  {form.LoaiThuTuc ? (
                    <QuickChip
                      accent
                      label={firstFreeDay ? `Trống gần nhất ${ddmm(firstFreeDay)}` : "Không còn ngày trống"}
                      disabled={!firstFreeDay}
                      onPress={() => firstFreeDay && pickDay(firstFreeDay)}
                    />
                  ) : null}
                </View>
                {showMonth ? (
                  <View>
                    <SigningCalendar
                      flat
                      month={month}
                      onMonthChange={setMonth}
                      selected={day || null}
                      onSelect={pickDay}
                      today={today}
                      counts={form.LoaiThuTuc ? monthAvail : {}}
                      mode="slots"
                      disablePast
                    />
                  </View>
                ) : (
                  <ScrollView
                    ref={dayStripRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dayStrip}
                    style={styles.dayStripScroll}
                  >
                    {days.map((d) => {
                      const active = d === day;
                      const n = dayAvail[d];
                      const full = !!form.LoaiThuTuc && n !== undefined && n <= 0;
                      return (
                        <Pressable
                          key={d}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${WEEKDAY_SHORT[weekdayIndex(d)]} ${ddmm(d)}${full ? ", hết chỗ" : ""}`}
                          onPress={() => pickDay(d)}
                          style={[styles.dayChip, active ? styles.dayActive : full ? styles.dayFull : null]}
                        >
                          <Text variant="label" color={active ? "onPrimary" : "textSecondary"}>
                            {d === today ? "Hôm nay" : WEEKDAY_SHORT[weekdayIndex(d)]}
                          </Text>
                          <Text variant="subhead" color={active ? "onPrimary" : full ? "textTertiary" : "text"}>
                            {ddmm(d)}
                          </Text>
                          <Text variant="label" color={active ? "onPrimary" : full ? "danger" : "success"}>
                            {!form.LoaiThuTuc || n === undefined ? " " : full ? "Hết chỗ" : `Còn ${n}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            ) : null}

            <View style={styles.quickRow}>
              <Text variant="caption" weight="semibold" color="textSecondary" style={styles.flex}>
                Ca làm việc (lượt còn lại){day ? ` · ${ddmm(day)}` : ""}
              </Text>
              {slotKey ? (
                <IconButton icon={RefreshCw} accessibilityLabel="Làm mới số lượt" onPress={() => void refreshSlots()} />
              ) : null}
            </View>
            {!slotKey ? (
              <View style={styles.hint}>
                <Text variant="caption" color="textSecondary">
                  Chọn phiếu đặt cọc, loại thủ tục và ngày ký để xem số lượt còn lại của từng ca.
                </Text>
              </View>
            ) : !options.length && !loadingSlots ? (
              <View style={styles.hint}>
                <Text variant="caption" color="textSecondary">
                  Ngày này không còn ca trống phù hợp với loại thủ tục đã chọn.
                </Text>
              </View>
            ) : (
              <View style={styles.shiftGrid}>
                {options.map((o) => {
                  const active = form.MaCa === o.id;
                  const low = o.slot ? isLowSlot(o.slot) : false;
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => pickShift(o.id, o.slot, o.label)}
                      style={[styles.shift, active ? styles.shiftActive : low ? styles.shiftLow : null]}
                    >
                      <Text variant="body" weight="semibold" color={active ? "primary" : "text"}>
                        {o.slot ? o.slot.name : o.label}
                      </Text>
                      {o.slot ? (
                        <Text variant="caption" color={active ? "primary" : "textSecondary"}>
                          {o.slot.from}–{o.slot.to} ·{" "}
                          <Text
                            variant="caption"
                            weight="semibold"
                            color={low && !active ? "onWarningSubtle" : active ? "primary" : "text"}
                          >
                            còn {o.slot.remaining}/{o.slot.capacity}
                          </Text>
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          {/* ── Khách hàng ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              {isPersonal ? "Thông tin khách hàng" : "Thông tin doanh nghiệp"}
            </Text>
            {form.MaKH ? (
              <>
                <View>
                  <KeyValueRow label={isPersonal ? "Họ và tên" : "Tên công ty"} value={customer?.tenKH || "—"} />
                  <KeyValueRow
                    label={isPersonal ? "CCCD / Hộ chiếu" : "Mã số thuế"}
                    value={(isPersonal ? customer?.cccd : customer?.ma_so_thue_ct) || "—"}
                  />
                  <KeyValueRow label="Điện thoại" value={customer?.dien_thoai || "—"} />
                  <KeyValueRow label="Email" value={customer?.email || "—"} last={isPersonal} />
                  {!isPersonal ? (
                    <KeyValueRow label="Người đại diện" value={customer?.nguoi_dai_dien_pl || "—"} last />
                  ) : null}
                </View>
                <View style={styles.actionsRow}>
                  <Button
                    variant="secondary"
                    icon={Pencil}
                    title="Sửa hồ sơ"
                    onPress={() => editCustomer(String(form.MaKH))}
                    style={[styles.flex, styles.pill]}
                  />
                  <Button
                    variant="secondary"
                    icon={RefreshCw}
                    title="Đổi khách"
                    onPress={() => setCustomerPicker("main")}
                    style={[styles.flex, styles.pill]}
                  />
                </View>
              </>
            ) : (
              <Button
                variant="secondary"
                icon={Plus}
                title="Chọn khách hàng"
                onPress={() => setCustomerPicker("main")}
                style={styles.pill}
              />
            )}
            <Text variant="caption" color="textTertiary">
              Lịch ký lấy thông tin theo hồ sơ khách hàng; sửa hồ sơ để cập nhật.
            </Text>
          </Card>

          {showOwners ? (
            <Card style={styles.card}>
              <View style={styles.quickRow}>
                <Users size={18} color={colors.textSecondary} />
                <Text variant="subhead" style={styles.flex}>
                  Khách hàng đồng sở hữu ({form.CoOwners?.length ?? 0})
                </Text>
              </View>
              {(form.CoOwners || []).map((o: CoOwner, i: number) => (
                <View key={`${o.MaKH}-${i}`} style={styles.owner}>
                  <View style={styles.flex}>
                    <Text variant="body" weight="semibold">
                      {i + 1}. {o.TenKH || "—"}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {[o.IsPersonal ? "Cá nhân" : "Doanh nghiệp", o.SoCMND ? `CCCD ${o.SoCMND}` : null, o.DiDong]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <IconButton
                    icon={Pencil}
                    accessibilityLabel={`Sửa ${o.TenKH}`}
                    onPress={() => editCustomer(o.MaKH)}
                  />
                  <IconButton
                    icon={Trash2}
                    color={colors.danger}
                    accessibilityLabel={`Bỏ ${o.TenKH}`}
                    onPress={() =>
                      patch({
                        CoOwners: form.CoOwners.filter((_: CoOwner, j: number) => j !== i),
                      })
                    }
                  />
                </View>
              ))}
              {!form.CoOwners?.length ? (
                <Text variant="caption" color="textSecondary">
                  Chưa có người đồng sở hữu.
                </Text>
              ) : null}
              <Button
                variant="secondary"
                icon={Plus}
                title="Thêm người đồng sở hữu"
                onPress={() => setCustomerPicker("owner")}
                style={styles.pill}
              />
            </Card>
          ) : null}

          {/* ── Thanh toán ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Thanh toán
            </Text>
            {show("MaPhuongAnTT") ? (
              <SelectField
                variant="soft"
                label="Phương án thanh toán"
                placeholder="Chọn phương án"
                value={form.MaPhuongAnTT ?? null}
                options={[{ value: "__none", label: "Không chọn" }, ...plans]}
                onChange={(v) => !ro("MaPhuongAnTT") && patch({ MaPhuongAnTT: v === "__none" ? null : v })}
              />
            ) : null}
            {show("MaHinhThucTT") ? (
              <SelectField
                variant="soft"
                label="Hình thức thanh toán"
                placeholder="Chọn hình thức"
                value={form.LaChuyenKhoan == null ? null : form.LaChuyenKhoan ? "1" : "0"}
                options={[
                  { value: "__none", label: "Không chọn" },
                  ...HINH_THUC_TT.map((o) => ({
                    value: o.value ? "1" : "0",
                    label: o.label,
                  })),
                ]}
                onChange={(v) => !ro("MaHinhThucTT") && patch({ LaChuyenKhoan: v === "__none" ? null : v === "1" })}
              />
            ) : null}
            {show("MaBaoLanh") ? (
              <SelectField
                variant="soft"
                label="Bảo lãnh"
                placeholder="Chọn bảo lãnh"
                value={form.CoBaoLanh == null ? null : form.CoBaoLanh ? "1" : "0"}
                options={[
                  { value: "__none", label: "Không chọn" },
                  ...BAO_LANH.map((o) => ({
                    value: o.value ? "1" : "0",
                    label: o.label,
                  })),
                ]}
                onChange={(v) => !ro("MaBaoLanh") && patch({ CoBaoLanh: v === "__none" ? null : v === "1" })}
              />
            ) : null}
            {show("GhiChu") ? (
              <TextField
                variant="soft"
                label="Ghi chú"
                value={form.GhiChu || ""}
                onChangeText={(t) => patch({ GhiChu: t })}
                editable={!ro("GhiChu")}
                multiline
                style={styles.note}
              />
            ) : null}
          </Card>

          {/* ── Hồ sơ đính kèm ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Hồ sơ đính kèm
            </Text>
            <AttachmentList
              items={form.TaiLieu || []}
              uploading={uploading}
              onAdd={() => setAttachSheet(true)}
              onRemove={(i) =>
                patch({
                  TaiLieu: (form.TaiLieu || []).filter((_: Attachment, j: number) => j !== i),
                })
              }
            />
          </Card>
          {isAgency ? (
            <Text variant="caption" color="textTertiary" align="center">
              Tài khoản đại lý: đại lý phụ trách cố định theo sàn của tài khoản.
            </Text>
          ) : null}
        </View>
      </Screen>

      <DepositPickerSheet
        visible={depositOpen}
        projectId={params.projectId || null}
        selectedId={form.MaPGC ?? null}
        onClose={() => setDepositOpen(false)}
        onPick={(d) => {
          setDepositOpen(false);
          applyDeposit(d, agencySan);
          // Phiếu rút gọn → đọc lại đầy đủ từ máy chủ (web luôn lấy lại theo uuid)
          SigningService.getDeposit(String(d.MaPGC))
            .then((full) => full && applyDeposit(full, agencySan))
            .catch(() => {});
        }}
      />

      <CustomerPickerSheet
        visible={customerPicker !== null}
        title={customerPicker === "owner" ? "Thêm người đồng sở hữu" : "Chọn khách hàng"}
        excludeIds={[form.MaKH, ...(form.CoOwners || []).map((o: CoOwner) => o.MaKH)].filter(Boolean)}
        onClose={() => setCustomerPicker(null)}
        onPick={onPickCustomer}
        onAddNew={addNewCustomer}
      />

      <BottomSheet
        visible={attachSheet}
        onClose={() => setAttachSheet(false)}
        onClosed={() => {
          const k = pendingAttach.current;
          pendingAttach.current = null;
          if (k) void runAttach(k);
        }}
        title="Thêm hồ sơ đính kèm"
      >
        <SheetOption
          icon={Camera}
          label="Chụp ảnh"
          onPress={() => {
            pendingAttach.current = "camera";
            setAttachSheet(false);
          }}
        />
        <SheetOption
          icon={ImageIcon}
          label="Chọn ảnh từ thư viện"
          onPress={() => {
            pendingAttach.current = "library";
            setAttachSheet(false);
          }}
        />
        <SheetOption
          icon={FileUp}
          label="Chọn tệp (PDF, Word…)"
          onPress={() => {
            pendingAttach.current = "file";
            setAttachSheet(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

function QuickChip({
  label,
  onPress,
  accent,
  disabled,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        accent ? styles.quickAccent : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text variant="caption" weight="semibold" color={accent ? "primary" : "textSecondary"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    gap: space.md,
  },
  card: {
    borderWidth: 0,
    borderRadius: radius.xxl,
    paddingHorizontal: space.lg + 2,
    gap: space.md,
    ...elevation.soft,
  },
  cardTitle: { marginBottom: -space.xs },
  pill: { borderRadius: radius.full },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
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
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
  },
  quick: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  quickAccent: { backgroundColor: colors.primarySubtle },
  dayStripScroll: { marginHorizontal: -(space.lg + 2) },
  dayStrip: { gap: space.sm, paddingHorizontal: space.lg + 2 },
  dayChip: {
    width: 76,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  dayActive: { backgroundColor: colors.primary },
  dayFull: { backgroundColor: colors.dangerSubtle },
  hint: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  shiftGrid: { gap: space.sm },
  shift: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  shiftActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  shiftLow: { backgroundColor: colors.warningSubtle },
  actionsRow: { flexDirection: "row", gap: space.sm },
  owner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  note: { minHeight: 72, textAlignVertical: "top", paddingTop: space.sm },
});
