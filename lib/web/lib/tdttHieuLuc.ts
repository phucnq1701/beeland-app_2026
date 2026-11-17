// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/tdttHieuLuc.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Hiệu lực của mẫu Tiến độ thanh toán (da_payment_schedules.tu_ngay / den_ngay, manual 110).
 * Từ ngày trống = không giới hạn đầu (mẫu cũ), Đến ngày trống = vô hạn. Hợp đồng / Phiếu tính giá chỉ cho chọn
 * tiến độ còn hiệu lực tại Ngày giao dịch / Ngày tính của form (trống ⇒ hôm nay).
 */
import dayjs from "dayjs";

/** Date / dayjs / 'YYYY-MM-DD' / ISO ⇒ 'YYYY-MM-DD' theo giờ máy; trống / sai ⇒ null */
export const toIsoDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  const d = dayjs(v as string | Date);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
};

export const todayIsoDate = (): string => dayjs().format("YYYY-MM-DD");

export type HieuLucRow = { tu_ngay?: unknown; den_ngay?: unknown };

/** Tiến độ còn hiệu lực tại `ngay` (trống ⇒ hôm nay); máy chủ cũ không trả khóa ngày ⇒ coi như không giới hạn */
export const scheduleInEffect = (row: HieuLucRow | null | undefined, ngay?: unknown): boolean => {
  const at = toIsoDate(ngay) ?? todayIsoDate();
  const tu = toIsoDate(row?.tu_ngay);
  const den = toIsoDate(row?.den_ngay);
  return (!tu || tu <= at) && (!den || at <= den);
};

const vn = (iso: string | null) => (iso ? dayjs(iso).format("DD/MM/YYYY") : "");

/** Nhãn cột "Hiệu lực": "01/11/2026 – 31/12/2026" | "Từ 01/11/2026" | "Đến 31/12/2026" | "" (không giới hạn) */
export const hieuLucLabel = (tuNgay: unknown, denNgay: unknown): string => {
  const tu = toIsoDate(tuNgay);
  const den = toIsoDate(denNgay);
  if (tu && den) return `${vn(tu)} – ${vn(den)}`;
  if (tu) return `Từ ${vn(tu)}`;
  if (den) return `Đến ${vn(den)}`;
  return "";
};
