// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/products/bds-product-row/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Map payload (tên field cũ của form / file import) sang cột bảng `bds_products` — tách khỏi BdsProductService.ts
 * (quy tắc tệp < 1500 dòng). Dùng cho import (fn_bds_product_import nhận tên cột).
 */
import { parseHinhThucKd } from "./hinhThucKd";

export * from "./hinhThucKd";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown) => UUID_RE.test(String(v ?? "").trim());

/** Số hoặc null (bỏ chuỗi rỗng, chuỗi có phân cách nghìn) */
export const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
/** Chỉ nhận uuid (các cột danh mục đều là FK uuid) */
export const uid = (v: unknown) => (isUuid(v) ? String(v).trim() : null);
export const txt = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t ? t : null;
};

/** Map payload của form (tên field cũ) sang cột bảng bds_products */
export const toBdsProductRow = (p: Record<string, unknown> | null | undefined, kind?: string) => ({
  ma_sp: txt(p?.MaSP ?? p?.maSP),
  ky_hieu: txt(p?.KyHieu ?? p?.MaSP),
  form_code: txt(kind ?? p?.FormCode) ?? "CAOTANG",
  so_can_ho: txt(p?.SoCanHo),

  ma_khu: uid(p?.MaKhu),
  ma_pk: uid(p?.MaPK),
  ma_tang: uid(p?.MaTang),
  ma_lch: uid(p?.MaLCH),
  ma_lhbds: uid(p?.MaLHBDS),
  ma_so_pn: uid(p?.MaSoPN),
  huong_cua: uid(p?.HuongCua),
  huong_bc: uid(p?.HuongBC),
  view_id: uid(p?.ViewID),
  vi_tri: uid(p?.ViTri),
  ma_tt: uid(p?.MaTT),
  ma_mau_nha: uid(p?.MaMauNha),
  ma_loai_dn: uid(p?.MaLoaiDN),
  mau_nha: txt(p?.MauNha),
  ho_boi: txt(p?.HoBoi),
  ma_cau_hinh_tinh_gia: uid(p?.MaCauHinhTinhGia ?? p?.IDCauHinh),

  dien_tich: num(p?.DienTich ?? p?.DienTichThongThuy ?? p?.DienTichDat),
  dien_tich_thong_thuy: num(p?.DienTichThongThuy),
  dt_tim_tuong: num(p?.DTTimTuong ?? p?.DTTimDuong),
  dien_tich_kv: num(p?.DienTichKV),
  dien_tich_dat: num(p?.DienTichDat),
  dien_tich_xd: num(p?.DienTichXD),
  tong_dt_xd: num(p?.TongDTXD),
  so_tang: num(p?.SoTang),
  so_o: num(p?.SoO),
  so_pn: num(p?.SoPN),
  ghi_chu: txt(p?.GhiChu),
  toa_do: txt(p?.ToaDo),
  hinh_anh: txt(p?.HinhAnh),

  dg_gom_vat: num(p?.DGGomVAT),
  gia_vao_hd: num(p?.GiaVaoHD),
  don_gia: num(p?.DonGia),
  don_gia_chua_vat: num(p?.DonGiaChuaVAT),
  tong_gia: num(p?.TongGia),
  tong_gia_chua_vat: num(p?.TongGiaChuaVAT),
  vat: num(p?.VAT),
  tien_vat: num(p?.TienVAT),
  tong_gia_gom_vat: num(p?.TongGiaGomVAT),
  pbt: num(p?.PBT),
  tien_pbt: num(p?.TienPBT),
  tong_gia_gom_pbt: num(p?.TongGiaGomPBT),
  tien_dat: num(p?.TienDat),
  don_gia_da_vat: num(p?.DonGiaDaVAT),
  tong_gia_da_vat: num(p?.TongGiaDaVAT),
  tong_thanh_toan: num(p?.TongThanhToan),
  ty_le_vat: num(p?.TyLeVAT),
  ty_le_phi_bao_tri: num(p?.TyLePhiBaoTri),
  tien_phi_bao_tri: num(p?.TienPhiBaoTri),
  tong_gom_pbt: num(p?.TongGomPBT),
  dg_dat_pb: num(p?.DGDatPB),
  tong_tien_sdd: num(p?.TongTienSDD),
  don_gia_xay_dung: num(p?.DonGiaXayDung),
  thanh_tien_xd: num(p?.ThanhTienXD),
  don_gia_dat: num(p?.DonGiaDat),
  tong_gia_dat: num(p?.TongGiaDat),
  tong_gia_tri_hdmb: num(p?.TongGiaTriHDMB),
  gia_dat_chua_vat: num(p?.GiaDatChuaVAT ?? p?.GiaDatKoVAT),
  vat_dat: num(p?.VATDat),
  tien_sd_dat: num(p?.TienSDDat),
  ty_le_vat_xay_dung: num(p?.TyLeVATXayDung),
  tien_vat_xay_dung: num(p?.TienVATXayDung),
  thanh_tien_vat_xay_dung: num(p?.ThanhTienVATXayDung),
  // Chỉ gửi khi payload có khóa: import không có cột Giá Naked thì máy chủ giữ giá cũ
  ...(p?.GiaNaked !== undefined ? { gia_naked: num(p.GiaNaked) } : {}),
  // Cùng quy tắc: không có khóa thì máy chủ giữ giá trị đang có
  ...(p?.MaKhuQH !== undefined ? { ma_khu_qh: uid(p.MaKhuQH) } : {}),
  ...(p?.MaTieuChuanBG !== undefined ? { ma_tieu_chuan_bg: uid(p.MaTieuChuanBG) } : {}),
  // Loại hình Bán / Cho thuê (cột bds_products.hinh_thuc_kd): chỉ gửi giá trị hợp lệ — trống / không có cột ⇒ máy chủ
  // giữ giá trị cũ (sản phẩm mới: mặc định Bán); giá trị lạ bị chặn ở bước kiểm dòng import
  ...(parseHinhThucKd(p?.HinhThucKD) ? { hinh_thuc_kd: parseHinhThucKd(p?.HinhThucKD) } : {}),
});
