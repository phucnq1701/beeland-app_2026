// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/BdsProductService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * SẢN PHẨM BĐS — nguồn dữ liệu chuẩn hoá theo UUID: bảng `public.bds_products`.
 *
 * - `ma_ctdk` : uuid công ty đăng ký (cloud_companies.id) — lấy TỪ TOKEN đăng nhập
 * - `ma_da`   : uuid dự án (da_projects.id)
 * - Các trường danh mục (khu, phân khu, tầng, loại căn hộ, số PN, hướng, view,
 *   vị trí, trạng thái, loại hình BĐS) đều là uuid trỏ tới `cloud_catalogs.id`.
 *
 * Service trả dữ liệu về ĐÚNG hình dạng cũ (MaSP/KyHieu/TenKhu/TenTT…) để lưới
 * Cao tầng / Thấp tầng và form Thêm–Sửa không phải đổi cấu trúc.
 *
 * Danh mục cho form chỉ được nạp KHI MỞ DRAWER (`listCatalogsForForm`), không gọi
 * ở lúc render lưới.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { applyDataScope } from "./DataScopeService";
import { sessionCompanyId } from "../_shims/lib/session";
import { getDaProjectRaw } from "./DaProjectCatalog";
import { memoAsync } from "../lib/apiCache";
import { parseHinhThucKd, toBdsProductRow, txt } from "./products/bds-product-row";
import { statusColorOf } from "./system/status-catalog";

/**
 * TTL đệm danh mục cho form Thêm/Sửa sản phẩm: dài hơn TTL mặc định để các lần
 * mở lại form cùng dự án/khu tái sử dụng kết quả. Luôn được dọn khi danh mục
 * được ghi (các service danh mục gọi `clearApiCache("catalog:")`).
 */
const FORM_CATALOG_TTL = 5 * 60_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: any) => UUID_RE.test(String(v ?? "").trim());
const clean = (v: any) => {
  const s = String(v ?? "").trim();
  return !s || s === "-1" || s.toLowerCase() === "all" ? "" : s;
};

/** uuid dự án theo mã cũ (MaDA) hoặc uuid */
export const resolveProjectId = async (maDA: any): Promise<string> => {
  const v = clean(maDA);
  if (!v) return "";
  if (isUuid(v)) return v;
  try {
    const row: any = await getDaProjectRaw(v);
    return row?.id ? String(row.id) : "";
  } catch {
    return "";
  }
};

/** Chọn tên/uuid của 1 danh mục đã join.
 *  Lưới (fn_bds_product_list) trả danh mục dạng CHUỖI tên (không kèm id);
 *  chi tiết (fn_get_product_by_id) trả object đầy đủ. Hỗ trợ cả hai. */
const cat = (c: any) => {
  if (c == null) return { id: null, code: null, name: null };
  if (typeof c === "string") return { id: null, code: null, name: c };
  return {
    id: c?.id ?? null,
    code: c?.item_code ?? null,
    name: c?.item_name ?? null,
  };
};

const SELECT = `
  *,
  da:ma_da(id, ten_da),
  khu:ma_khu(id, item_code, item_name),
  pk:ma_pk(id, item_code, item_name),
  tang:ma_tang(id, item_code, item_name),
  lch:ma_lch(id, item_code, item_name),
  lhbds:ma_lhbds(id, item_code, item_name),
  pn:ma_so_pn(id, item_code, item_name),
  hcua:huong_cua(id, item_code, item_name),
  hbc:huong_bc(id, item_code, item_name),
  vw:view_id(id, item_code, item_name),
  vt:vi_tri(id, item_code, item_name),
  tt:ma_tt(id, item_code, item_name, color_code)
`;

/** Chuyển 1 dòng bds_products về hình dạng cũ mà UI đang dùng */
export const mapBdsProduct = (r: any) => {
  const khu = cat(r?.khu);
  const pk = cat(r?.pk);
  const tang = cat(r?.tang);
  const lch = cat(r?.lch);
  const lhbds = cat(r?.lhbds);
  const pn = cat(r?.pn);
  const hcua = cat(r?.hcua);
  const hbc = cat(r?.hbc);
  const vw = cat(r?.vw);
  const vt = cat(r?.vt);
  const tt = cat(r?.tt);
  const da = r?.da;
  const tenDA = typeof da === "string" ? da : da?.ten_da ?? "";

  return {
    // khoá
    id: r.id,
    MaSP: r.ma_sp ?? r.id,
    KyHieu: r.ky_hieu,
    FormCode: r.form_code,

    // dự án + danh mục (uuid + tên)
    MaDA: r.ma_da,
    TenDA: tenDA,
    MaKhu: khu.id,
    TenKhu: khu.name,
    Khu: khu.name,
    MaPK: pk.id,
    TenPK: pk.name,
    MaTang: tang.id,
    TenTang: tang.name,
    Tang: tang.name,
    MaLCH: lch.id,
    TenLoaiCanHo: lch.name,
    TenLoaiMau: lch.name,
    MaLHBDS: lhbds.id,
    TenLBDS: lhbds.name,
    MaSoPN: pn.id,
    TenLoaiPN: pn.name,
    SoPN: r.so_pn ?? pn.name,
    HuongCua: hcua.id,
    TenHuongCua: hcua.name,
    HuongBC: hbc.id,
    TenHuongBC: hbc.name,
    ViewID: vw.id,
    TenView: vw.name,
    TenVeiw: vw.name,
    ViTri: vt.id,
    TenViTri: vt.name,
    TenVT: vt.name,
    MaTT: tt.id ?? r?.ma_tt ?? null,
    TenTT: tt.name,
    MauTT: statusColorOf(r?.tt?.id, r?.tt?.color_code ?? null),
    MaCauHinhTinhGia: r.ma_cau_hinh_tinh_gia,
    MaMauNha: r.ma_mau_nha,
    MaLoaiDN: r.ma_loai_dn,
    MauNha: r.mau_nha,
    HoBoi: r.ho_boi,
    // Khu quy hoạch / Tiêu chuẩn bàn giao: lưới trả tên dạng chuỗi (khu_qh, tieu_chuan_bg), chi tiết trả object
    MaKhuQH: cat(r?.khu_qh).id ?? r?.ma_khu_qh ?? null,
    TenKhuQH: cat(r?.khu_qh).name,
    MaTieuChuanBG: cat(r?.tieu_chuan_bg).id ?? r?.ma_tieu_chuan_bg ?? null,
    TenTieuChuanBG: cat(r?.tieu_chuan_bg).name,
    // Loại hình Bán / Cho thuê (bds_products.hinh_thuc_kd — máy chủ chưa có cột ⇒ null, form hiện mặc định Bán)
    HinhThucKD: r?.hinh_thuc_kd ? String(r.hinh_thuc_kd).toUpperCase() : null,

    // thông tin căn
    SoCanHo: r.so_can_ho,
    DienTich: r.dien_tich,
    DienTichThongThuy: r.dien_tich_thong_thuy,
    DTTimDuong: r.dt_tim_tuong,
    DTTimTuong: r.dt_tim_tuong,
    DienTichKV: r.dien_tich_kv,
    DienTichDat: r.dien_tich_dat,
    DienTichXD: r.dien_tich_xd,
    TongDTXD: r.tong_dt_xd,
    SoTang: r.so_tang,
    SoO: r.so_o,
    GhiChu: r.ghi_chu,
    ToaDo: r.toa_do,
    HinhAnh: r.hinh_anh,
    IsView: r.is_view,

    // giá
    DGGomVAT: r.dg_gom_vat,
    GiaVaoHD: r.gia_vao_hd,
    DonGiaChuaVAT: r.don_gia_chua_vat,
    TongGiaChuaVAT: r.tong_gia_chua_vat,
    GiaNaked: r.gia_naked,
    VAT: r.vat,
    TienVAT: r.tien_vat,
    TongGiaGomVAT: r.tong_gia_gom_vat,
    PBT: r.pbt,
    TienPBT: r.tien_pbt,
    TongGiaGomPBT: r.tong_gia_gom_pbt,
    TienDat: r.tien_dat,
    DonGia: r.don_gia,
    TongGia: r.tong_gia,
    DonGiaDaVAT: r.don_gia_da_vat,
    TongGiaDaVAT: r.tong_gia_da_vat,
    TongThanhToan: r.tong_thanh_toan,
    TyLeVAT: r.ty_le_vat,
    TyLePhiBaoTri: r.ty_le_phi_bao_tri,
    TienPhiBaoTri: r.tien_phi_bao_tri,
    TongGomPBT: r.tong_gom_pbt,
    DGDatPB: r.dg_dat_pb,
    TongTienSDD: r.tong_tien_sdd,
    DonGiaXayDung: r.don_gia_xay_dung,
    ThanhTienXD: r.thanh_tien_xd,
    DonGiaDat: r.don_gia_dat,
    TongGiaDat: r.tong_gia_dat,
    TongGiaTriHDMB: r.tong_gia_tri_hdmb,

    // nhật ký
    STT: r.stt,
    NgayNhap: r.ngay_nhap ?? r.created_at,
    NgaySua: r.ngay_sua ?? r.updated_at,
    NguoiNhap: r.nguoi_nhap,
    NguoiSua: r.nguoi_sua,

    // giỏ hàng đang chứa căn + thùng rác (fn_bds_product_list)
    CartId: r.cart_id ?? null,
    TenGioHang: r.ten_gio_hang ?? null,
    // Giỏ Sự kiện / Chung (GP11): loại giỏ đang chứa căn + giỏ cũ khi căn đang bị sự kiện mượn
    CartHinhThucPhanPhoi: r.cart_hinh_thuc_phan_phoi ?? null,
    GioGocId: r.gio_goc_id ?? null,
    TenGioGoc: r.ten_gio_goc ?? null,
    DeletedAt: r.deleted_at ?? null,
    NguoiXoa: r.nguoi_xoa ?? null,
  };
};

export interface BdsProductFilter {
  MaDA?: any;
  MaKhu?: any;
  MaPK?: any;
  MaTT?: any;
  MaTang?: any;
  FormCode?: string;
  InputSearch?: string;
  inputSearch?: string;
  PageIndex?: number;
  PageSize?: number;
}

/**
 * Danh sách sản phẩm RÚT GỌN cho các lưới chọn nhanh (picker):
 * chỉ lấy đúng cột hiển thị + phân trang phía máy chủ.
 */
export const listBdsProductsLite = async (
  filter: BdsProductFilter = {}
): Promise<{ data: any[]; total: number }> => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return { data: [], total: 0 };

  const maDA = await resolveProjectId(filter?.MaDA);
  const pageSize = Number(filter?.PageSize) > 0 ? Number(filter.PageSize) : 20;
  const pageIndex = Number(filter?.PageIndex) > 0 ? Number(filter.PageIndex) : 1;
  const from = (pageIndex - 1) * pageSize;

  let q = supabase
    .from("bds_products" as any)
    .select(
      "id, ma_sp, ky_hieu, ma_da, da:ma_da(id,ten_da), lhbds:ma_lhbds(id,item_name), tang:ma_tang(id,item_name), tt:ma_tt(id,item_name,color_code)",
      { count: "exact" }
    )
    .eq("ma_ctdk", ma_ctdk);

  if (maDA) q = q.eq("ma_da", maDA);
  if (isUuid(filter?.MaKhu)) q = q.eq("ma_khu", clean(filter?.MaKhu));
  if (isUuid(filter?.MaPK)) q = q.eq("ma_pk", clean(filter?.MaPK));
  if (isUuid(filter?.MaTT)) q = q.eq("ma_tt", clean(filter?.MaTT));
  if (filter?.FormCode) q = q.eq("form_code", filter.FormCode);

  const kw = clean(filter?.InputSearch ?? filter?.inputSearch);
  if (kw)
    q = q.or(`ky_hieu.ilike.%${kw}%,ma_sp.ilike.%${kw}%,so_can_ho.ilike.%${kw}%`);

  q = (await applyDataScope("bds_products"))(q);

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;

  return {
    data: (data ?? []).map((r: any) => ({
      MaSP: r.id,
      ID: r.id,
      MaSoSP: r.ma_sp ?? r.ky_hieu,
      KyHieu: r.ky_hieu,
      MaDA: r.ma_da,
      TenDA: r.da?.ten_da ?? "",
      TenLoaiBDS: r.lhbds?.item_name ?? "",
      Tang: r.tang?.item_name ?? "",
      TenTrangThai: r.tt?.item_name ?? "",
      MauTrangThai: statusColorOf(r.tt?.id, r.tt?.color_code ?? null) ?? "",
    })),
    total: Number(count ?? (data?.length ?? 0)),
  };
};

const UUID_FILTER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const catalogUuidCache = new Map<string, string | null>();

/** Giá trị lọc danh mục (uuid hoặc mã cũ item_code) → cloud_catalogs.id (dùng chung với services/products/bds-product-cao-tang) */
export const resolveCatalogUuid = async (
  v: any,
  tenant: string,
  projectId: string | null
): Promise<string | null> => {
  const key = v == null ? "" : String(v).trim();
  // "-1" / "all" là giá trị "tất cả" của UI cũ -> không lọc theo khu/phân khu
  if (!key || key === "0" || key === "-1" || key.toLowerCase() === "all") return null;
  if (UUID_FILTER_RE.test(key)) return key;
  const ck = `${tenant}:${projectId || ""}:${key}`;
  if (catalogUuidCache.has(ck)) return catalogUuidCache.get(ck) ?? null;
  const esc = key.replace(/[%,()"]/g, " ");
  let q = (supabase as any)
    .from("cloud_catalogs")
    .select("id")
    .eq("ma_ctdk_uid", tenant)
    .or(`item_code.eq.${esc},item_name.eq.${esc}`)
    .limit(1);
  if (projectId) q = q.eq("da_project_id", projectId);
  const { data } = await q;
  // Không tra được thì gửi uuid rỗng để máy chủ trả 0 dòng (không lọc sai)
  const id = (data as any[])?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";
  catalogUuidCache.set(ck, id);
  return id;
};

/**
 * Đọc danh sách sản phẩm qua function máy chủ `fn_bds_product_list` (hàm đọc dùng chung):
 * lọc dự án/khu/phân khu/trạng thái, tìm kiếm, sắp xếp và phân trang đều chạy tại server;
 * công ty + phạm vi (dự án được gán / giỏ của đại lý) máy chủ tự lấy từ JWT.
 */
export const listBdsProducts = async (
  filter: BdsProductFilter = {}
): Promise<{ data: any[]; total: number }> => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return { data: [], total: 0 };

  const maDA = await resolveProjectId(filter?.MaDA);
  const pageSize = Number(filter?.PageSize) > 0 ? Number(filter.PageSize) : 100;
  const pageIndex = Number(filter?.PageIndex) > 0 ? Number(filter.PageIndex) : 1;
  const kw = clean(filter?.InputSearch ?? filter?.inputSearch);

  // Khu / phân khu: máy chủ chỉ lọc theo uuid danh mục (cloud_catalogs.id)
  const [khuId, pkId, tangId] = await Promise.all([
    resolveCatalogUuid(filter?.MaKhu, ma_ctdk, maDA ? String(maDA) : null),
    resolveCatalogUuid(filter?.MaPK, ma_ctdk, maDA ? String(maDA) : null),
    resolveCatalogUuid(filter?.MaTang, ma_ctdk, maDA ? String(maDA) : null),
  ]);

  const { data, error } = await (supabase as any).rpc("fn_bds_product_list", {
    p_ma_da: maDA ? String(maDA) : null,
    p_ma_khu: khuId,
    p_ma_pk: pkId,
    p_ma_tang: tangId,
    p_ma_tt: clean(filter?.MaTT) || null,
    p_form_code: filter?.FormCode || null,
    p_input_search: kw || null,
    p_page_index: pageIndex,
    p_page_size: pageSize,
  });
  if (error) throw error;

  const rows: any[] = (data as any)?.rows || [];
  const total = Number((data as any)?.total_count ?? rows.length);
  return {
    // UI cũ đọc tổng số bản ghi từ TotalRows của dòng đầu tiên
    data: rows.map((r: any) => ({ ...mapBdsProduct(r), TotalRows: total })),
    total,
  };
};

/** Danh mục dùng cho form Thêm/Sửa sản phẩm — CHỈ gọi khi mở drawer */
export interface BdsFormCatalogs {
  zones: any[];
  subZones: any[];
  floors: any[];
  apartmentTypes: any[];
  bedrooms: any[];
  directions: any[];
  views: any[];
  locations: any[];
  propertyTypes: any[];
  landTypes: any[];
  houseModels: any[];
  statuses: any[];
  /** Khu quy hoạch, Tiêu chuẩn bàn giao: danh mục theo dự án */
  planningZones: any[];
  handoverStandards: any[];
}

/** catalog_type chuẩn cho từng nhóm danh mục của form */
const CATALOG_TYPES: Record<keyof BdsFormCatalogs, string> = {
  zones: "khu",
  subZones: "phan_khu",
  floors: "tang",
  apartmentTypes: "loai_ch",
  bedrooms: "phong_ngu",
  directions: "phuong_huong",
  views: "view_sp",
  locations: "vi_tri",
  propertyTypes: "loai_bds",
  landTypes: "dat_nen",
  houseModels: "mau_nha",
  statuses: "bds_trang_thai",
  planningZones: "khu_quy_hoach",
  handoverStandards: "tieu_chuan_ban_giao",
};


const emptyCatalogs = (): BdsFormCatalogs => ({
  zones: [],
  subZones: [],
  floors: [],
  apartmentTypes: [],
  bedrooms: [],
  directions: [],
  views: [],
  locations: [],
  propertyTypes: [],
  landTypes: [],
  houseModels: [],
  statuses: [],
  planningZones: [],
  handoverStandards: [],
});

const catalogOption = (r: any) => ({
  ID: r.id,
  id: r.id,
  Ma: r.item_code,
  Ten: r.item_name,
  // các alias để dùng lại đúng tên field mà UI cũ đang đọc
  MaKhu: r.id,
  TenKhu: r.item_name,
  MaPK: r.id,
  TenPK: r.item_name,
  MaTang: r.id,
  TenTang: r.item_name,
  TenLoaiMau: r.item_name,
  TenLoaiPN: r.item_name,
  TenVeiw: r.item_name,
  TenVT: r.item_name,
  MaLBDS: r.id,
  TenLBDS: r.item_name,
  MaTT: r.id,
  TenTT: r.item_name,
  maPhuongHuong: r.id,
  tenPhuongHuong: r.item_name,
  TenVietTat: r?.raw?.TenVietTat || r.item_name,
  Name: r.item_name,
  color_code: r.color_code ?? null,
});

/**
 * Đọc 1 catalog_type theo tenant (uuid), có thể lọc theo dự án / khu.
 *
 * Key cache bao gồm ĐỦ payload của câu query (tenant, loại danh mục, dự án,
 * khu) nên các lần mở form cùng dữ liệu sẽ tái sử dụng kết quả thay vì gọi
 * `cloud_catalogs` lại. Tiền tố `catalog:` dùng chung với các service danh
 * mục hiện có nên khi danh mục được ghi sẽ được dọn đúng chỗ.
 */
const readCatalog = async (
  ma_ctdk: string,
  catalogType: string,
  scope?: { projectId?: string; zoneId?: string }
) => {
  const cacheKey = `catalog:${ma_ctdk}:${catalogType}:form:${scope?.projectId ?? ""}:${scope?.zoneId ?? ""}`;
  return memoAsync(cacheKey, async () => {
    let q = supabase
      .from("cloud_catalogs" as any)
      .select("*")
      .eq("ma_ctdk_uid", ma_ctdk)
      .eq("catalog_type", catalogType);
    if (scope?.projectId) q = q.eq("da_project_id", scope.projectId);
    if (scope?.zoneId) q = q.eq("khu_catalog_id", scope.zoneId);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .filter((r: any) => r?.is_ap_dung !== false)
      .map(catalogOption);
  }, FORM_CATALOG_TTL);
};

type CatalogOption = ReturnType<typeof catalogOption>;
type CatalogRow = Parameters<typeof catalogOption>[0] & { catalog_type: string; is_ap_dung?: boolean };

/**
 * Đọc NHIỀU catalog_type trong 1 truy vấn (`catalog_type=in.(…)`) rồi tách theo loại —
 * form Thêm/Sửa sản phẩm mở 1 lần chỉ tốn 1 request cho mỗi nhóm (theo dự án / theo khu).
 * Loại không có dòng trả `[]`. Đệm dưới tiền tố `catalog:` như `readCatalog`.
 */
const readCatalogs = async (
  ma_ctdk: string,
  types: string[],
  scope?: { projectId?: string; zoneId?: string }
): Promise<Record<string, CatalogOption[]>> => {
  const cacheKey = `catalog:${ma_ctdk}:group:${types.join(",")}:form:${scope?.projectId ?? ""}:${scope?.zoneId ?? ""}`;
  return memoAsync(cacheKey, async () => {
    let q = supabase
      .from("cloud_catalogs" as any)
      .select("*")
      .eq("ma_ctdk_uid", ma_ctdk)
      .in("catalog_type", types);
    if (scope?.projectId) q = q.eq("da_project_id", scope.projectId);
    if (scope?.zoneId) q = q.eq("khu_catalog_id", scope.zoneId);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) throw error;
    const out: Record<string, CatalogOption[]> = Object.fromEntries(types.map((t) => [t, []]));
    for (const r of (data ?? []) as unknown as CatalogRow[]) {
      if (r?.is_ap_dung === false || !out[r.catalog_type]) continue;
      out[r.catalog_type].push(catalogOption(r));
    }
    return out;
  }, FORM_CATALOG_TTL);
};

/** Đọc danh mục DÙNG CHUNG (ma_ctdk = 'global', không gắn công ty đăng ký) */
const readGlobalCatalog = async (catalogType: string) =>
  memoAsync(`catalog:global:${catalogType}:form`, async () => {
    const { data, error } = await supabase
      .from("cloud_catalogs" as any)
      .select("*")
      .eq("ma_ctdk", "global")
      .eq("catalog_type", catalogType)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .filter((r: any) => r?.is_ap_dung !== false)
      .map(catalogOption);
  }, FORM_CATALOG_TTL);

/**
 * Đọc 1 sản phẩm ĐẦY ĐỦ theo uuid / ma_sp / ký hiệu.
 * Dùng cho form Sửa, Chi tiết căn và khi mở Đặt cọc / HĐ / Góp vốn từ lưới
 * (lưới đã rút gọn cột nên phải đọc lại bản đầy đủ).
 */
export const getBdsProductById = async (id: any) => {
  const key = String(id ?? "").trim();
  if (!key) return null;
  const ma_ctdk = sessionCompanyId();
  const { data, error } = await supabase.rpc("fn_get_product_by_id" as any, {
    p_id: key,
    p_ma_ctdk: ma_ctdk || null,
  } as any);
  if (error) throw error;
  return data ? mapBdsProduct(data) : null;
};

/** Bản rút gọn dùng cho lưới — cùng khoá đầu ra với `mapBdsProduct`. */
export const mapBdsProductRow = mapBdsProduct;

/**
 * Phân giải UUID sản phẩm từ khoá bất kỳ (uuid, ma_sp hoặc ký hiệu căn).
 * Trả về "" khi không tìm thấy.
 */
export const resolveBdsProductId = async (
  key: any,
  maDA?: any
): Promise<string> => {
  const k = String(key ?? "").trim();
  if (!k) return "";
  if (isUuid(k)) return k;
  const ma_ctdk = sessionCompanyId();
  let q = supabase.from("bds_products" as any).select("id").limit(1);
  q = q.or(`ma_sp.eq.${k},ky_hieu.eq.${k}`);
  if (ma_ctdk) q = q.eq("ma_ctdk", ma_ctdk);
  const daId = maDA ? await resolveProjectId(maDA) : "";
  if (daId) q = q.eq("ma_da", daId);
  const { data, error } = await q.maybeSingle();
  if (error) return "";
  return (data as any)?.id ? String((data as any).id) : "";
};

/** Danh sách dự án cho form (da_projects theo tenant uuid) */
export const listProjectsForForm = async () => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return [] as any[];
  // Cùng tenant thì payload danh sách dự án không đổi — dùng chung cache với
  // bảng tra cứu dự án để mở form không phải query `da_projects` lại.
  return memoAsync(`daproj:index:${ma_ctdk}:form-options`, async () => {
    const { data, error } = await supabase
      .from("da_projects" as any)
      .select("id,ma_da_code,ten_da")
      .eq("ma_ctdk", ma_ctdk);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ID: r.id,
      id: r.id,
      MaDA: r.id,
      TenDA: r.ten_da ?? "",
    }));
  }, FORM_CATALOG_TTL);
};

/**
 * Nạp danh mục cho form Thêm/Sửa sản phẩm theo ĐÚNG quan hệ của `cloud_catalogs`:
 * - Không phụ thuộc gì (chỉ ma_ctdk_uid): Hướng (phuong_huong), Trạng thái (bds_trang_thai)
 * - Phụ thuộc DỰ ÁN (da_project_id): Khu, Loại hình BĐS, Loại đất nền, Phòng ngủ, View
 * - Phụ thuộc DỰ ÁN + KHU (da_project_id + khu_catalog_id): Phân khu, Tầng, Vị trí, Loại căn hộ
 */
export const listBaseCatalogsForForm = async (): Promise<
  Pick<BdsFormCatalogs, "directions" | "statuses">
> => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return { directions: [], statuses: [] };
  const [directions, statusesTenant] = await Promise.all([
    readCatalog(ma_ctdk, CATALOG_TYPES.directions),
    readCatalog(ma_ctdk, CATALOG_TYPES.statuses),
  ]);
  // Trạng thái sản phẩm là danh mục DÙNG CHUNG (ma_ctdk = 'global')
  const statuses = statusesTenant.length
    ? statusesTenant
    : await readGlobalCatalog(CATALOG_TYPES.statuses);
  return { directions, statuses };
};

/** Đọc 1 nhóm danh mục của form bằng 1 truy vấn, trả theo tên nhóm (`zones`, `floors`…) */
const readFormGroup = async <K extends keyof BdsFormCatalogs>(
  keys: K[],
  scope: { projectId?: string; zoneId?: string }
): Promise<Pick<BdsFormCatalogs, K>> => {
  const ma_ctdk = sessionCompanyId();
  const byType = await readCatalogs(ma_ctdk, keys.map((k) => CATALOG_TYPES[k]), scope);
  return Object.fromEntries(keys.map((k) => [k, byType[CATALOG_TYPES[k]] ?? []])) as Pick<BdsFormCatalogs, K>;
};

const PROJECT_GROUP = [
  "zones", "propertyTypes", "landTypes", "bedrooms", "views", "planningZones", "handoverStandards",
] as const;
const ZONE_GROUP = ["subZones", "floors", "locations", "apartmentTypes", "houseModels"] as const;
const emptyGroup = <K extends keyof BdsFormCatalogs>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, []])) as unknown as Pick<BdsFormCatalogs, K>;

/** Danh mục phụ thuộc DỰ ÁN (1 truy vấn) */
export const listProjectCatalogsForForm = async (
  maDA?: any
): Promise<Pick<BdsFormCatalogs, (typeof PROJECT_GROUP)[number]>> => {
  const projectId = await resolveProjectId(maDA);
  if (!sessionCompanyId() || !projectId) return emptyGroup(PROJECT_GROUP);
  return readFormGroup([...PROJECT_GROUP], { projectId });
};

/**
 * Tên loại căn hộ của MỌI khu trong dự án (danh mục khai báo theo khu nên cùng tên có nhiều bản ghi):
 * cắt khoảng trắng, bỏ trống, bỏ trùng không phân biệt hoa thường (giữ bản đầu tiên), sắp theo tiếng Việt.
 * Dùng cho điều kiện "Loại căn" của chi tiết chiết khấu, so theo tên.
 */
export const listProjectApartmentTypeNames = async (maDA?: any): Promise<string[]> => {
  const ma_ctdk = sessionCompanyId();
  const projectId = await resolveProjectId(maDA);
  if (!ma_ctdk || !projectId) return [];
  const rows = await readCatalog(ma_ctdk, CATALOG_TYPES.apartmentTypes, { projectId });
  const seen = new Map<string, string>();
  for (const r of rows) {
    const ten = String(r?.Ten ?? "").trim();
    if (ten && !seen.has(ten.toLowerCase())) seen.set(ten.toLowerCase(), ten);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "vi"));
};

/** Danh mục phụ thuộc DỰ ÁN + KHU (1 truy vấn) */
export const listZoneCatalogsForForm = async (
  maDA?: any,
  maKhu?: any
): Promise<Pick<BdsFormCatalogs, (typeof ZONE_GROUP)[number]>> => {
  const projectId = await resolveProjectId(maDA);
  const zoneId = isUuid(maKhu) ? String(maKhu).trim() : "";
  if (!sessionCompanyId() || !projectId || !zoneId) return emptyGroup(ZONE_GROUP);
  return readFormGroup([...ZONE_GROUP], { projectId, zoneId });
};

/** Gộp đủ 3 nhóm (dùng khi mở form Sửa: đã biết dự án + khu) */
export const listCatalogsForForm = async (
  maDA?: any,
  maKhu?: any
): Promise<BdsFormCatalogs> => {
  const [base, byProject, byZone] = await Promise.all([
    listBaseCatalogsForForm(),
    listProjectCatalogsForForm(maDA),
    listZoneCatalogsForForm(maDA, maKhu),
  ]);
  return { ...emptyCatalogs(), ...base, ...byProject, ...byZone };
};

/**
 * Danh sách Khu vực cho BỘ LỌC sản phẩm.
 * - Có dự án: chỉ lấy khu thuộc đúng dự án đó (đúng danh mục Khu vực).
 * - Chưa chọn dự án: lấy toàn bộ khu của tenant để vẫn lọc được theo danh mục.
 */
export const listZonesForFilter = async (maDA?: any) => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return [] as any[];
  const projectId = await resolveProjectId(maDA);
  // Chỉ đọc đúng danh mục Khu (cùng khoá đệm với form nên mở form không đọc lại)
  return projectId
    ? readCatalog(ma_ctdk, CATALOG_TYPES.zones, { projectId })
    : readCatalog(ma_ctdk, CATALOG_TYPES.zones);
};

/**
 * Danh sách Phân khu cho BỘ LỌC sản phẩm.
 * - Có dự án + khu: chỉ lấy phân khu thuộc đúng khu đó (đúng danh mục Phân khu).
 * - Chưa chọn dự án nhưng đã chọn khu: lọc phân khu theo khu trên toàn tenant.
 */
export const listSubZonesForFilter = async (maDA?: any, maKhu?: any) => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return [] as any[];
  const projectId = await resolveProjectId(maDA);
  const zoneId = isUuid(maKhu) ? String(maKhu).trim() : "";
  if (!zoneId) return [] as any[];
  return projectId
    ? readCatalog(ma_ctdk, CATALOG_TYPES.subZones, { projectId, zoneId })
    : readCatalog(ma_ctdk, CATALOG_TYPES.subZones, { zoneId });
};

/** Danh mục Tầng — phụ thuộc dự án + khu đang chọn */
export const listFloorsForForm = async (maDA?: any, maKhu?: any) => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return [] as any[];
  const projectId = await resolveProjectId(maDA);
  const zoneId = isUuid(maKhu) ? String(maKhu).trim() : "";
  if (!projectId || !zoneId) return [] as any[];
  return readCatalog(ma_ctdk, CATALOG_TYPES.floors, { projectId, zoneId });
};

/**
 * uuid trạng thái "Chưa bán" (mã 1) — mặc định khi thêm mới sản phẩm. Căn chỉ có thao tác
 * giao dịch sau khi người dùng chuyển sang "Mở bán" (isOpenForSale). Không có "Chưa bán" → null.
 */
export const getDefaultStatusId = async (statuses?: any[]) => {
  const list = statuses?.length ? statuses : (await listBaseCatalogsForForm()).statuses;
  const found =
    list.find((s: any) => String(s?.Ma ?? "").trim() === "1") ||
    list.find((s: any) =>
      String(s?.Ten ?? "")
        .normalize("NFC")
        .trim()
        .toLowerCase() === "chưa bán"
    );
  return found?.id ?? null;
};



/* ------------------------- GHI SẢN PHẨM (bds_products) ------------------------- */

/** Map payload sang cột bds_products: src/services/products/bds-product-row (giữ tên export cũ) */
export { toBdsProductRow };

/**
 * Thêm / sửa 1 sản phẩm — GHI THẲNG vào `bds_products`.
 * - Sửa: có `id` (uuid) → update theo id
 * - Thêm: upsert theo khoá duy nhất (ma_ctdk, ma_da, ky_hieu)
 */
export const saveBdsProduct = async (
  payload: any,
  kind?: string,
  allowDuplicate = false,
): Promise<{ id?: string; duplicate?: string[]; message?: string }> => {
  const { data, error } = await supabase.rpc("fn_bds_product_save" as any, {
    p_payload: payload,
    p_form_code: kind ?? payload?.FormCode ?? "CAOTANG",
    p_allow_duplicate: allowDuplicate,
  } as any);
  if (error) throw error;
  const res: any = data || {};
  if (res.error) throw new Error(String(res.error));
  return res;
};

/**
 * Cột tối thiểu cho SƠ ĐỒ TỔNG QUAN — chỉ những gì lưới ô căn cần vẽ.
 * Chi tiết đầy đủ của căn được nạp lại khi người dùng bấm vào ô
 * (getProductFromCloud), nên không cần kéo toàn bộ cột ở bước vẽ sơ đồ.
 */
const FLOORPLAN_SELECT = `
  id, ma_sp, ky_hieu, form_code, ma_da, so_can_ho,
  dien_tich, dien_tich_thong_thuy, dt_tim_tuong,
  don_gia_chua_vat, tong_gia_chua_vat, tong_gia_gom_vat,
  tong_gia_da_vat, tong_gia, tong_gia_tri_hdmb,
  da:ma_da(id, ten_da),
  khu:ma_khu(id, item_code, item_name),
  tang:ma_tang(id, item_code, item_name),
  vt:vi_tri(id, item_code, item_name),
  tt:ma_tt(id, item_code, item_name, color_code)
`;

/** Bộ nhớ đệm ngắn hạn: nhiều nơi cùng hỏi 1 sơ đồ trong 1 lần mở trang */
const floorPlanCache = new Map<
  string,
  { at: number; promise: Promise<{ tang: any[]; viTri: any[] }> }
>();
const FLOOR_PLAN_TTL = 15_000;

/**
 * SƠ ĐỒ TỔNG QUAN — đọc trực tiếp từ `bds_products` (cùng nguồn với lưới
 * Cao tầng / Thấp tầng) nên trạng thái & màu trên sơ đồ khớp 1-1 với bảng.
 */
export const getFloorPlanFromBds = async (params: {
  maDA?: any;
  tenKhu?: any;
  maKhu?: any;
  formCode?: string;
  /** true → chỉ lấy cột cần cho sơ đồ (nhanh hơn nhiều) */
  lean?: boolean;
}): Promise<{ tang: any[]; viTri: any[] }> => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) return { tang: [], viTri: [] };

  const cacheKey = JSON.stringify([
    ma_ctdk,
    clean(params?.maDA),
    clean(params?.maKhu),
    String(params?.tenKhu ?? ""),
    params?.formCode ?? "",
    !!params?.lean,
  ]);
  const hit = floorPlanCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FLOOR_PLAN_TTL) return hit.promise;

  const promise = loadFloorPlanFromBds(ma_ctdk, params);
  floorPlanCache.set(cacheKey, { at: Date.now(), promise });
  promise.catch(() => floorPlanCache.delete(cacheKey));
  return promise;
};

/** Xoá đệm sơ đồ (gọi sau khi thay đổi trạng thái căn) */
export const clearFloorPlanCache = () => floorPlanCache.clear();

const loadFloorPlanFromBds = async (
  ma_ctdk: string,
  params: {
    maDA?: any;
    tenKhu?: any;
    maKhu?: any;
    formCode?: string;
    lean?: boolean;
  }
): Promise<{ tang: any[]; viTri: any[] }> => {
  const maDA = await resolveProjectId(params?.maDA);
  const pageSize = 1000;
  const cols = params?.lean ? FLOORPLAN_SELECT : SELECT;

  const buildQuery = (from: number, to: number, count?: "exact"): any => {
    let q: any = (supabase.from("bds_products" as any) as any)
      .select(cols, count ? { count } : undefined)
      .eq("ma_ctdk", ma_ctdk)
      .range(from, to);
    if (maDA) q = q.eq("ma_da", maDA);
    if (isUuid(params?.maKhu)) q = q.eq("ma_khu", clean(params?.maKhu));
    if (params?.formCode) q = q.eq("form_code", params.formCode);
    return q;
  };

  // Trang đầu kèm tổng số dòng → các trang còn lại tải song song
  const first: any = await buildQuery(0, pageSize - 1, "exact");
  if (first.error) throw first.error;
  const rows: any[] = [...(((first.data as any[]) || []))];
  const total = Number(first.count ?? rows.length);

  if (total > pageSize) {
    const pages: Promise<any>[] = [];
    for (let page = 1; page < Math.min(Math.ceil(total / pageSize), 20); page++) {
      pages.push(Promise.resolve(buildQuery(page * pageSize, page * pageSize + pageSize - 1)));
    }

    const results = await Promise.all(pages);
    for (const r of results) {
      if (r.error) throw r.error;
      rows.push(...(((r.data as any[]) || [])));
    }
  }


  const zoneName = String(params?.tenKhu ?? "").trim().toLowerCase();
  const list = rows
    .map((r) => mapBdsProduct(r))
    .filter((p) =>
      !zoneName || isUuid(params?.maKhu)
        ? true
        : String(p.TenKhu ?? "").trim().toLowerCase() === zoneName
    );
  if (!list.length) return { tang: [], viTri: [] };

  const viTriMap = new Map<string, any>();
  const tangMap = new Map<string, any>();

  list.forEach((p: any) => {
    const code = String(p.KyHieu ?? "").trim();
    const floorLabel = String(p.Tang ?? "").replace(/^tầng\s*/i, "").trim();
    if (!floorLabel) return;
    const pos = String(p.TenViTri ?? p.SoCanHo ?? code.slice(-2) ?? "").trim();
    if (!pos) return;

    if (!viTriMap.has(pos)) {
      const n = Number(pos.replace(/\D/g, ""));
      viTriMap.set(pos, {
        maVT: pos,
        tenVT: pos,
        detailVT: [{ SapXep: Number.isFinite(n) ? n : 0 }],
      });
    }
    if (!tangMap.has(floorLabel)) {
      tangMap.set(floorLabel, {
        maTang: floorLabel,
        tenTang: `Tầng ${floorLabel}`,
        detailFloor: [],
      });
    }

    tangMap.get(floorLabel).detailFloor.push({
      ...p,
      Tang: floorLabel,
      MaVT: pos,
      TenViTri: pos,
      DTThongThuy: p.DienTichThongThuy ?? p.DienTich,
      TongGiaGomVAT: p.TongGiaGomVAT ?? p.TongGiaDaVAT ?? p.TongGia,
    });
  });

  const numOf = (v: any) => {
    const n = Number(String(v ?? "").replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const viTri = Array.from(viTriMap.values()).sort(
    (a, b) =>
      numOf(a.maVT) - numOf(b.maVT) ||
      String(a.maVT).localeCompare(String(b.maVT))
  );
  const tang = Array.from(tangMap.values()).sort(
    (a, b) => numOf(b.maTang) - numOf(a.maTang)
  );
  tang.forEach((t: any) =>
    t.detailFloor.sort((a: any, b: any) => numOf(a.MaVT) - numOf(b.MaVT))
  );

  return { tang, viTri };
};

/** uuid trạng thái sản phẩm theo TÊN (danh mục dùng chung hoặc theo tenant) */
export const resolveProductStatusId = async (
  tenTT: string
): Promise<string | null> => {
  const name = String(tenTT ?? "").trim().toLowerCase();
  if (!name) return null;
  const ma_ctdk = sessionCompanyId();
  const { data } = await supabase
    .from("cloud_catalogs" as any)
    .select("id,item_name,item_code,ma_ctdk,ma_ctdk_uid")
    .eq("catalog_type", "bds_trang_thai");
  const rows = ((data as any[]) || []).filter(
    (r) =>
      String(r?.item_name ?? "").trim().toLowerCase() === name &&
      (r?.ma_ctdk === "global" || !ma_ctdk || r?.ma_ctdk_uid === ma_ctdk)
  );
  const own = rows.find((r) => r?.ma_ctdk_uid === ma_ctdk);
  return String((own || rows[0])?.id ?? "") || null;
};

/**
 * Đổi trạng thái sản phẩm trên `bds_products` theo ký hiệu / mã sản phẩm.
 * Trả về số dòng đã cập nhật.
 */
export const setBdsProductStatusByName = async (
  refs: any[],
  tenTT: string
): Promise<number> => {
  const ma_ctdk = sessionCompanyId();
  const keys = Array.from(
    new Set(
      (refs || [])
        .filter((v) => v != null && String(v).trim() !== "")
        .map((v) => String(v).replace(/"/g, "").trim())
    )
  );
  if (!ma_ctdk || !keys.length || !tenTT) return 0;

  const statusId = await resolveProductStatusId(tenTT);
  const quoted = keys.map((v) => `"${v}"`).join(",");
  const { data: prods, error } = await supabase
    .from("bds_products" as any)
    .select("id")
    .eq("ma_ctdk", ma_ctdk)
    .or(`ky_hieu.in.(${quoted}),ma_sp.in.(${quoted})`);
  if (error) throw error;

  const ids = ((prods as any[]) || []).map((p) => p.id);
  if (!ids.length) return 0;

  const patch: any = {
    cloud_status_override: tenTT,
    cloud_status_at: new Date().toISOString(),
  };
  if (statusId) patch.ma_tt = statusId;

  const { error: upErr } = await supabase
    .from("bds_products" as any)
    .update(patch)
    .in("id", ids);
  if (upErr) throw upErr;
  return ids.length;
};

/** Tên trạng thái hiện tại của sản phẩm theo ký hiệu / mã SP */
export const readBdsProductStatusName = async (
  refs: any[]
): Promise<string | null> => {
  const ma_ctdk = sessionCompanyId();
  const keys = Array.from(
    new Set(
      (refs || [])
        .filter((v) => v != null && String(v).trim() !== "")
        .map((v) => String(v).replace(/"/g, "").trim())
    )
  );
  if (!ma_ctdk || !keys.length) return null;
  const quoted = keys.map((v) => `"${v}"`).join(",");
  const { data } = await supabase
    .from("bds_products" as any)
    .select("cloud_status_override, tt:ma_tt(item_name)")
    .eq("ma_ctdk", ma_ctdk)
    .or(`ky_hieu.in.(${quoted}),ma_sp.in.(${quoted})`)
    .limit(1);
  const row = ((data as any[]) || [])[0];
  const tt = row?.tt?.item_name || row?.cloud_status_override;
  return tt ? String(tt) : null;
};

export const BdsProductService = {
  setProductStatusByName: setBdsProductStatusByName,
  readProductStatusName: readBdsProductStatusName,
  resolveProductStatusId,
  listProducts: listBdsProducts,
  listCatalogsForForm,
  listBaseCatalogsForForm,
  listProjectCatalogsForForm,
  listZoneCatalogsForForm,
  listZonesForFilter,
  listSubZonesForFilter,
  listFloorsForForm,
  getDefaultStatusId,
  getBdsProductById,
  listProjectsForForm,
  saveProduct: saveBdsProduct,
  mapBdsProduct,
  resolveProjectId,
  getFloorPlan: getFloorPlanFromBds,
};

export default BdsProductService;


/* --------------------- GHI HÀNG LOẠT (import / mirror) --------------------- */

export type CatalogEntry = { id: string; proj: string; zone: string };
export type CatalogIndex = {
  /** catalog_type → tên/mã (chuẩn hoá) → danh sách bản ghi */
  byName: Map<string, Map<string, CatalogEntry[]>>;
  /** catalog_type → uuid → bản ghi (để kiểm tra uuid có thuộc đúng phạm vi) */
  byId: Map<string, Map<string, CatalogEntry>>;
};

const norm = (v: any) => String(v ?? "").trim().toLowerCase();

/** Danh mục phụ thuộc dự án */
const PROJECT_SCOPED = new Set([
  CATALOG_TYPES.zones,
  CATALOG_TYPES.subZones,
  CATALOG_TYPES.floors,
  CATALOG_TYPES.locations,
  CATALOG_TYPES.apartmentTypes,
  CATALOG_TYPES.bedrooms,
  CATALOG_TYPES.views,
  CATALOG_TYPES.propertyTypes,
  CATALOG_TYPES.landTypes,
  CATALOG_TYPES.houseModels,
  CATALOG_TYPES.planningZones,
  CATALOG_TYPES.handoverStandards,
]);

/** Danh mục phụ thuộc khu (bên trong dự án) */
const ZONE_SCOPED = new Set([
  CATALOG_TYPES.subZones,
  CATALOG_TYPES.floors,
  CATALOG_TYPES.locations,
  CATALOG_TYPES.apartmentTypes,
  CATALOG_TYPES.houseModels,
]);

/**
 * Nạp danh mục của tenant + danh mục dùng chung, đánh chỉ mục theo
 * (catalog_type → tên/mã → danh sách bản ghi kèm dự án & khu).
 */
const loadCatalogIndex = async (ma_ctdk: string): Promise<CatalogIndex> => {
  const idx: CatalogIndex = { byName: new Map(), byId: new Map() };
  const put = (type: string, key: any, entry: CatalogEntry) => {
    const k = norm(key);
    if (!k || !entry.id) return;
    if (!idx.byName.has(type)) idx.byName.set(type, new Map());
    const m = idx.byName.get(type)!;
    const arr = m.get(k) || [];
    if (!arr.some((e) => e.id === entry.id)) arr.push(entry);
    m.set(k, arr);
  };
  const types = Object.values(CATALOG_TYPES);
  const { data } = await supabase
    .from("cloud_catalogs" as any)
    .select(
      "id,item_code,item_name,catalog_type,ma_ctdk,ma_ctdk_uid,da_project_id,khu_catalog_id,is_ap_dung"
    )
    .in("catalog_type", types)
    .or(`ma_ctdk_uid.eq.${ma_ctdk},ma_ctdk.eq.global`);
  ((data as any[]) || [])
    .filter((r) => r?.is_ap_dung !== false)
    .forEach((r) => {
      const entry: CatalogEntry = {
        id: String(r.id),
        proj: r.da_project_id ? String(r.da_project_id) : "",
        zone: r.khu_catalog_id ? String(r.khu_catalog_id) : "",
      };
      if (!idx.byId.has(r.catalog_type)) idx.byId.set(r.catalog_type, new Map());
      idx.byId.get(r.catalog_type)!.set(entry.id, entry);
      put(r.catalog_type, r.item_name, entry);
      put(r.catalog_type, r.item_code, entry);
    });
  return idx;
};

const pickFirst = (r: any, keys: string[]) => {
  for (const k of keys) {
    if (r?.[k] != null && r[k] !== "") return r[k];
    const lo = k.charAt(0).toLowerCase() + k.slice(1);
    if (r?.[lo] != null && r[lo] !== "") return r[lo];
  }
  return null;
};

type CatScope = { projectId?: string | null; zoneId?: string | null };

/**
 * Quy đổi tên / mã / uuid danh mục sang uuid, CHỈ chấp nhận bản ghi thuộc
 * ĐÚNG công ty đăng ký (ma_ctdk_uid) và ĐÚNG phạm vi dự án / khu của dòng:
 * - danh mục theo dự án: bắt buộc cùng dự án (không biết dự án ⇒ báo lỗi)
 * - danh mục theo khu: bắt buộc cùng khu (không biết khu ⇒ báo lỗi)
 * - danh mục dùng chung (phương hướng, trạng thái): bản ghi không gắn dự án
 * Không còn lấy "bản ghi đầu tiên" khi lệch phạm vi.
 * `notInstalled`: phạm vi của dòng chưa có bản ghi nào loại này (danh mục chưa cài)
 * — loại theo khu mà dòng không có khu thì chỉ xét dự án.
 */
export const catUidScoped = (
  idx: CatalogIndex,
  type: string,
  scope: CatScope,
  vals: any[]
): { id: string | null; missing: any; notInstalled: boolean } => {
  const proj = scope.projectId ? String(scope.projectId) : "";
  const zone = scope.zoneId ? String(scope.zoneId) : "";
  const needProject = PROJECT_SCOPED.has(type);
  const needZone = ZONE_SCOPED.has(type);
  let missing: any = null;

  const inScope = (c: CatalogEntry) => {
    if (needProject) {
      if (!proj || c.proj !== proj) return false;
    } else if (c.proj && proj && c.proj !== proj) return false;
    if (needZone) {
      if (!zone) return false;
      if (c.zone && c.zone !== zone) return false;
    }
    return true;
  };
  const installedIn = (c: CatalogEntry) => {
    if (needProject ? c.proj !== proj : c.proj && proj && c.proj !== proj) return false;
    if (needZone && zone && c.zone && c.zone !== zone) return false;
    return true;
  };
  const notInstalled = () => {
    for (const c of idx.byId.get(type)?.values() || []) if (installedIn(c)) return false;
    return true;
  };

  for (const v of vals) {
    if (v == null || v === "") continue;
    if (isUuid(v)) {
      const id = String(v).trim();
      const entry = idx.byId.get(type)?.get(id);
      if (entry && inScope(entry)) return { id, missing: null, notInstalled: false };
      if (missing == null) missing = v;
      continue;
    }
    const key = norm(v);
    if (!key) continue;
    const candidates = idx.byName.get(type)?.get(key) || [];
    const pool = candidates.filter(inScope);
    const hit = (needZone && zone ? pool.find((c) => c.zone === zone) : undefined) || pool[0];
    if (hit) return { id: hit.id, missing: null, notInstalled: false };
    if (missing == null) missing = v;
  }
  return { id: null, missing, notInstalled: missing != null && notInstalled() };
};

export type ImportCatalogWarning = {
  field: string;
  value: string;
  rows: number[];
};

/** Kết quả lưu của TỪNG dòng import, hiển thị ở cột Key trên màn hình import */
export type ImportRowResult = {
  Key: string;
  KyHieu: string;
  Status: "success" | "error";
  Note: string;
};

/**
 * Giá trị cột Trạng thái của 1 dòng import (mã đã có → MaTT → TenTT → cột "Trạng thái" của file mẫu).
 * Trống ⇒ máy chủ đặt "Chưa bán" cho căn mới, giữ nguyên căn đã có; chỉ nhận trạng thái chưa giao dịch.
 */
export const importStatusCandidates = (base: { ma_tt?: unknown }, r: any) => [base?.ma_tt, r?.MaTT, r?.TenTT, r?.TrangThai];

/** Số dòng Excel gốc của một dòng import (Key `KEY-n`) — form có thể đã bỏ bớt dòng trước khi gửi */
export const importRowNo = (r: { Key?: unknown } | null | undefined, idx: number) =>
  Number(/^KEY-(\d+)$/.exec(String(r?.Key ?? ""))?.[1]) || idx + 1;

/**
 * Ghi (thêm/sửa) nhiều sản phẩm lên `bds_products`.
 * Nhận dữ liệu hình dạng cũ (MaKhu/TenKhu/TenTang…) và tự quy đổi danh mục sang uuid
 * THEO ĐÚNG dự án / khu của từng dòng.
 * Trả về số dòng đã ghi; ném lỗi khi Cloud từ chối (dùng cho import).
 */
export const upsertBdsProducts = async (
  rows: any[],
  kind?: string,
  fallbackMaDA?: any,
  onWarnings?: (w: ImportCatalogWarning[]) => void,
  onRowResults?: (r: ImportRowResult[]) => void
): Promise<number> => {
  const ma_ctdk = sessionCompanyId();
  if (!ma_ctdk) throw new Error("Chưa xác định công ty đăng ký trong phiên đăng nhập");
  if (!rows?.length) return 0;

  const idx = await loadCatalogIndex(ma_ctdk);
  const projectCache = new Map<string, string>();
  const projectId = async (v: any) => {
    const key = String(v ?? "");
    if (projectCache.has(key)) return projectCache.get(key)!;
    const id = await resolveProjectId(v);
    projectCache.set(key, id);
    return id;
  };

  const warnMap = new Map<string, ImportCatalogWarning>();
  const addWarn = (field: string, value: any, rowNo: number) => {
    const v = String(value ?? "").trim();
    if (!v) return;
    const key = `${field}::${v.toLowerCase()}`;
    const cur = warnMap.get(key) || { field, value: v, rows: [] };
    if (cur.rows.length < 20) cur.rows.push(rowNo);
    warnMap.set(key, cur);
  };

  /** payload đi kèm khóa dòng để báo kết quả từng dòng về màn hình import */
  const payload: { key: string; kyHieu: string; row: any }[] = [];
  const results: ImportRowResult[] = [];
  const addResult = (
    key: string,
    kyHieu: string,
    status: "success" | "error",
    note: string
  ) => results.push({ Key: key, KyHieu: kyHieu, Status: status, Note: note });

  const seen = new Set<string>();
  for (const [i, r] of rows.entries()) {
    const rowNo = importRowNo(r, i);
    const rowKey = String(r?.Key ?? `KEY-${rowNo}`);
    const ky_hieu = txt(pickFirst(r, ["KyHieu", "MaSoSP", "MaCan", "MaSP"]));
    if (!ky_hieu) {
      addResult(rowKey, "", "error", "Thiếu Ký hiệu");
      continue;
    }
    const ma_da = await projectId(pickFirst(r, ["MaDA", "MaDuAn"]) ?? fallbackMaDA);
    if (!ma_da) {
      addResult(rowKey, ky_hieu, "error", "Không xác định được dự án");
      continue;
    }
    const dedupeKey = `${ma_da}::${ky_hieu.toUpperCase()}`;
    if (seen.has(dedupeKey)) {
      addResult(rowKey, ky_hieu, "error", "Trùng Ký hiệu trong file");
      continue;
    }
    seen.add(dedupeKey);

    const base = toBdsProductRow(r, kind ?? r?.FormCode);

    /**
     * Ô danh mục có dữ liệu nhưng không khớp danh mục của đúng dự án/khu
     * → ghi nhận lỗi cho DÒNG này (dòng sẽ không được lưu).
     * Ô để trống thì bỏ qua, không tính là lỗi.
     */
    const rowErrors: string[] = [];
    const hinhThucRaw = r?.HinhThucKD;
    if (hinhThucRaw != null && String(hinhThucRaw).trim() !== "" && !parseHinhThucKd(hinhThucRaw))
      rowErrors.push(`Loại hình chỉ nhận Bán / Cho thuê: ${String(hinhThucRaw).trim()}`);
    const resolve = (
      field: string,
      type: string,
      vals: any[],
      scope: CatScope
    ): string | null => {
      const { id, missing, notInstalled } = catUidScoped(idx, type, scope, vals);
      if (!id && missing != null) {
        // Danh mục chưa cài cho dự án/khu ⇒ bỏ qua giá trị, chỉ cảnh báo; đã cài mà không khớp ⇒ lỗi dòng
        if (notInstalled) {
          addWarn(`${field} (chưa cài danh mục)`, missing, rowNo);
        } else {
          addWarn(field, missing, rowNo);
          rowErrors.push(`Không tồn tại ${field}: ${String(missing).trim()}`);
        }
      }
      return id;
    };

    // Khu phải xác định trước để làm phạm vi cho các danh mục con
    const ma_khu = resolve("Khu", CATALOG_TYPES.zones, [base.ma_khu, r?.MaKhu, r?.TenKhu], {
      projectId: ma_da,
    });
    const scope: CatScope = { projectId: ma_da, zoneId: ma_khu };

    /**
     * Khu quy hoạch / Tiêu chuẩn bàn giao (theo dự án): chỉ gửi khóa khi dòng có giá trị và khớp danh mục,
     * không khớp thì giữ giá trị đang có (danh mục chưa cài chỉ cảnh báo, đã cài mà sai tên ⇒ lỗi dòng).
     */
    const optionalCatalog = (col: string, field: string, type: string, vals: any[]) => {
      if (!vals.some((v) => v != null && String(v).trim() !== "")) return {};
      const id = resolve(field, type, vals, { projectId: ma_da });
      return id ? { [col]: id } : {};
    };

    const row = {
      ...base,
      ma_da,
      ky_hieu,
      ma_sp: base.ma_sp ?? ky_hieu,
      ma_khu,
      ma_pk: resolve("Phân khu", CATALOG_TYPES.subZones, [base.ma_pk, r?.MaPK, r?.TenPK], scope),
      ma_tang: resolve(
        "Tầng",
        CATALOG_TYPES.floors,
        [base.ma_tang, r?.MaTang, r?.TenTang, r?.Tang],
        scope
      ),
      ma_lch: resolve(
        "Loại căn hộ",
        CATALOG_TYPES.apartmentTypes,
        [base.ma_lch, r?.MaLCH, r?.TenLoaiCanHo, r?.TenLoaiMau],
        scope
      ),
      ma_lhbds: resolve(
        "Loại BĐS",
        CATALOG_TYPES.propertyTypes,
        [base.ma_lhbds, r?.MaLHBDS, r?.TenLBDS],
        scope
      ),
      ma_so_pn: resolve(
        "Số phòng ngủ",
        CATALOG_TYPES.bedrooms,
        [base.ma_so_pn, r?.MaSoPN, r?.TenLoaiPN, r?.SoPN],
        scope
      ),
      huong_cua: resolve(
        "Hướng cửa",
        CATALOG_TYPES.directions,
        [base.huong_cua, r?.HuongCua, r?.TenHuongCua],
        scope
      ),
      huong_bc: resolve(
        "Hướng ban công",
        CATALOG_TYPES.directions,
        [base.huong_bc, r?.HuongBC, r?.TenHuongBC],
        scope
      ),
      view_id: resolve(
        "View",
        CATALOG_TYPES.views,
        [base.view_id, r?.ViewID, r?.TenView, r?.TenVeiw],
        scope
      ),
      vi_tri: resolve(
        "Vị trí",
        CATALOG_TYPES.locations,
        [base.vi_tri, r?.ViTri, r?.TenViTri, r?.TenVT],
        scope
      ),
      ma_tt: resolve("Trạng thái", CATALOG_TYPES.statuses, importStatusCandidates(base, r), scope),
      ma_mau_nha: resolve(
        "Mẫu nhà",
        CATALOG_TYPES.houseModels,
        [base.ma_mau_nha, r?.MaMauNha, r?.MauNha],
        scope
      ),
      ...optionalCatalog("ma_khu_qh", "Khu quy hoạch", CATALOG_TYPES.planningZones, [base.ma_khu_qh, r?.MaKhuQH, r?.TenKhuQH]),
      ...optionalCatalog("ma_tieu_chuan_bg", "Tiêu chuẩn bàn giao", CATALOG_TYPES.handoverStandards, [base.ma_tieu_chuan_bg, r?.MaTieuChuanBG, r?.TenTieuChuanBG]),
    };

    if (rowErrors.length) {
      addResult(rowKey, ky_hieu, "error", rowErrors.join("; "));
      continue;
    }
    payload.push({ key: rowKey, kyHieu: ky_hieu, row });
  }
  if (warnMap.size && onWarnings) onWarnings(Array.from(warnMap.values()));
  if (!payload.length) {
    onRowResults?.(results);
    return 0;
  }

  let saved = 0;
  // Ghi qua RPC fn_bds_product_import (quyền form + phạm vi dự án + danh mục cùng công ty kiểm ở máy chủ);
  // mỗi dòng có kết quả riêng nên không phải chia đôi lô để dò dòng lỗi.
  const formCode = String(kind ?? rows[0]?.FormCode ?? "").toUpperCase();
  for (let i = 0; i < payload.length; i += 500) {
    const part = payload.slice(i, i + 500);
    const { data, error } = await supabase.rpc("fn_bds_product_import" as any, {
      p_form_code: formCode,
      p_rows: part.map((p) => ({ key: p.key, row: p.row })),
    } as any);
    if (error) {
      const note = String(error.message || "").trim() || "Lỗi ghi dữ liệu";
      part.forEach((p) => addResult(p.key, p.kyHieu, "error", note));
      continue;
    }
    const res: any = data || {};
    saved += Number(res.saved ?? 0);
    (Array.isArray(res.results) ? res.results : []).forEach((r: any) =>
      addResult(String(r?.key ?? ""), String(r?.ky_hieu ?? ""), r?.status === "success" ? "success" : "error",
        String(r?.note ?? ""))
    );
  }
  onRowResults?.(results);
  return saved;
};
