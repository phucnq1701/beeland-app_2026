/**
 * SHIM VIẾT TAY — thay web src/services/NhanVienService (service cũ). Form phiếu tính giá web chỉ dùng getList cho danh mục
 * "Nhân viên KD" (usePriceSheetCatalogs) — ô app không hiện (MaNVKD lấy theo phiếu đã lưu) ⇒ danh sách rỗng đúng dạng web.
 */
export const NhanVienService: any = {
  getList: async () => ({ status: 2000, data: [], totalRow: 0 }),
};
export default NhanVienService;
