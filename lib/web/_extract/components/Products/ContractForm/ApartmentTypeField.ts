// ⚠️ TỰ SINH — trích nguyên văn từ web src/components/Products/ContractForm/ApartmentTypeField.tsx (scripts/sync-web-pricing.cjs): apartmentTypeName. KHÔNG SỬA TAY.
/** Tên loại căn hộ của sản phẩm: danh sách sản phẩm cloud trả `TenLoaiCanHo`, nguồn cũ dùng `TenLoaiMau` */
export const apartmentTypeName = (product: unknown): string => {
  const p = (product ?? {}) as Record<string, unknown>;
  const v = p.TenLoaiCanHo ?? p.TenLoaiMau ?? p.ten_loai_can_ho ?? p.LoaiCanHo;
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
};
