// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CustomerIdentityLockService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * CustomerIdentityLockService — khoá sửa Họ tên / Số CMND-CCCD của khách hàng
 * khi khách hàng đó đã là **khách hàng chính** của một phiếu Đặt lịch ký cá nhân.
 *
 * Quy tắc nghiệp vụ:
 *  - Chỉ cần tồn tại 1 lịch ký cá nhân (`cloud_signing_appointments.is_personal = true`)
 *    trỏ tới khách hàng (`khach_hang_id`) thì hai trường định danh bị khoá.
 *  - Lịch ký bị xoá (xoá cứng) → khoá tự mở.
 *  - Kiểm trên toàn công ty đăng ký (`fn_customer_has_personal_signing`), không giới hạn theo trần công ty của người xem.
 *
 * Dùng chung cho MỌI nơi mở form khách hàng (CustomerFormModal).
 */
import { supabase } from "../_shims/integrations/supabase/client";

const cache = new Map<string, { at: number; locked: boolean }>();
const TTL = 30_000;

/** Khách hàng này đã phát sinh lịch ký cá nhân (là khách hàng chính) chưa? */
export async function hasPersonalSigningAppointment(
  maKH: any
): Promise<boolean> {
  const id = maKH == null ? "" : String(maKH).trim();
  if (!id) return false;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.locked;
  try {
    // Đếm trên TOÀN tenant ở máy chủ (lịch ký của công ty khác vẫn khoá) — RLS trần công ty làm phép đếm qua PostgREST
    // bỏ sót lịch ngoài phạm vi. Máy chủ chỉ trả đúng/sai, không trả nội dung lịch.
    const { data, error } = await (supabase as any).rpc("fn_customer_has_personal_signing", {
      p_customer_id: id,
    });
    if (error) return false;
    const locked = data === true;
    cache.set(id, { at: Date.now(), locked });
    return locked;
  } catch {
    return false;
  }
}

/** Xoá cache khi lịch ký được tạo/xoá để khoá cập nhật ngay */
export function clearCustomerIdentityLockCache(maKH?: any) {
  if (maKH == null) cache.clear();
  else cache.delete(String(maKH).trim());
}

/**
 * Khoá sửa theo giao dịch (KG1–KG3): khách hàng chính hoặc người đồng sở hữu của giao dịch đang ở ĐÚNG trạng thái
 * 13 "Đặt cọc đã duyệt" / 14 "HĐMB đã duyệt" ⇒ form Sửa khách hàng chỉ xem. Máy chủ (`_ds5_customer_save`) cũng từ chối lưu.
 * Không cache: trạng thái giao dịch đổi thì lần mở form sau thấy ngay. Lỗi mạng ⇒ coi như không khoá (máy chủ vẫn chặn).
 */
export async function hasCustomerTxLock(maKH: any): Promise<boolean> {
  const id = maKH == null ? "" : String(maKH).trim();
  if (!id) return false;
  try {
    const { data, error } = await (supabase as any).rpc("fn_customer_tx_lock", { p_customer_id: id });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export const CUSTOMER_TX_LOCK_MESSAGE =
  "Khách hàng có giao dịch đang ở trạng thái Đặt cọc đã duyệt / HĐMB đã duyệt — không sửa được thông tin. Muốn thay đổi: lập phụ lục thay đổi thông tin khách hàng.";

export const CUSTOMER_IDENTITY_LOCK_HINT =
  "Khách hàng đã có lịch ký — không sửa được Họ tên và Số CMND/CCCD (trừ khi xoá lịch ký)";
