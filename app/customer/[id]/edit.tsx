import React, { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader, ErrorState, Screen, SkeletonDetail } from "@/components/ui";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { CustomerFormValues } from "@/lib/customerRules";
import { CustomerRulesService } from "@/sevicesSupabase/CustomerRulesService";
import { CustomerService } from "@/sevicesSupabase/CustomerService";

/** Chi tiết khách (bản ghi cloud_customers đã chuẩn hoá) → giá trị form. */
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
  };
}

export default function CustomerEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ loading: boolean; detail: any; locked: boolean }>({
    loading: true,
    detail: null,
    locked: false,
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const detail = id ? await CustomerService.getCustomerDetailCloud(String(id)) : null;
      const locked = detail?.id ? await CustomerRulesService.hasIdentityLock(String(detail.id)) : false;
      if (alive) setState({ loading: false, detail, locked });
    })();
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const header = <AppHeader title="Sửa khách hàng" />;

  if (state.loading || !state.detail) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          {state.loading ? (
            <SkeletonDetail />
          ) : (
            <ErrorState description="Không tìm thấy khách hàng." onRetry={() => setReload((n) => n + 1)} />
          )}
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
