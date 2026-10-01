import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  BottomActionBar,
  Button,
  Screen,
  SegmentedControl,
  SelectField,
  TextField,
  useToast,
} from "@/components/ui";
import {
  CustomerFormField,
  CustomerFormValues,
  EMPTY_CUSTOMER_FORM,
  appFieldOf,
  checkRequired,
  customerSavePayload,
} from "@/lib/customerRules";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { colors, elevation, radius, space } from "@/theme";
import {
  CustomerRulesService,
  DuplicateMatch,
  DuplicateResult,
  FormRules,
  IDENTITY_LOCK_HINT,
} from "@/sevicesSupabase/CustomerRulesService";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

import { DuplicateSheet } from "./DuplicateSheet";

type Option = { value: string; label: string };
type Errors = Partial<Record<CustomerFormField, string>>;

const PHONE_RE = /^[0-9+.\-\s]{8,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Form tạo / sửa khách hàng dùng chung. Khi lưu, theo thứ tự như web (CustomerFormModal.handleSubmit):
 *  1. kiểm tra cơ bản của app (tên, SĐT, email, MST doanh nghiệp – như màn cũ)
 *  2. bắt buộc nhập theo cấu hình công ty (RequiredFieldService)
 *  3. kiểm tra trùng khách (CustomerDuplicateService) → allow lưu / request gửi yêu cầu / block chặn
 * Trường bị ẩn / chỉ đọc theo nhóm quyền (FieldVisibilityService); khách có lịch ký thì khoá Họ tên + CCCD.
 */
export function CustomerForm({
  header,
  mode,
  customerId,
  initial,
  identityLocked = false,
  submitLabel,
  useExistingLabel,
  onSaved,
  onUseExisting,
  onNeedLogin,
}: {
  /** AppHeader của màn – form tự dựng Screen để nút lưu nằm ngoài vùng cuộn. */
  header: React.ReactNode;
  mode: "create" | "edit";
  customerId?: string;
  initial?: Partial<CustomerFormValues>;
  identityLocked?: boolean;
  submitLabel: string;
  useExistingLabel: string;
  onSaved: (row: any) => void;
  onUseExisting: (match: DuplicateMatch) => void;
  onNeedLogin?: (message: string) => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<CustomerFormValues>({ ...EMPTY_CUSTOMER_FORM, ...initial });
  const [errors, setErrors] = useState<Errors>({});
  const [statusOptions, setStatusOptions] = useState<Option[]>([]);
  const [sourceOptions, setSourceOptions] = useState<Option[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [rules, setRules] = useState<FormRules | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [dup, setDup] = useState<DuplicateResult | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const taxByType = useRef<{ personal?: string; business?: string }>({});

  // Danh mục trạng thái / nguồn khách; tạo mới thì chọn sẵn mục đầu (như màn cũ)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [statuses, sources] = await Promise.all([
          CustomerService.getTrangThaiCatalogs(),
          CustomerService.getNguonCatalogs(),
        ]);
        if (!alive) return;
        const toOpt = (x: any): Option => ({ value: String(x.value || x.id), label: String(x.label ?? "") });
        const st = (statuses || []).map(toOpt);
        const src = (sources || []).map(toOpt);
        setStatusOptions(st);
        setSourceOptions(src);
        if (mode === "create") {
          setValues((v) => ({
            ...v,
            statusId: v.statusId || st[0]?.value || "",
            sourceId: v.sourceId || src[0]?.value || "",
          }));
        }
      } catch (e) {
        console.log("Error loading customer catalogs:", e);
      } finally {
        if (alive) setLoadingCatalogs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  // Cấu hình bắt buộc / ẩn / chỉ đọc theo loại khách
  useEffect(() => {
    let alive = true;
    setRules(null);
    CustomerRulesService.getFormRules(values.isPersonal).then((r) => {
      if (alive) setRules(r);
    });
    return () => {
      alive = false;
    };
  }, [values.isPersonal]);

  /** Trường app tương ứng các key cấu hình (ẩn / chỉ đọc / bắt buộc). */
  const toFields = (keys: Iterable<string>) => {
    const out = new Set<CustomerFormField>();
    for (const k of keys) {
      const f = appFieldOf(values.isPersonal, k);
      if (f) out.add(f);
    }
    return out;
  };
  const hidden = useMemo(() => toFields(rules?.hidden ?? []), [rules, values.isPersonal]); // eslint-disable-line react-hooks/exhaustive-deps
  const readonly = useMemo(() => toFields(rules?.readonly ?? []), [rules, values.isPersonal]); // eslint-disable-line react-hooks/exhaustive-deps
  const configRequired = useMemo(
    () => toFields((rules?.required ?? []).filter((k) => !rules?.hidden.has(k))),
    [rules, values.isPersonal] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Web khoá TenKH, SoCMND (cá nhân) và TenCongTy, MaSoThueCT (doanh nghiệp) khi khách có lịch ký. */
  const identityField = (f: CustomerFormField) =>
    f === "name" || (values.isPersonal ? f === "cccd" : f === "taxCode");
  const locked = (f: CustomerFormField) => readonly.has(f) || (identityLocked && identityField(f));
  const shown = (f: CustomerFormField) => !hidden.has(f);

  const set = (field: CustomerFormField) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const baseErrors = (v: CustomerFormValues): Errors => {
    const e: Errors = {};
    if (shown("name") && !v.name.trim()) e.name = v.isPersonal ? "Vui lòng nhập họ và tên" : "Vui lòng nhập tên công ty";
    if (shown("phone")) {
      if (!v.phone.trim()) e.phone = "Vui lòng nhập số điện thoại";
      else if (!PHONE_RE.test(v.phone.trim())) e.phone = "Số điện thoại không hợp lệ";
    }
    if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = "Email không đúng định dạng";
    if (!v.isPersonal && shown("taxCode") && !v.taxCode.trim()) e.taxCode = "Vui lòng nhập mã số thuế công ty";
    return e;
  };

  const save = async (): Promise<boolean> => {
    const payload: any = {
      ...(mode === "edit" ? { id: customerId } : {}),
      ...customerSavePayload(values, mode),
    };
    const res: any = await CustomerService.saveCustomerCloud(payload);
    if (res?.status === 2000 && res.data) {
      if (mode === "create" && values.notes.trim() && res.data.id) {
        try {
          await CustomerService.addCustomerActivity({
            customerId: res.data.id,
            content: values.notes.trim(),
            title: "Ghi chú ban đầu khi tạo khách",
            loai: "note",
          });
        } catch {}
      }
      hapticSuccess();
      toast.show({ type: "success", message: mode === "create" ? "Đã thêm khách hàng" : "Đã cập nhật khách hàng" });
      onSaved(res.data);
      return true;
    }
    hapticError();
    if (res?.needLogin && onNeedLogin) {
      onNeedLogin(res.message || "Chưa đăng nhập hoặc phiên đã hết hạn");
      return false;
    }
    toast.show({ type: "error", message: res?.message || "Không thể lưu khách hàng, vui lòng thử lại" });
    return false;
  };

  const handleSubmit = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    // Như web (RequiredFieldService.preload trước khi kiểm): cấu hình chưa tải xong thì chờ tải
    const r: FormRules =
      rules ??
      (await CustomerRulesService.getFormRules(values.isPersonal).catch(
        // Không đọc được cấu hình → không ràng buộc thêm (như web)
        (): FormRules => ({ formKey: "", required: [], hidden: new Set(), readonly: new Set() })
      ));
    const e = baseErrors(values);
    const req = checkRequired(r.required, r.hidden, values, {});
    const all: Errors = { ...req.fieldErrors, ...e };
    setErrors(all);
    if (Object.keys(all).length || !req.ok) {
      savingRef.current = false;
      hapticError();
      if (!Object.keys(all).length) toast.show({ type: "error", message: req.message });
      return;
    }

    setSaving(true);
    let saved = false;
    try {
      const result = await CustomerRulesService.checkDuplicate(values, mode === "edit" ? customerId : null);
      if (result.matches.length && result.mode !== "allow") {
        hapticError();
        setDup(result);
        setDupOpen(true);
        return;
      }
      saved = await save();
    } catch (err) {
      console.log("Customer save error:", err);
      hapticError();
      toast.show({ type: "error", message: "Đã xảy ra sự cố khi lưu dữ liệu" });
    } finally {
      // Đã lưu xong thì giữ khoá (màn đang chuyển đi) – bấm thêm lần nữa không tạo khách thứ hai
      if (!saved) savingRef.current = false;
      setSaving(false);
    }
  };

  const field = (f: CustomerFormField, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) =>
    shown(f) ? (
      <TextField
        label={label}
        value={values[f]}
        onChangeText={set(f)}
        error={errors[f]}
        required={configRequired.has(f) || extra.required}
        editable={!locked(f)}
        helper={identityLocked && identityField(f) ? IDENTITY_LOCK_HINT : extra.helper}
        variant="soft"
        {...extra}
      />
    ) : null;

  const select = (f: "statusId" | "sourceId", label: string, options: Option[]) => {
    if (!shown(f)) return null;
    if (locked(f)) {
      const current = options.find((o) => o.value === values[f])?.label ?? "—";
      return <TextField label={label} value={current} editable={false} variant="soft" />;
    }
    return (
      <SelectField
        label={label}
        value={values[f] || null}
        options={options}
        onChange={(v) => set(f)(String(v))}
        loading={loadingCatalogs}
        required={configRequired.has(f)}
        error={errors[f]}
        sheetTitle={label}
        variant="soft"
      />
    );
  };

  const p = values.isPersonal;

  return (
    <Screen
      header={header}
      keyboardAware
      padded={false}
      footer={
        <BottomActionBar>
          <Button
            title={submitLabel}
            size="lg"
            loading={saving}
            onPress={() => void handleSubmit()}
            style={[styles.flex, styles.pill]}
          />
        </BottomActionBar>
      }
    >
      <View style={styles.form}>
        <SegmentedControl
          variant="soft"
          value={p ? "personal" : "business"}
          options={[
            { value: "personal", label: "Cá nhân" },
            { value: "business", label: "Doanh nghiệp" },
          ]}
          onChange={(v) => {
            const toPersonal = v === "personal";
            if (toPersonal === values.isPersonal) return;
            // MST TNCN (cá nhân) và MST doanh nghiệp là 2 cột khác nhau – giữ riêng từng loại khi đổi qua lại
            taxByType.current[values.isPersonal ? "personal" : "business"] = values.taxCode;
            setValues((s) => ({
              ...s,
              isPersonal: toPersonal,
              taxCode: taxByType.current[toPersonal ? "personal" : "business"] ?? "",
            }));
            setErrors({});
          }}
        />

        <HomeSectionHeader title="Thông tin chung" />
        <View style={styles.card}>
          {field("name", p ? "Họ và tên" : "Tên doanh nghiệp / công ty", {
            required: true,
            placeholder: p ? "Nguyễn Văn A" : "Công ty TNHH…",
            autoCapitalize: "words",
          })}
          {field("phone", "Số điện thoại", { required: true, keyboardType: "phone-pad", placeholder: "0912345678" })}
          {field("phone2", "Số điện thoại phụ", { keyboardType: "phone-pad" })}
          {field("email", "Email", { keyboardType: "email-address", autoCapitalize: "none" })}
          {p
            ? field("cccd", "Số CCCD / CMND", { keyboardType: "number-pad" })
            : field("taxCode", "Mã số thuế", { required: true, keyboardType: "number-pad" })}
          {field("diaChi", p ? "Địa chỉ liên hệ" : "Địa chỉ trụ sở", { placeholder: "Số nhà, đường, phường, quận…" })}
        </View>

        {shown("statusId") || shown("sourceId") ? (
          <>
            <HomeSectionHeader title="Phân loại" />
            <View style={styles.card}>
              {select("statusId", "Trạng thái", statusOptions)}
              {select("sourceId", "Nguồn khách", sourceOptions)}
            </View>
          </>
        ) : null}

        {!p ? (
          <>
            <HomeSectionHeader title="Người đại diện pháp luật" />
            <View style={styles.card}>
              {field("nguoiDaiDienPl", "Họ và tên")}
              {field("chucVu", "Chức vụ")}
              {field("nddDienThoai", "Số điện thoại", { keyboardType: "phone-pad" })}
              {field("nddEmail", "Email", { keyboardType: "email-address", autoCapitalize: "none" })}
              {field("nddSoCccd", "Số CCCD", { keyboardType: "number-pad" })}
            </View>
          </>
        ) : null}

        {mode === "create" && shown("notes") ? (
          <>
            <HomeSectionHeader title="Ghi chú" />
            <View style={styles.card}>
              {field("notes", "Nhu cầu / ghi chú ban đầu", {
                multiline: true,
                placeholder: "Khách quan tâm căn 2PN, ngân sách 3 tỷ…",
              })}
            </View>
          </>
        ) : null}
      </View>

      <DuplicateSheet
        visible={dupOpen}
        result={dup}
        values={values}
        useExistingLabel={useExistingLabel}
        onClose={() => setDupOpen(false)}
        onUseExisting={(m) => {
          setDupOpen(false);
          onUseExisting(m);
        }}
        onRequested={() => {
          setDupOpen(false);
          onSaved(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.sm },
  card: {
    gap: space.md + 2,
    padding: space.lg + 2,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  flex: { flex: 1 },
  pill: { borderRadius: radius.full },
});
