// ⚠️ TỰ SINH — bản chép nguyên văn web src/utils/vnDate.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Biên ngày cho bộ lọc "Từ ngày – Đến ngày" theo GIỜ VIỆT NAM (UTC+7),
 * không phụ thuộc múi giờ máy người dùng.
 * - vnDayStart(d) → YYYY-MM-DDT00:00:00.000+07:00
 * - vnDayEnd(d)   → YYYY-MM-DDT23:59:59.999+07:00
 * - vnDate(d)     → YYYY-MM-DD (cột kiểu date)
 */
const VN_OFFSET_MS = 7 * 3600 * 1000;

const toDate = (v: any): Date | null => {
  if (v == null || v === "") return null;
  if (typeof v?.toDate === "function") v = v.toDate(); // dayjs / moment
  else if (typeof v?.toJSDate === "function") v = v.toJSDate(); // luxon
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00+07:00`);
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/** Ngày lịch Việt Nam của một thời điểm */
export const vnDate = (v: any): string | null => {
  const d = toDate(v);
  if (!d) return null;
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
};

export const vnDayStart = (v: any): string | null => {
  const s = vnDate(v);
  return s ? `${s}T00:00:00.000+07:00` : null;
};

export const vnDayEnd = (v: any): string | null => {
  const s = vnDate(v);
  return s ? `${s}T23:59:59.999+07:00` : null;
};
