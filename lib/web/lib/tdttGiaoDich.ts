// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/tdttGiaoDich.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Giao dịch gắn với 1 đợt của mẫu Tiến độ thanh toán (da_payment_schedules.details[i].GiaoDich).
 * Chỉ xử lý ở client (DB lưu nguyên jsonb). Thiếu / giá trị lạ = chưa chọn (null).
 */
export type GiaoDichKey = "BAN_GIAO" | "SO_DO";

export const GIAO_DICH_OPTIONS: { value: GiaoDichKey; label: string }[] = [
  { value: "BAN_GIAO", label: "Bàn giao" },
  { value: "SO_DO", label: "Sổ đỏ" },
];

export const giaoDichKey = (v: unknown): GiaoDichKey | null =>
  GIAO_DICH_OPTIONS.some((o) => o.value === v) ? (v as GiaoDichKey) : null;

export const giaoDichLabel = (v: unknown): string =>
  GIAO_DICH_OPTIONS.find((o) => o.value === v)?.label ?? "";

/** Màu thẻ theo token trạng thái của dự án: Bàn giao = cam (--status-handover), Sổ đỏ = đỏ (--danger) */
export const GIAO_DICH_COLOR: Record<GiaoDichKey, string> = {
  BAN_GIAO: "hsl(var(--status-handover))",
  SO_DO: "hsl(var(--danger))",
};

/** DotTT → giao dịch, lấy từ các đợt của mẫu tiến độ (lịch đã lưu ở phiếu không giữ khoá này) */
export const giaoDichByDot = (
  details: ReadonlyArray<{ DotTT?: unknown; GiaoDich?: unknown }> | null | undefined,
): Map<number, GiaoDichKey> => {
  const out = new Map<number, GiaoDichKey>();
  (details || []).forEach((d) => {
    const dot = Number(d?.DotTT);
    const key = giaoDichKey(d?.GiaoDich);
    if (dot && key && !out.has(dot)) out.set(dot, key);
  });
  return out;
};
