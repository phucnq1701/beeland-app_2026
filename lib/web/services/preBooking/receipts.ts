// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/receipts.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Booking thiện chí — tiền thu theo PHIẾU THU (không còn tin cột `tien_thu` / `is_da_thu`).
 * Tổng và danh sách do máy chủ tính theo tenant + phạm vi dữ liệu của người gọi.
 */
import { supabase } from "../../_shims/integrations/supabase/client";
import { uid } from "./context";

export interface PreBookingReceipt {
  id: string;
  soPhieu: string;
  ngayPhieu: string | null;
  loaiCode: string;
  loaiTen: string;
  soTien: number;
  bookingId: string;
  soPhieuBooking: string | null;
  extraPaymentId: string | null;
}

export const PreBookingReceiptService = {
  /** Tổng tiền đã thu theo phiếu thu: `{ [bookingUid]: tổng }`. Lỗi ⇒ ném. */
  getPaidTotals: async (bookingUids: string[]): Promise<Record<string, number>> => {
    const ids = Array.from(
      new Set((bookingUids || []).map((v) => uid(v)).filter(Boolean) as string[])
    );
    if (!ids.length) return {};
    const { data, error } = await supabase.rpc(
      "fn_pre_booking_paid_totals" as any,
      { p_booking_ids: ids } as any
    );
    if (error) throw new Error(error.message || "Không tải được tổng tiền đã thu");
    const out: Record<string, number> = {};
    if (data && typeof data === "object")
      Object.entries(data as Record<string, any>).forEach(([k, v]) => (out[k] = Number(v) || 0));
    return out;
  },

  /** Các phiếu thu của một booking (ngoài phạm vi ⇒ []). */
  listReceipts: async (bookingUid: string): Promise<PreBookingReceipt[]> => {
    const id = uid(bookingUid);
    if (!id) return [];
    const { data, error } = await supabase.rpc(
      "fn_pre_booking_receipt_list" as any,
      { p_booking_id: id } as any
    );
    if (error) throw new Error(error.message || "Không tải được danh sách phiếu thu");
    return ((data as any[]) || []).map((r) => ({
      id: r.id,
      soPhieu: r.so_phieu,
      ngayPhieu: r.ngay_phieu ?? null,
      loaiCode: r.loai_code,
      loaiTen: r.loai_ten,
      soTien: Number(r.so_tien) || 0,
      bookingId: r.booking_id,
      soPhieuBooking: r.so_phieu_booking ?? null,
      extraPaymentId: r.extra_payment_id ?? null,
    }));
  },
};

export default PreBookingReceiptService;
