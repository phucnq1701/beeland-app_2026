// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/paymentScheduleOptions.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { displayName } from "../../Sales/salesConfig/approvedConfig";
import { sameId } from "../../Sales/salesConfig/unitFundPriceList";
import { scheduleInEffect } from "../../../lib/tdttHieuLuc";
import { pickOptions } from "../../../lib/expiryPick";

export type PaymentScheduleOption = { value: string; label: string };

export const PAYMENT_SCHEDULE_PICK_HINT = "Chọn lịch thanh toán ở bước Sản phẩm & Chính sách";

/** Tên lịch đang chọn trong options (so mã không phân biệt hoa thường); không thấy ⇒ undefined */
export const paymentScheduleLabel = (options: PaymentScheduleOption[], value: string | null | undefined): string | undefined =>
  value ? options.find((o) => String(o.value).toLowerCase() === String(value).toLowerCase())?.label : undefined;

/** Máy chủ chưa trả ma_quy_can (API cũ, FE lên trước): không dòng nào có khóa ⇒ không lọc theo quỹ căn */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unitFundUnknown = (rows: any[]): boolean => rows.length > 0 && rows.every((r) => r?.ma_quy_can === undefined);

/**
 * Lịch thanh toán của quỹ căn đang chọn ở form chứng từ (manual 108, như bảng giá): lịch chưa gắn quỹ căn không hiện.
 * Không lọc khi chưa có quỹ căn hoặc máy chủ chưa trả ma_quy_can. Lịch đang chọn luôn giữ (phiếu đã lưu / vừa đổi quỹ căn).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schedulesOfUnitFund = <T extends Record<string, any>>(
  schedules: T[],
  quyCanId?: string | null,
  selectedId?: string | null,
): T[] => {
  const rows = schedules || [];
  if (!quyCanId || unitFundUnknown(rows)) return rows;
  return rows.filter((r) => sameId(r?.ma_quy_can, quyCanId) || sameId(r?.MaTH, selectedId));
};

/** Lịch đang chọn thuộc quỹ căn khác / chưa gắn quỹ căn (biết chắc từ máy chủ) ⇒ nhắc chọn lại */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scheduleOutOfUnitFund = (schedules: any[], quyCanId?: string | null, selectedId?: string | null): boolean => {
  if (!quyCanId || !selectedId) return false;
  const row = (schedules || []).find((r) => sameId(r?.MaTH, selectedId));
  if (!row || row.ma_quy_can === undefined) return false;
  return !sameId(row.ma_quy_can, quyCanId);
};

export const OUT_OF_EFFECT_SUFFIX = " (ngoài hiệu lực)";

export const OUT_OF_EFFECT_WARNING = "Tiến độ thanh toán của chính sách không còn hiệu lực tại ngày này, vui lòng chọn lịch thanh toán khác";

/**
 * Lịch `id` có trong danh sách và ngoài hiệu lực tại `ngay` (manual 110) — dùng chặn tự chọn lịch theo chính sách.
 * Lịch có ngoại lệ đã duyệt (`allowIds`, id chữ thường) ⇒ không chặn.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scheduleOutOfEffect = (schedules: any[], id: unknown, ngay: unknown, allowIds?: Set<string>): boolean => {
  const row = (schedules || []).find((r) => sameId(r?.MaTH, id));
  return !!row && !scheduleInEffect(row, ngay) && !allowIds?.has(String(id ?? "").trim().toLowerCase());
};

/**
 * Danh sách lịch của form (`lichThanhToan`, dạng `mapScheduleRow`) → options: value = MaTH (uuid, cùng nguồn với điều kiện LICH_TT).
 * Có quyCanId ⇒ chỉ lịch của quỹ căn đó (giữ lịch đang chọn).
 * Có `hieuLuc` ⇒ chỉ lịch còn hiệu lực tại `hieuLuc.ngay` (Ngày giao dịch / Ngày tính; trống ⇒ hôm nay, manual 110);
 * lịch đang chọn đã ngoài hiệu lực vẫn giữ (phiếu đã lưu) và gắn nhãn " (ngoài hiệu lực)".
 * `allowIds` (id chữ thường, yêu cầu ngoại lệ đã duyệt của giao dịch): lịch ngoài hiệu lực vẫn hiện, nhãn " (ngoại lệ)".
 */
export const paymentScheduleOptions = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schedules: any[],
  quyCanId?: string | null,
  selectedId?: string | null,
  hieuLuc?: { ngay: unknown },
  allowIds?: Set<string>,
): PaymentScheduleOption[] =>
  pickOptions(schedulesOfUnitFund(schedules || [], quyCanId, selectedId), {
    getId: (t) => t.MaTH,
    getLabel: (t) => displayName(t, "TenTH"),
    inEffect: (t) => !hieuLuc || scheduleInEffect(t, hieuLuc.ngay),
    selectedId,
    allowIds,
    expiredSuffix: OUT_OF_EFFECT_SUFFIX,
  });
