import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader, confirm } from "@/components/ui";
import { CustomerForm } from "@/components/customer/CustomerForm";

/**
 * Thêm khách hàng. Mở từ màn tạo booking (returnToBooking=1): lưu xong / chọn khách trùng thì quay về
 * ĐÚNG màn tạo booking đang mở và chọn sẵn khách (param newCustomer – booking/create chuẩn hoá).
 */
export default function CustomerNewScreen() {
  const router = useRouter();
  const { dataBooking, returnToBooking } = useLocalSearchParams();
  const isReturningToBooking = String(returnToBooking) === "1";
  const bookingParam = typeof dataBooking === "string" ? dataBooking : "";

  const backToBooking = (customer: any) =>
    router.dismissTo({
      pathname: "/booking/create",
      params: { dataBooking: bookingParam, newCustomer: JSON.stringify(customer) },
    });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CustomerForm
        header={<AppHeader title="Thêm khách hàng" />}
        mode="create"
        submitLabel={isReturningToBooking ? "Tạo khách & chọn cho booking" : "Tạo khách hàng"}
        useExistingLabel={isReturningToBooking ? "Chọn khách này cho booking" : "Xem hồ sơ khách này"}
        onSaved={(row) => {
          // row = null khi vừa gửi yêu cầu trùng (chưa có khách mới)
          if (row && isReturningToBooking) backToBooking(row);
          else router.back();
        }}
        onUseExisting={(m) => {
          if (isReturningToBooking) {
            backToBooking({ id: m.customerId, ten_kh: m.customerName, dien_thoai: m.phone, cccd: m.cccd });
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
