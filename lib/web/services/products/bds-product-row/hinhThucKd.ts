// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/products/bds-product-row/hinhThucKd.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Loại hình kinh doanh của sản phẩm — cột `bds_products.hinh_thuc_kd` (BAN | CHO_THUE, mặc định BAN).
 * Dùng ở form / import sản phẩm và điều kiện thư mục biểu mẫu "Loại hình" (DS thủ tục, quyết định TT30).
 * Không đặt tên "LoaiHinh": khóa đó đã là CAOTANG / THAPTANG ở Chính sách bán hàng.
 */
export type HinhThucKd = "BAN" | "CHO_THUE";

export const HINH_THUC_KD_OPTIONS: ReadonlyArray<{ value: HinhThucKd; label: string }> = [
  { value: "BAN", label: "Bán" },
  { value: "CHO_THUE", label: "Cho thuê" },
];

export const hinhThucKdLabel = (v: unknown): string =>
  HINH_THUC_KD_OPTIONS.find((o) => o.value === String(v ?? "").trim().toUpperCase())?.label ?? "";

const fold = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** "Bán" / "ban" / "BAN" ⇒ BAN; "Cho thuê" / "cho_thue" / "Thuê" ⇒ CHO_THUE; trống / lạ ⇒ null */
export const parseHinhThucKd = (v: unknown): HinhThucKd | null => {
  const f = fold(v);
  if (!f) return null;
  if (f === "ban") return "BAN";
  if (f === "chothue" || f === "thue") return "CHO_THUE";
  return null;
};
