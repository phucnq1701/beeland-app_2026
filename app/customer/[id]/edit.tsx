import React, { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Lock } from "lucide-react-native";

import { AppHeader, EmptyState, ErrorState, Screen, SkeletonDetail } from "@/components/ui";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { CustomerFormValues } from "@/lib/customerRules";
import { CUSTOMER_TX_LOCK_MESSAGE, CustomerRulesService } from "@/services/CustomerRulesService";
import { CustomerService } from "@/services/CustomerService";

/** Chi tiết khách (fn_customer_get, đã chuẩn hoá) → giá trị form. */
function toFormValues(d: any): Partial<CustomerFormValues> {
  const isPersonal = d.is_personal !== false;
  return {
    isPersonal,
    name: (isPersonal ? d.ten_kh : d.ten_cong_ty) || d.tenKH || "",
    phone: d.diDong || d.dien_thoai || "",
    phone2: d.di_dong2 || "",
    email: d.email || d.email_ct || "",
    cccd: d.cccd || d.so_cmnd || "",
    taxCode: d.ma_so_thue_ct || d.ma_so_ttncn || "",
    diaChi: d.diaChi || d.dia_chi || d.thuong_tru || d.dia_chi_ct || "",
    statusId: d.ma_tt_id || "",
    sourceId: d.ma_nguon_id || "",
    nguoiDaiDienPl: d.nguoi_dai_dien_pl || "",
    chucVu: d.chuc_vu || "",
    nddDienThoai: d.ndd_dien_thoai || "",
    nddEmail: d.ndd_email || "",
    nddSoCccd: d.ndd_so_cccd || "",
    notes: d.ghi_chu || "",
  };
}

export default function CustomerEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ loading: boolean; detail: any; locked: boolean; txLocked: boolean; error: string | null }>({
    loading: true,
    detail: null,
    locked: false,
    txLocked: false,
    error: null,
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const found = id ? await CustomerService.getCustomerDetailCloud(String(id)) : null;
        // Bản giới hạn (khách công ty khác chỉ thấy qua chứng từ): máy chủ không cho sửa ⇒ không mở form
        const detail = found && found.limited !== true ? found : null;
        // Khoá định danh (lịch ký cá nhân) + khoá theo giao dịch đã duyệt (web hasCustomerTxLock ⇒ form chỉ xem)
        const [locked, txLocked] = detail?.id
          ? await Promise.all([
              CustomerRulesService.hasIdentityLock(String(detail.id)),
              CustomerRulesService.hasTxLock(String(detail.id)),
            ])
          : [false, false];
        const error = found?.limited === true ? "Khách thuộc công ty khác – không có quyền sửa." : null;
        if (alive) setState({ loading: false, detail, locked, txLocked, error });
      } catch (err) {
        // Lỗi máy chủ (không quyền xem, phiên hết hạn…) hiện nguyên thông báo
        const error = err instanceof Error && err.message ? err.message : "Không tải được khách hàng.";
        if (alive) setState({ loading: false, detail: null, locked: false, txLocked: false, error });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const header = <AppHeader variant="soft" title="Sửa khách hàng" />;

  if (state.loading || !state.detail) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          {state.loading ? (
            <SkeletonDetail />
          ) : (
            <ErrorState description={state.error || "Không tìm thấy khách hàng."} onRetry={() => setReload((n) => n + 1)} />
          )}
        </Screen>
      </>
    );
  }

  if (state.txLocked) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          <EmptyState
            icon={Lock}
            title="Không sửa được khách hàng"
            description={CUSTOMER_TX_LOCK_MESSAGE}
            actionLabel="Quay lại"
            onAction={() => router.back()}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CustomerForm
        header={header}
        mode="edit"
        customerId={String(state.detail.id)}
        initial={toFormValues(state.detail)}
        identityLocked={state.locked}
        submitLabel="Lưu thay đổi"
        useExistingLabel="Xem hồ sơ khách này"
        onSaved={() => router.back()}
        onUseExisting={(m) => router.replace(`/customer/${m.customerId}` as any)}
      />
    </>
  );
}
