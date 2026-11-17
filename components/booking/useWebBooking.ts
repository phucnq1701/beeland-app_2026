import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui";
import { useWebBookingForm } from "@/lib/web/components/Products/BookingFormDialog.hook";
import { getBdsProductById } from "@/lib/web/services/BdsProductService";
import { primeWebSession } from "@/lib/web/_shims/lib/session";
import { installWebRuntime } from "@/lib/web/_shims/runtime";
import { onWebBookingCreated } from "@/lib/web/_shims/services/Product";
import { onWebToast } from "@/lib/web/_shims/sonner";

/**
 * Form booking trên app = ĐÚNG logic form web (lib/web: thân BookingFormDialog chép nguyên văn thành useWebBookingForm). Lớp này chỉ
 * làm phần "màn mở form" của web:
 *  - Căn: đọc lại bản đầy đủ theo uuid (getBdsProductById — như lưới / sơ đồ web truyền dòng căn đầy đủ), giữ LockId khi đi từ phiếu
 *    lock (như màn Lock căn web: máy chủ kiểm lock còn hiệu lực rồi khép lock).
 *  - Lưu: handleSubmit web (addBookingAPI ⇒ fn_nv_app_booking_tao); `created` = phiếu vừa tạo để app vào thẳng chi tiết thu tiền.
 * Toast của module web ⇒ toast app.
 */
export function useWebBooking({ bookingData }: { bookingData: any }) {
  const toast = useToast();
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ BookingId?: string; MaPGC?: string; SoPhieu?: string } | null>(null);
  const createdRef = useRef<typeof created>(null);

  useEffect(
    () =>
      onWebToast((t) => {
        if (t.message) toast.show({ type: t.type === "success" ? "success" : t.type === "info" ? "info" : "error", message: t.message });
      }),
    [toast]
  );
  useEffect(() => onWebBookingCreated((c) => (createdRef.current = c)), []);

  const productId = String(bookingData?.ID ?? bookingData?.id ?? bookingData?.Id ?? bookingData?.SanPhamId ?? "");
  const lockId = bookingData?.LockId ?? null;
  useEffect(() => {
    let alive = true;
    (async () => {
      installWebRuntime();
      await primeWebSession();
      if (!productId) throw new Error("Không tìm thấy sản phẩm");
      const p = await getBdsProductById(productId);
      if (!p) throw new Error("Không tìm thấy sản phẩm");
      if (!alive) return;
      // Như lưới web truyền dòng căn đầy đủ: bản đọc lại là chính, trường nó không có (tổng giá HĐ…) lấy từ dòng căn màn trước gửi sang
      const fresh = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null));
      const merged = { ...(bookingData || {}), ...fresh };
      setProduct(lockId ? { ...merged, LockId: lockId, FromLock: true } : merged);
      setOpen(true);
    })().catch((e: any) => {
      if (alive) setError(e?.message || "Không tải được dữ liệu sản phẩm");
    });
    return () => {
      alive = false;
    };
    // bookingData chỉ là dữ liệu phụ lúc mở form (cùng căn) — không mở lại form khi màn trước đổi tham chiếu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, lockId]);

  const form = useWebBookingForm({
    open,
    onOpenChange: (v: boolean) => setOpen(v),
    product,
    onSuccess: () => setCreated(createdRef.current ?? {}),
  });

  return { ready: open && !!product && !!form, error, form, created };
}
