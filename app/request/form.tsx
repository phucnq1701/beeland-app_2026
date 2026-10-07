import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Camera, ChevronRight, FileUp, Image as ImageIcon, UserSearch, X } from "lucide-react-native";

import { CustomerPickerSheet, type PickedCustomer } from "@/components/signing/PickerSheets";
import { AttachmentList } from "@/components/signing/AttachmentList";
import {
  AppHeader,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  DateField,
  ErrorState,
  Screen,
  SelectField,
  SheetOption,
  SkeletonDetail,
  Text,
  TextField,
  useToast,
  type SelectOption,
} from "@/components/ui";
import {
  DEFAULT_NEW_STATUS,
  DEFAULT_PRIORITY,
  joinDue,
  projectSaveCode,
  projectValueOf,
  splitDue,
  timeOptions,
  validateRequestForm,
  type RequestFormErrors,
  type YcCat,
} from "@/lib/customerRequest";
import { formatDate } from "@/lib/format";
import { toYmd } from "@/lib/reportPeriod";
import { colors, elevation, radius, space } from "@/theme";
import { getMaNv } from "@/sevicesSupabase/cloudTenant";
import { CustomerService } from "@/sevicesSupabase/CustomerService";
import {
  CustomerRequestService,
  type EmployeeOption,
  type RequestCatalogs,
} from "@/sevicesSupabase/CustomerRequestService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

type FileItem = { stored: string; url: string; fileName: string };

type FormState = {
  projectId: string | null;
  contractId: string | null;
  contractLabel: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  title: string;
  content: string;
  category: string | null;
  source: string | null;
  priority: string | null;
  status: string | null;
  dueDay: string | null;
  dueTime: string | null;
  receiverId: string | null;
  assigneeId: string | null;
  internalNote: string;
  files: FileItem[];
};

const EMPTY: FormState = {
  projectId: null,
  contractId: null,
  contractLabel: null,
  customerId: null,
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  title: "",
  content: "",
  category: null,
  source: null,
  priority: null,
  status: null,
  dueDay: null,
  dueTime: null,
  receiverId: null,
  assigneeId: null,
  internalNote: "",
  files: [],
};

const TIMES = timeOptions();
const NONE = "__none__";

const catOptions = (list: YcCat[], current: string | null, currentName?: string): SelectOption<string>[] => {
  const opts: SelectOption<string>[] = [
    { value: NONE, label: "Không chọn" },
    ...list.map((c) => ({ value: c.ID, label: c.Name, description: c.GhiChu ?? undefined })),
  ];
  // Mã đang lưu không còn trong danh mục → vẫn hiện để không mất giá trị khi lưu lại
  if (current && !list.some((c) => c.ID === current)) opts.push({ value: current, label: currentName || current });
  return opts;
};
const fromSelect = (v: string) => (v === NONE ? null : v);
const has = (list: YcCat[], code: string) => list.some((c) => c.ID === code);

/**
 * Tiếp nhận / sửa yêu cầu – như web RequestFormDrawer (fn_customer_request_save): Dự án *, Hợp đồng, Khách hàng
 * (tên * / SĐT / email), Tiêu đề *, Loại, Nguồn, Hạn xử lý, Ưu tiên, Trạng thái, Người tiếp nhận / xử lý,
 * Nội dung, Ghi chú nội bộ, Hình ảnh / tài liệu. Sửa = lưu đè toàn bộ trường (máy chủ upsert) nên giữ nguyên mọi giá trị cũ.
 * Khác web (mobile): chọn khách từ danh sách khách hàng; hợp đồng chọn trong giao dịch của khách đó.
 */
export default function RequestFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; projectId?: string }>();
  const editingId = params.id ? String(params.id) : null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<RequestCatalogs | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [names, setNames] = useState<{ [k: string]: string }>({});
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [attachSheet, setAttachSheet] = useState(false);
  const pendingAttach = useRef<"camera" | "library" | "file" | null>(null);
  const saveLock = useRef(false);

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const boot = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try {
      const [projRes, cats, emps, maNv] = await Promise.all([
        ProjectService.getProjects({}).catch(() => ({ data: [] })),
        CustomerRequestService.catalogs(),
        CustomerRequestService.employees().catch(() => [] as EmployeeOption[]),
        getMaNv().catch(() => ""),
      ]);
      const plist: any[] = (projRes as any)?.data ?? [];
      setProjects(plist);
      setCatalogs(cats);
      setEmployees(emps);

      if (!editingId) {
        const pid = params.projectId && plist.some((p) => String(p.id) === params.projectId) ? String(params.projectId) : null;
        setForm({
          ...EMPTY,
          projectId: pid,
          status: has(cats.dm_trang_thai_yeu_cau, DEFAULT_NEW_STATUS) ? DEFAULT_NEW_STATUS : null,
          priority: has(cats.dm_uu_tien_yeu_cau, DEFAULT_PRIORITY) ? DEFAULT_PRIORITY : null,
          receiverId: maNv && emps.some((e) => e.value === maNv) ? maNv : null,
        });
        return;
      }

      const d = await CustomerRequestService.get(editingId);
      const [att, label] = await Promise.all([
        CustomerRequestService.resolveAttachments(d.attachments).catch(() =>
          d.attachments.map((v) => ({ stored: v, url: "", fileName: v.split("/").pop() || "Tệp", image: false })),
        ),
        CustomerRequestService.contractLabel(d.contractId),
      ]);
      const due = splitDue(d.dueDate);
      setNames({
        [`r:${d.receiverId}`]: d.receiverName,
        [`a:${d.assigneeId}`]: d.assigneeName,
        category: d.categoryName,
        source: d.sourceName,
        priority: d.priorityName,
        status: d.statusName,
        project: d.projectName,
        projectCode: d.projectCode ?? "",
      });
      setForm({
        projectId: projectValueOf(plist, d.projectCode, d.projectUuid),
        contractId: d.contractId,
        contractLabel: label || d.contractId,
        customerId: d.customerId,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        customerEmail: d.customerEmail,
        title: d.title,
        content: d.content,
        category: d.category,
        source: d.source,
        priority: d.priority,
        status: d.status,
        dueDay: due.day,
        dueTime: due.time,
        receiverId: d.receiverId,
        assigneeId: d.assigneeId,
        internalNote: d.internalNote,
        files: att.map((a) => ({ stored: a.stored, url: a.url, fileName: a.fileName })),
      });
    } catch (e: any) {
      setBootError(e?.message || "Không tải được dữ liệu");
    } finally {
      setBooting(false);
    }
  }, [editingId, params.projectId]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const projectOptions = useMemo<SelectOption<string>[]>(() => {
    const opts = projects.map((p: any) => ({ value: String(p.id), label: p.ten_da || p.TenDA || "—" }));
    return opts;
  }, [projects]);

  const employeeOptions = useCallback(
    (current: string | null, key: "r" | "a"): SelectOption<string>[] => {
      const opts: SelectOption<string>[] = [{ value: NONE, label: "Không chọn" }, ...employees];
      if (current && !employees.some((e) => e.value === current)) {
        opts.push({ value: current, label: names[`${key}:${current}`] || current });
      }
      return opts;
    },
    [employees, names],
  );

  // Yêu cầu cũ gắn dự án không còn trong danh sách → báo để chọn lại (không đoán)
  const lostProject = !!editingId && !form.projectId && !!names.projectCode;

  // ── Khách hàng & hợp đồng ───────────────────────────────────────────────────
  const onPickCustomer = (c: PickedCustomer) => {
    setCustomerOpen(false);
    const sameCustomer = c.id === form.customerId;
    patch({
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone,
      customerEmail: c.email,
      // Đổi khách → bỏ hợp đồng của khách cũ
      contractId: sameCustomer ? form.contractId : null,
      contractLabel: sameCustomer ? form.contractLabel : null,
    });
    setErrors((e) => ({ ...e, customerName: undefined }));
  };

  const clearCustomer = () =>
    patch({ customerId: null, customerName: "", customerPhone: "", customerEmail: "", contractId: null, contractLabel: null });

  // ── Tệp đính kèm ────────────────────────────────────────────────────────────
  const uploadAssets = async (files: { uri: string; name?: string; type?: string }[]) => {
    if (!files.length) return;
    setUploading(true);
    const added: FileItem[] = [];
    let failed = 0;
    for (const f of files) {
      try {
        const url = await CustomerRequestService.upload(f);
        added.push({ stored: url, url, fileName: f.name || url.split("/").pop() || "tep" });
      } catch {
        failed += 1;
      }
    }
    setForm((prev) => ({ ...prev, files: [...prev.files, ...added] }));
    setUploading(false);
    if (failed) toast.show({ type: "error", message: `${failed} tệp tải lên không thành công` });
  };

  const runAttach = async (kind: "camera" | "library" | "file") => {
    try {
      if (kind === "file") {
        const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
        if (r.canceled) return;
        await uploadAssets(
          r.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType || "application/octet-stream" })),
        );
        return;
      }
      if (kind === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.show({ type: "error", message: "Cần cấp quyền camera để chụp ảnh" });
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
          : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 10 });
      if (r.canceled) return;
      await uploadAssets(
        r.assets.map((a, i) => ({
          uri: a.uri,
          name: a.fileName || `yeu-cau-${Date.now()}-${i}.jpg`,
          type: a.mimeType || "image/jpeg",
        })),
      );
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Không thêm được tệp" });
    }
  };

  // ── Lưu ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (saveLock.current) return;
    const projectCode = projectSaveCode(projects, form.projectId) ?? (lostProject ? names.projectCode : null);
    const errs = validateRequestForm({ projectCode, customerName: form.customerName, title: form.title });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.show({ type: "error", message: "Vui lòng nhập đủ các trường bắt buộc" });
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const saved = await CustomerRequestService.save({
        id: editingId,
        projectCode,
        contractId: form.contractId,
        customerId: form.customerId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        title: form.title,
        content: form.content,
        category: form.category,
        source: form.source,
        priority: form.priority,
        status: form.status,
        dueDate: joinDue(form.dueDay, form.dueTime),
        receiverId: form.receiverId,
        assigneeId: form.assigneeId,
        internalNote: form.internalNote,
        attachments: form.files.map((f) => f.stored),
      });
      toast.show({
        type: "success",
        message: editingId ? "Đã cập nhật yêu cầu" : `Đã tiếp nhận yêu cầu ${saved.code}`.trim(),
      });
      if (editingId || !saved.id) router.back();
      else router.replace({ pathname: "/request/[id]", params: { id: saved.id } });
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Lưu yêu cầu thất bại" });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const header = (
    <AppHeader
      variant="soft"
      title={editingId ? "Sửa yêu cầu" : "Tiếp nhận yêu cầu"}
      subtitle={editingId ? form.title || undefined : "Ghi nhận yêu cầu / phản ánh của khách"}
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
  if (bootError || !catalogs) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <ErrorState description={bootError || "Không tải được dữ liệu"} onRetry={() => void boot()} />
        </Screen>
      </>
    );
  }

  const dueDate = form.dueDay ? new Date(`${form.dueDay}T00:00:00`) : null;

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
              title={editingId ? "Lưu thay đổi" : "Tiếp nhận"}
              loading={saving}
              disabled={uploading}
              onPress={() => void save()}
              style={[styles.flex, styles.pill]}
            />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          {/* ── Khách hàng ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Khách hàng
            </Text>
            {form.customerId ? (
              <View style={styles.picked}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Khách hàng ${form.customerName}, bấm để đổi`}
                  onPress={() => setCustomerOpen(true)}
                  style={({ pressed }) => [styles.flex, pressed ? styles.pressed : null]}
                >
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {form.customerName || "—"}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {[form.customerPhone, form.customerEmail].filter(Boolean).join(" · ") || "Chưa có SĐT / email"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bỏ chọn khách hàng, nhập tay"
                  hitSlop={8}
                  onPress={clearCustomer}
                  style={styles.clearBtn}
                >
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <>
                <Button
                  variant="secondary"
                  icon={UserSearch}
                  title="Chọn từ danh sách khách hàng"
                  onPress={() => setCustomerOpen(true)}
                  style={styles.pill}
                />
                <TextField
                  variant="soft"
                  label="Tên khách hàng"
                  required
                  value={form.customerName}
                  onChangeText={(t) => {
                    patch({ customerName: t });
                    if (errors.customerName) setErrors((e) => ({ ...e, customerName: undefined }));
                  }}
                  placeholder="Họ và tên"
                  error={errors.customerName}
                />
                <View style={styles.row}>
                  <TextField
                    variant="soft"
                    label="Số điện thoại"
                    value={form.customerPhone}
                    onChangeText={(t) => patch({ customerPhone: t })}
                    placeholder="09xx xxx xxx"
                    keyboardType="phone-pad"
                    containerStyle={styles.flex}
                  />
                  <TextField
                    variant="soft"
                    label="Email"
                    value={form.customerEmail}
                    onChangeText={(t) => patch({ customerEmail: t })}
                    placeholder="email@…"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    containerStyle={styles.flex}
                  />
                </View>
              </>
            )}
          </Card>

          {/* ── Dự án & hợp đồng ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Dự án & hợp đồng
            </Text>
            <SelectField
              variant="soft"
              label="Dự án"
              required
              placeholder={lostProject ? names.project || names.projectCode : "Chọn dự án"}
              value={form.projectId}
              options={projectOptions}
              error={errors.projectCode}
              onChange={(v) => {
                patch({ projectId: v });
                if (errors.projectCode) setErrors((e) => ({ ...e, projectCode: undefined }));
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn hợp đồng / phiếu của khách"
              disabled={!form.customerId && !form.contractId}
              onPress={() => setContractOpen(true)}
              style={({ pressed }) => [
                styles.picker,
                !form.customerId && !form.contractId ? styles.disabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.flex}>
                <Text variant="caption" color="textSecondary">
                  Hợp đồng / phiếu
                </Text>
                <Text
                  variant="body"
                  weight="semibold"
                  color={form.contractId ? "text" : "textTertiary"}
                  numberOfLines={1}
                >
                  {form.contractId
                    ? form.contractLabel || form.contractId
                    : form.customerId
                      ? "Chọn giao dịch của khách (không bắt buộc)"
                      : "Chọn khách hàng trong danh sách để gắn hợp đồng"}
                </Text>
              </View>
              {form.contractId ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bỏ hợp đồng"
                  hitSlop={8}
                  onPress={() => patch({ contractId: null, contractLabel: null })}
                  style={styles.clearBtn}
                >
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              ) : (
                <ChevronRight size={20} color={colors.textTertiary} />
              )}
            </Pressable>
          </Card>

          {/* ── Nội dung yêu cầu ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Nội dung yêu cầu
            </Text>
            <TextField
              variant="soft"
              label="Tiêu đề"
              required
              value={form.title}
              onChangeText={(t) => {
                patch({ title: t });
                if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
              }}
              placeholder="Mô tả ngắn vấn đề khách phản ánh"
              error={errors.title}
              maxLength={300}
            />
            <SelectField
              variant="soft"
              label="Loại / chủ đề"
              placeholder="Chọn loại"
              value={form.category}
              options={catOptions(catalogs.dm_loai_yeu_cau, form.category, names.category)}
              onChange={(v) => patch({ category: fromSelect(v) })}
            />
            <TextField
              variant="soft"
              label="Nội dung chi tiết"
              multiline
              value={form.content}
              onChangeText={(t) => patch({ content: t })}
              placeholder="Mô tả chi tiết yêu cầu / khiếu nại…"
              style={styles.textarea}
            />
          </Card>

          {/* ── Phân loại & phân công ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Phân loại & phân công
            </Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <SelectField
                  variant="soft"
                  label="Nguồn tiếp nhận"
                  placeholder="Chọn nguồn"
                  value={form.source}
                  options={catOptions(catalogs.dm_nguon_yeu_cau, form.source, names.source)}
                  onChange={(v) => patch({ source: fromSelect(v) })}
                />
              </View>
              <View style={styles.flex}>
                <SelectField
                  variant="soft"
                  label="Mức ưu tiên"
                  placeholder="Chọn mức"
                  value={form.priority}
                  options={catOptions(catalogs.dm_uu_tien_yeu_cau, form.priority, names.priority)}
                  onChange={(v) => patch({ priority: fromSelect(v) })}
                />
              </View>
            </View>
            <SelectField
              variant="soft"
              label="Trạng thái"
              placeholder="Chọn trạng thái"
              value={form.status}
              options={catOptions(catalogs.dm_trang_thai_yeu_cau, form.status, names.status)}
              onChange={(v) => patch({ status: fromSelect(v) })}
            />
            <View style={styles.row}>
              <View style={styles.dueDay}>
                <DateField
                  variant="soft"
                  label="Hạn xử lý"
                  placeholder="Không có hạn"
                  value={dueDate}
                  onChange={(d) => patch({ dueDay: toYmd(d), dueTime: form.dueTime || "17:00" })}
                />
              </View>
              <View style={styles.flex}>
                <SelectField
                  variant="soft"
                  label="Giờ"
                  placeholder="--:--"
                  value={form.dueDay ? form.dueTime : null}
                  options={TIMES}
                  // Chưa chọn ngày mà chọn giờ → hạn là hôm nay
                  onChange={(v) => patch({ dueTime: v, dueDay: form.dueDay || toYmd(new Date()) })}
                />
              </View>
            </View>
            {form.dueDay ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => patch({ dueDay: null, dueTime: null })}
                style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
              >
                <Text variant="caption" weight="semibold" color="primary">
                  Bỏ hạn xử lý ({formatDate(dueDate)})
                </Text>
              </Pressable>
            ) : null}
            <SelectField
              variant="soft"
              label="Người tiếp nhận"
              placeholder="Mặc định: bạn"
              sheetTitle="Chọn người tiếp nhận"
              value={form.receiverId}
              options={employeeOptions(form.receiverId, "r")}
              onChange={(v) => patch({ receiverId: fromSelect(v) })}
            />
            <SelectField
              variant="soft"
              label="Người xử lý"
              placeholder="Chọn nhân viên"
              sheetTitle="Chọn người xử lý"
              value={form.assigneeId}
              options={employeeOptions(form.assigneeId, "a")}
              onChange={(v) => patch({ assigneeId: fromSelect(v) })}
            />
            <TextField
              variant="soft"
              label="Ghi chú nội bộ"
              multiline
              value={form.internalNote}
              onChangeText={(t) => patch({ internalNote: t })}
              placeholder="Chỉ nhân viên thấy, khách không thấy"
              style={styles.textareaSm}
            />
          </Card>

          {/* ── Đính kèm ── */}
          <Card style={styles.card}>
            <Text variant="subhead" style={styles.cardTitle}>
              Hình ảnh / tài liệu
            </Text>
            <AttachmentList
              items={form.files.map((f) => ({ fileName: f.fileName, url: f.url }))}
              uploading={uploading}
              onAdd={() => setAttachSheet(true)}
              onRemove={(i) => patch({ files: form.files.filter((_, j) => j !== i) })}
            />
          </Card>
        </View>
      </Screen>

      <CustomerPickerSheet
        visible={customerOpen}
        title="Chọn khách hàng"
        excludeIds={[]}
        onClose={() => setCustomerOpen(false)}
        onPick={onPickCustomer}
      />

      <ContractPickerSheet
        visible={contractOpen}
        customerId={form.customerId}
        selectedId={form.contractId}
        onClose={() => setContractOpen(false)}
        onPick={(t) => {
          setContractOpen(false);
          if (!t) {
            patch({ contractId: null, contractLabel: null });
            return;
          }
          const pid = t.projectId && projects.some((p: any) => String(p.id) === t.projectId) ? t.projectId : null;
          patch({
            contractId: t.id,
            contractLabel: [t.soPhieu, t.kyHieu].filter(Boolean).join(" · ") || t.id,
            projectId: pid ?? form.projectId,
          });
          if (pid && errors.projectCode) setErrors((e) => ({ ...e, projectCode: undefined }));
        }}
      />

      <BottomSheet
        visible={attachSheet}
        onClose={() => setAttachSheet(false)}
        onClosed={() => {
          const k = pendingAttach.current;
          pendingAttach.current = null;
          if (k) void runAttach(k);
        }}
        title="Thêm hình ảnh / tài liệu"
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

type Txn = { id: string; soPhieu: string; kyHieu: string; tenDA: string; stageLabel: string; projectId: string | null };

/** Giao dịch (giữ chỗ / cọc / HĐ) của khách – cloud_pgc_phieu_giucho; giá trị lưu = uuid phiếu (như app khách hàng gửi). */
function ContractPickerSheet({
  visible,
  customerId,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean;
  customerId: string | null;
  selectedId: string | null;
  onClose: () => void;
  onPick: (t: Txn | null) => void;
}) {
  const [list, setList] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !customerId) {
      if (!customerId) setList([]);
      return;
    }
    let alive = true;
    setLoading(true);
    CustomerService.getCustomerTransactions(customerId)
      .then((rows: any[]) => alive && setList(rows as Txn[]))
      .catch(() => alive && setList([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, customerId]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Hợp đồng / phiếu của khách">
      <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          onPress={() => onPick(null)}
          style={({ pressed }) => [styles.sheetRow, !selectedId ? styles.sheetRowActive : null, pressed ? styles.pressed : null]}
        >
          <Text variant="body" weight="semibold">
            Không gắn hợp đồng
          </Text>
          <Text variant="caption" color="textSecondary">
            Yêu cầu chung, không gắn căn
          </Text>
        </Pressable>
        {list.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityState={{ selected: t.id === selectedId }}
            onPress={() => onPick(t)}
            style={({ pressed }) => [
              styles.sheetRow,
              t.id === selectedId ? styles.sheetRowActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text variant="body" weight="semibold" numberOfLines={1}>
              {[t.soPhieu || "—", t.kyHieu].filter(Boolean).join(" · ")}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {[t.stageLabel, t.tenDA].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        ))}
        {loading ? (
          <ActivityIndicator style={styles.sheetStatus} color={colors.primary} />
        ) : !list.length ? (
          <Text variant="caption" color="textSecondary" align="center" style={styles.sheetStatus}>
            {customerId ? "Khách chưa có giao dịch." : "Chọn khách hàng trong danh sách để xem giao dịch."}
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  card: {
    borderWidth: 0,
    borderRadius: radius.xxl,
    paddingHorizontal: space.lg + 2,
    gap: space.md,
    ...elevation.soft,
  },
  cardTitle: { marginBottom: -space.xs },
  row: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  dueDay: { flex: 1.4, flexDirection: "row" },
  pill: { borderRadius: radius.full },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
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
  picked: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySubtle,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  link: { alignSelf: "flex-start", paddingVertical: space.xs },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  textareaSm: { minHeight: 72, textAlignVertical: "top" },
  sheetList: { maxHeight: 440 },
  sheetRow: { paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.lg, gap: 2 },
  sheetRowActive: { backgroundColor: colors.primarySubtle },
  sheetStatus: { paddingVertical: space.xl },
});
