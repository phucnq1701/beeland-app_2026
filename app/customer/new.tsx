import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader, confirm } from "@/components/ui";
import { CustomerForm } from "@/components/customer/CustomerForm";

/**
 * Thêm khách hàng. Mở từ màn tạo booking (returnToBooking=1): lưu xong / chọn khách trùng thì quay về
 * ĐÚNG màn tạo booking đang mở và chọn sẵn khách (param newCustomer – booking/create chuẩn hoá).
 * Mở từ form lịch ký (returnToSigning=1, newCustomerFor = main | owner, signingParams = params gốc của form):
 * quay về form lịch ký đang mở và chọn khách làm khách chính / thêm làm người đồng sở hữu.
 */
export default function CustomerNewScreen() {
  const router = useRouter();
  const { dataBooking, returnToBooking, returnToSigning, newCustomerFor, signingParams, personal } = useLocalSearchParams();
  const isReturningToBooking = String(returnToBooking) === "1";
  const isReturningToSigning = String(returnToSigning) === "1";
  const returning = isReturningToBooking || isReturningToSigning;
  const bookingParam = typeof dataBooking === "string" ? dataBooking : "";

  const backWith = (customer: any) => {
    if (isReturningToSigning) {
      let base: Record<string, string> = {};
      try {
        const p = JSON.parse(String(signingParams || "{}"));
        base = Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]));
      } catch {
        base = {};
      }
      router.dismissTo({
        pathname: "/signing/form",
        params: { ...base, newCustomer: JSON.stringify(customer), newCustomerFor: String(newCustomerFor || "main") },
      });
      return;
    }
    router.dismissTo({
      pathname: "/booking/create",
      params: { dataBooking: bookingParam, newCustomer: JSON.stringify(customer) },
    });
  };

  const target = isReturningToSigning
    ? String(newCustomerFor) === "owner"
      ? "làm người đồng sở hữu"
      : "cho lịch ký"
    : "cho booking";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CustomerForm
        header={<AppHeader variant="soft" title="Thêm khách hàng" />}
        mode="create"
        initial={personal === "0" ? { isPersonal: false } : undefined}
        submitLabel={returning ? `Tạo khách & chọn ${target}` : "Tạo khách hàng"}
        useExistingLabel={returning ? `Chọn khách này ${target}` : "Xem hồ sơ khách này"}
        onSaved={(row) => {
          // row = null khi vừa gửi yêu cầu trùng (chưa có khách mới)
          if (row && returning) backWith(row);
          else router.back();
        }}
        onUseExisting={(m) => {
          if (returning) {
            backWith({
              id: m.customerId,
              ten_kh: m.customerName,
              is_personal: m.isPersonal,
              dien_thoai: m.phone,
              email: m.email,
              cccd: m.cccd,
            });
          } else {
            router.replace(`/customer/${m.customerId}` as any);
          }
        }}
        onNeedLogin={async (message) => {
          const ok = await confirm({ title: "Phiên đăng nhập đã hết hạn", message, confirmText: "Đăng nhập lại", cancelText: "Để sau" });
          if (ok) router.replace("/login" as any);
        }}
      />
    </>
  );
}
