/**
 * Sàn giao dịch của tài khoản đại lý (không import — test nạp được).
 *
 * Web chuẩn: `src/lib/agencySan.ts` (getAgencySan / enforceAgencySan) + `BookingFormDialog` (ô Sàn khoá khi là đại lý):
 *  - Nguồn chuẩn: claim `branch_id` trong token = `dm_employees.company_id` (đại lý tài khoản được gán).
 *  - Đại lý luôn ghi theo sàn của chính mình, bỏ qua giá trị gửi từ giao diện.
 * Máy chủ `fn_booking_create` KHÔNG tự ép sàn (khác `fn_signing_appointment_upsert`) ⇒ app phải ép trước khi gửi.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SanOption = { ID?: any; MaSan?: any; TenSan?: any };

/** Sàn của tài khoản: chỉ AGENCY, lấy `branch_id` (uuid). Không phải đại lý / thiếu ⇒ null. */
export function agencySanId(typeAccount: unknown, branchId: unknown): string | null {
  if (String(typeAccount ?? "").trim().toUpperCase() !== "AGENCY") return null;
  const id = String(branchId ?? "").trim();
  return UUID_RE.test(id) ? id : null;
}

/**
 * Sàn ghi vào booking. Nội bộ: sàn người dùng chọn (null = không qua sàn).
 * Đại lý: luôn sàn của tài khoản (tên lấy từ danh sách sàn nếu có); không xác định được sàn ⇒ chặn tạo
 * (không bao giờ gửi sàn khác hay "không qua sàn" thay cho đại lý).
 */
export function bookingSan(opts: {
  isAgency: boolean;
  agencySan: string | null;
  selected: SanOption | null;
  sanList: SanOption[];
}): { ok: true; san: SanOption | null } | { ok: false; message: string } {
  if (!opts.isAgency) return { ok: true, san: opts.selected ?? null };
  if (!opts.agencySan) {
    return {
      ok: false,
      message: "Không xác định được sàn của tài khoản đại lý. Vui lòng đăng nhập lại hoặc liên hệ quản trị.",
    };
  }
  const hit = (opts.sanList || []).find((s) => String(s?.ID ?? "") === opts.agencySan);
  return {
    ok: true,
    san: { ID: opts.agencySan, MaSan: opts.agencySan, TenSan: hit?.TenSan || "Sàn của tài khoản" },
  };
}
