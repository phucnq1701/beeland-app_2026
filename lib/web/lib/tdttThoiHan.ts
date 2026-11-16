// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/tdttThoiHan.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Thời hạn 1 đợt của mẫu Tiến độ thanh toán (da_payment_schedules.details[i]) theo Ngày / Tháng.
 * Khoá jsonb: LoaiThoiGian ("NGAY" | "THANG", thiếu = NGAY — dữ liệu cũ), SoNgay (ngày), SoThang (tháng).
 * Đổi loại không xoá số của loại kia. DB đọc cùng quy ước qua _ps_dot_thoi_han (đợt gắn mốc).
 */
export type LoaiThoiGian = "NGAY" | "THANG";

export const LOAI_THOI_GIAN_OPTIONS: { value: LoaiThoiGian; label: string }[] = [
  { value: "NGAY", label: "Ngày" },
  { value: "THANG", label: "Tháng" },
];

type DotThoiHan = { LoaiThoiGian?: unknown; SoNgay?: unknown; SoThang?: unknown } | null | undefined;

export const loaiThoiGian = (d: DotThoiHan): LoaiThoiGian => (d?.LoaiThoiGian === "THANG" ? "THANG" : "NGAY");

/** Khoá chứa số của ô "Thời hạn" theo loại thời gian */
export const thoiHanKey = (d: DotThoiHan): "SoNgay" | "SoThang" =>
  loaiThoiGian(d) === "THANG" ? "SoThang" : "SoNgay";

/** Thời hạn để tính Ngày TT: soNgay = số ngày hoặc số tháng (theoThang) */
export const templateDuration = (d: DotThoiHan): { soNgay: number; theoThang: boolean } => ({
  soNgay: Number(d?.[thoiHanKey(d)]) || 0,
  theoThang: loaiThoiGian(d) === "THANG",
});

/** "5 ngày" / "2 tháng"; chưa nhập → "—" */
export const formatThoiHan = (d: DotThoiHan): string => {
  const v = d?.[thoiHanKey(d)];
  if (v == null || v === "") return "—";
  return `${Number(v) || 0} ${loaiThoiGian(d) === "THANG" ? "tháng" : "ngày"}`;
};

/** Ô "Ngày/Tháng" của file import: "Tháng" / "THANG" / 2 → THANG, còn lại NGAY */
export const parseLoaiThoiGian = (v: unknown): LoaiThoiGian => {
  const s = String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
  return s === "THANG" || s === "2" ? "THANG" : "NGAY";
};

/** Dòng import → khoá thời hạn: số ở cột "Thời hạn" (r.SoNgay) vào SoNgay hoặc SoThang theo loại */
export const importThoiHan = (r: { SoNgay?: unknown; LoaiThoiGian?: unknown }) => {
  const loai = parseLoaiThoiGian(r?.LoaiThoiGian);
  const n = Number(r?.SoNgay) || 0;
  return loai === "THANG"
    ? { LoaiThoiGian: loai, SoNgay: null, SoThang: n }
    : { LoaiThoiGian: loai, SoNgay: n, SoThang: null };
};
