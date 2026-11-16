// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/tdttLoaiTienDo.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Loại tiến độ của 1 đợt trong mẫu Tiến độ thanh toán (da_payment_schedules.details[i].LoaiTienDo, manual 110).
 * Khóa cố định HDMB | HDCN; null = chưa cấu hình (đợt cũ để trống, người dùng tự gắn sau).
 * Đợt mới lấy mặc định theo quỹ căn của mẫu: Quỹ CĐT ⇒ HĐMB, Chuyển nhượng ⇒ HĐCN. Máy chủ chặn giá trị khác.
 */
export type LoaiTienDoKey = "HDMB" | "HDCN";

export const LOAI_TIEN_DO_OPTIONS: { value: LoaiTienDoKey; label: string }[] = [
  { value: "HDMB", label: "HĐMB" },
  { value: "HDCN", label: "HĐCN" },
];

/** "HDMB" / "HĐMB" / " hđcn " … ⇒ khóa; giá trị lạ / trống ⇒ null (dùng cả khi import Excel) */
export const loaiTienDoKey = (v: unknown): LoaiTienDoKey | null => {
  if (typeof v !== "string") return null;
  const k = v.trim().toUpperCase().replace(/Đ/g, "D");
  return k === "HDMB" || k === "HDCN" ? k : null;
};

export const loaiTienDoLabel = (v: unknown): string =>
  LOAI_TIEN_DO_OPTIONS.find((o) => o.value === loaiTienDoKey(v))?.label ?? "";

/** Mã quỹ căn (dm_quy_can.ma) ⇒ loại tiến độ mặc định của đợt mới; quỹ căn khác / chưa chọn ⇒ null */
export const defaultLoaiTienDo = (maQuyCan: string | null | undefined): LoaiTienDoKey | null => {
  const ma = String(maQuyCan ?? "").trim().toUpperCase();
  if (ma === "QUY_CDT") return "HDMB";
  if (ma === "CHUYEN_NHUONG") return "HDCN";
  return null;
};

/**
 * Đổi quỹ căn của mẫu: đợt còn đúng mặc định của quỹ cũ ⇒ sang mặc định của quỹ mới;
 * đợt đã sửa tay hoặc chưa cấu hình (trống) giữ nguyên.
 */
export const switchLoaiTienDo = <T extends Record<string, unknown>>(
  rows: T[],
  oldDefault: LoaiTienDoKey | null,
  newDefault: LoaiTienDoKey | null,
): T[] =>
  !oldDefault || oldDefault === newDefault
    ? rows
    : rows.map((r) => (loaiTienDoKey(r?.LoaiTienDo) === oldDefault ? { ...r, LoaiTienDo: newDefault } : r));
