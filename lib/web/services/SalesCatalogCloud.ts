// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SalesCatalogCloud.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * SalesCatalogCloud — danh mục nghiệp vụ bán hàng đọc Cloud trước.
 *
 * Lưu chung trong bảng public.cloud_catalogs theo (ma_ctdk, catalog_type, item_code).
 * Mỗi hàm trả về đúng shape `{ status, data }` như `BanHangService.DanhMuc.*`
 * nên các form hiện tại không phải đổi luồng xử lý.
 */
import { safe, table, tenant } from "./CloudMirror";

type SalesCatalogType =
  | "httt"
  | "phuong_an_tt"
  | "ly_do_hoan"
  | "phan_loai_kh"
  | "khoang_gia"
  | "dien_tich";

const CODE_KEYS = ["ID", "Id", "MaHTTT", "MaPATT", "MaLyDo", "MaPhanLoai", "Ma", "Value"];
const NAME_KEYS = ["Ten", "TenHTTT", "TenPATT", "TenLyDo", "TenPhanLoai", "Name", "Label"];

const pick = (r: any, keys: string[]) => {
  for (const k of keys) {
    if (r?.[k] != null && r?.[k] !== "") return r[k];
    const lower = k.charAt(0).toLowerCase() + k.slice(1);
    if (r?.[lower] != null && r?.[lower] !== "") return r[lower];
  }
  return null;
};

const readCloud = async (type: SalesCatalogType): Promise<any[]> => {
  const ma_ctdk = tenant();
  if (!ma_ctdk) return [];
  const res = await safe(async () => {
    const { data, error } = await table("cloud_catalogs")
      .select("*")
      .eq("ma_ctdk", ma_ctdk)
      .eq("catalog_type", type)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => r.raw || {});
  });
  return res || [];
};

const okRows = async (type: SalesCatalogType) => ({
  status: 2000,
  data: await readCloud(type),
});

export const SalesCatalogCloud = {
  getHTTT: () => okRows("httt"),
  getPhuongAnTT: () => okRows("phuong_an_tt"),
  getLyDoHoan: () => okRows("ly_do_hoan"),
  getPhanLoaiKH: () => okRows("phan_loai_kh"),
  getKhoangGia: () => okRows("khoang_gia"),
  getDienTich: () => okRows("dien_tich"),
};

export default SalesCatalogCloud;
