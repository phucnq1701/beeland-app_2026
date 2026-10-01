import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  BottomActionBar,
  Button,
  Screen,
  SectionHeader,
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
} from "@/lib/customerRules";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { space } from "@/theme";
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

  const locked = (f: CustomerFormField) => readonly.has(f) || (identityLocked && (f === "name" || f === "cccd"));
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

  const save = async () => {
    const payload: any = {
      ...(mode === "edit" ? { id: customerId } : {}),
      isPersonal: values.isPersonal,
      tenKh: values.name.trim(),
      tenCongTy: values.isPersonal ? null : values.name.trim(),
      diDong: values.phone.trim(),
      diDong2: values.phone2.trim() || null,
      email: values.email.trim() || null,
      cccd: values.cccd.trim() || null,
      diaChi: values.diaChi.trim() || null,
      // Tạo mới: cá nhân không nhập MST (như màn cũ); sửa: giữ MST TNCN đang có
      taxCode: mode === "create" && values.isPersonal ? null : values.taxCode.trim() || null,
      maTtId: values.statusId || null,
      maNguonId: values.sourceId || null,
      ...(values.isPersonal
        ? {}
        : {
            nguoiDaiDienPl: values.nguoiDaiDienPl.trim() || null,
            chucVu: values.chucVu.trim() || null,
            nddDienThoai: values.nddDienThoai.trim() || null,
            nddEmail: values.nddEmail.trim() || null,
            nddSoCccd: values.nddSoCccd.trim() || null,
          }),
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
      return;
    }
    hapticError();
    if (res?.needLogin && onNeedLogin) {
      onNeedLogin(res.message || "Chưa đăng nhập hoặc phiên đã hết hạn");
      return;
    }
    toast.show({ type: "error", message: res?.message || "Không thể lưu khách hàng, vui lòng thử lại" });
  };

  const handleSubmit = async () => {
    if (savingRef.current) return;
    const e = baseErrors(values);
    const req = checkRequired(rules?.required ?? [], rules?.hidden ?? new Set(), values, {});
    const all: Errors = { ...req.fieldErrors, ...e };
    setErrors(all);
    if (Object.keys(all).length) {
      hapticError();
      return;
    }
    if (!req.ok) {
      hapticError();
      toast.show({ type: "error", message: req.message });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await CustomerRulesService.checkDuplicate(values, mode === "edit" ? customerId : null);
      if (result.matches.length && result.mode !== "allow") {
        hapticError();
        setDup(result);
        setDupOpen(true);
        return;
      }
      await save();
    } catch (err) {
      console.log("Customer save error:", err);
      hapticError();
      toast.show({ type: "error", message: "Đã xảy ra sự cố khi lưu dữ liệu" });
    } finally {
      savingRef.current = false;
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
        helper={identityLocked && (f === "name" || f === "cccd") ? IDENTITY_LOCK_HINT : extra.helper}
        {...extra}
      />
    ) : null;

  const select = (f: "statusId" | "sourceId", label: string, options: Option[]) => {
    if (!shown(f)) return null;
    if (locked(f)) {
      const current = options.find((o) => o.value === values[f])?.label ?? "—";
      return <TextField label={label} value={current} editable={false} />;
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
      />
    );
  };

  const p = values.isPersonal;

  return (
    <Screen
      header={header}
      keyboardAware
      footer={
        <BottomActionBar>
          <Button title={submitLabel} size="lg" loading={saving} onPress={() => void handleSubmit()} style={styles.flex} />
        </BottomActionBar>
      }
    >
      <View style={styles.form}>
        <SegmentedControl
          value={p ? "personal" : "business"}
          options={[
            { value: "personal", label: "Cá nhân" },
            { value: "business", label: "Doanh nghiệp" },
          ]}
          onChange={(v) => {
            setValues((s) => ({ ...s, isPersonal: v === "personal" }));
            setErrors({});
          }}
        />

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

        <SectionHeader title="Phân loại" />
        {select("statusId", "Trạng thái", statusOptions)}
        {select("sourceId", "Nguồn khách", sourceOptions)}

        {!p ? (
          <>
            <SectionHeader title="Người đại diện pháp luật" />
            {field("nguoiDaiDienPl", "Họ và tên")}
            {field("chucVu", "Chức vụ")}
            {field("nddDienThoai", "Số điện thoại", { keyboardType: "phone-pad" })}
            {field("nddEmail", "Email", { keyboardType: "email-address", autoCapitalize: "none" })}
            {field("nddSoCccd", "Số CCCD", { keyboardType: "number-pad" })}
          </>
        ) : null}

        {mode === "create"
          ? field("notes", "Nhu cầu / ghi chú ban đầu", {
              multiline: true,
              placeholder: "Khách quan tâm căn 2PN, ngân sách 3 tỷ…",
            })
          : null}
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
  form: { gap: space.md },
  flex: { flex: 1 },
});
