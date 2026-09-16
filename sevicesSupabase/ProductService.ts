import axiosApiSupabase from "./axiosApiSupabase";
import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

/**
 * Chuẩn hoá 1 row bds_products (snake_case) → shape UI cũ (PascalCase).
 * Giữ tương thích với các màn hình đang dùng MaSP, KyHieu, MaTT…
 */
function normalizeProduct(r: any) {
  const v = (col: any) => (col === "" ? null : col ?? null);
  // Tên khu/tầng/trạng thái/dự án lấy qua FK joins (cloud_catalogs + da_projects)
  const da = r?.da;
  const khu = r?.khu;
  const pk = r?.pk;
  const tang = r?.tang;
  const tt = r?.tt;
  return {
    MaSP: v(r?.ma_sp),
    KyHieu: v(r?.ky_hieu),
    MaDA: v(r?.ma_da),
    TenDA: v(da?.ten_da),
    DiaChi: v(da?.dia_chi),
    AnhDA: v(da?.image_url),
    MaKhu: v(r?.ma_khu),
    TenKhu: v(khu?.item_name ?? khu?.item_code),
    MaPK: v(r?.ma_pk),
    TenPK: v(pk?.item_name ?? pk?.item_code),
    MaTT: v(r?.ma_tt),
    TenTT: v(tt?.item_name),
    ColorTT: v(tt?.color_code),
    FormCode: v(r?.form_code),
    DienTich: v(r?.dien_tich),
    DienTichThongThuy: v(r?.dien_tich_thong_thuy),
    // Alias UI màn chi tiết đang dùng
    DTThongThuy: v(r?.dien_tich_thong_thuy),
    DTTimDuong: v(r?.dt_tim_duong),
    SoCanHo: v(r?.so_can_ho),
    DonGia: v(r?.don_gia),
    DonGiaChuaVAT: v(r?.don_gia_chua_vat),
    DonGiaDaVAT: v(r?.don_gia_da_vat),
    DonGiaGomVAT: v(r?.don_gia_gom_vat),
    TyLeVAT: v(r?.ty_le_vat),
    TienVAT: v(r?.tien_vat),
    TongGia: v(r?.tong_gia),
    TongGiaChuaVAT: v(r?.tong_gia_chua_vat),
    TongGiaDaVAT: v(r?.tong_gia_da_vat),
    // Fallback: nhiều căn chưa có tong_gia_gom_vat/tong_gia_tri_hdmb → dùng tong_gom_pbt
    TongGiaGomVAT: v(r?.tong_gia_gom_vat ?? r?.tong_gom_pbt),
    TongGiaTriHDMB: v(r?.tong_gia_tri_hdmb ?? r?.tong_gom_pbt),
    TongThanhToan: v(r?.tong_thanh_toan),
    TongGomPBT: v(r?.tong_gom_pbt),
    TongTienSDD: v(r?.tong_tien_sdd),
    TyLePhiBaoTri: v(r?.ty_le_phi_bao_tri),
    TienPhiBaoTri: v(r?.tien_phi_bao_tri),
    // Phí bảo trì: web dùng fallback tien_pbt ?? tien_phi_bao_tri
    PhiBaoTri: v(r?.tien_pbt ?? r?.tien_phi_bao_tri),
    TienPBT: v(r?.tien_pbt),
    // Web luôn render nút "Book ngay" (bật/tắt theo checkBooking + thời gian lock,
    // không dùng ma_tt/form_code). Mobile: luôn hiển thị.
    isHienThiBook: true,
    TenHuongCua: v(r?.ten_huong_cua),
    TenHuongBC: v(r?.ten_huong_bc),
    HuongCua: v(r?.huong_cua),
    HuongBC: v(r?.huong_bc),
    TenViTri: v(r?.ten_vi_tri),
    ViTri: v(r?.vi_tri),
    Tang: v(tang?.item_name ?? tang?.item_code),
    MaTang: v(r?.ma_tang),
    TenTang: v(tang?.item_name ?? tang?.item_code),
    SoTang: v(r?.so_tang),
    SoPN: v(r?.so_pn),
    TenLoaiPN: v(r?.ten_loai_pn),
    TenLoaiCanHo: v(r?.ten_loai_can_ho),
    MaMauNha: v(r?.ma_mau_nha),
    MauNha: v(r?.mau_nha),
    MaSan: v(r?.ma_san),
    SanGiaoDich: v(r?.san_giao_dich),
    KhachHang: v(r?.khach_hang),
    HinhAnh: v(r?.hinh_anh),
    GhiChu: v(r?.ghi_chu),
    MauNen: v(r?.mau_nen),
    STT: v(r?.stt),
    Huong: v(r?.huong),
    LoaiBDS: v(r?.loai_bds),
    IsView: r?.is_view ?? null,
    ThoiGianConLai: r?.thoi_gian_con_lai ?? null,
    NgayNhap: r?.ngay_nhap ?? r?.created_at ?? null,
    NgaySua: r?.ngay_sua ?? r?.updated_at ?? r?.created_at ?? null,
    // Thấp tầng / phân lô
    Khu: v(r?.khu),
    SoO: v(r?.so_o),
    DienTichDat: v(r?.dien_tich_dat),
    DienTichXD: v(r?.dien_tich_xd),
    DonGiaDat: v(r?.don_gia_dat),
    TongGiaDat: v(r?.tong_gia_dat),
    LayerId: v(r?.layer_id),
    // Giữ nguyên row gốc để debug
    _raw: r,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ảnh dự án mặc định khi sản phẩm/dự án chưa có ảnh
const DEFAULT_BANNER = {
  HinhAnh:
    "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm",
};

/**
 * Columns cần select từ bds_products — chỉ lấy những cột UI mobile cần dùng
 * để giảm payload (bảng bds_products có ~80 cột).
 */
// Chỉ cột THẬT trong bds_products (87 cột). Cột ten_* chỉ có qua join.
const PRODUCT_SELECT = [
  "id",
  "ma_sp",
  "ky_hieu",
  "so_can_ho",
  "dien_tich",
  "dien_tich_thong_thuy",
  "don_gia_chua_vat",
  "tong_gia_gom_vat",
  "tong_gia_tri_hdmb",
  "tien_pbt",
  "tong_gom_pbt",
  "tong_thanh_toan",
  "ma_da",
  "ma_khu",
  "ma_pk",
  "ma_tt",
  "ma_tang",
  "vi_tri",
  "form_code",
  "hinh_anh",
  "mau_nen",
  "is_view",
  "stt",
  "huong_cua",
  "huong_bc",
  "view_id",
  "san_giao_dich",
  "ma_san",
  "khach_hang",
  "ngay_nhap",
  "ngay_sua",
  "ty_le_vat",
  "tien_vat",
  "ty_le_phi_bao_tri",
  "tien_phi_bao_tri",
  "tong_tien_sdd",
  "tien_dat",
  "don_gia_dat",
  "tong_gia_dat",
  "created_at",
  "updated_at",
  // FK joins — lấy tên từ cloud_catalogs
  "da:ma_da(id,ten_da,dia_chi,image_url)",
  "khu:ma_khu(id,item_code,item_name)",
  "pk:ma_pk(id,item_code,item_name)",
  "tang:ma_tang(id,item_code,item_name)",
  "tt:ma_tt(id,item_name,color_code)",
].join(",");

export const ProductService = {
  /**
   * Map ma_da_code (text, vd "148") → da_projects.id (uuid).
   * bds_products.ma_da là UUID nên bắt buộc phải resolve trước khi filter.
   */
  resolveProjectUuid: async (maDA: any): Promise<string | null> => {
    if (maDA == null || maDA === "" || maDA === -1) return null;
    const value = String(maDA).trim();
    if (UUID_RE.test(value)) return value;
    try {
      const res = await axiosApiSupabase.get("rest/v1/da_projects", {
        params: { select: "id", ma_da_code: `eq.${value}`, limit: "1" },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
      console.log("ERROR resolveProjectUuid (da_projects):", error);
      return null;
    }
  },

  /**
   * Danh sách sản phẩm — cloud (bds_products).
   * Payload tương thích shape cũ: { MaDA, MaKhu, MaPK, MaTT, KyHieu, Limit, offSet }
   */
  getProducts: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Product] chưa có cloud_jwt, bỏ qua bds_products");
      return { data: [] };
    }

    try {
      const limit = payload?.Limit ?? payload?.limit ?? 50;
      const offset = payload?.offSet ?? payload?.offset ?? 0;

      // Web AI: order created_at desc (không dùng stt), phân trang offset/limit
      const params: Record<string, string> = {
        select: PRODUCT_SELECT,
        order: "created_at.desc",
        limit: String(limit),
        offset: String(Math.max(0, Number(offset) - 1)), // legacy offSet is 1-based
      };

      // ma_ctdk filter (tenant isolation)
      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk = `eq.${companyId}`;
      }

      // Project filter — ma_da là UUID nên resolve ma_da_code trước
      const maDA = payload?.MaDA ?? payload?.maDA;
      if (maDA != null && maDA !== "" && maDA !== -1) {
        const projectUuid = await ProductService.resolveProjectUuid(maDA);
        if (!projectUuid) {
          console.log(`[Product] không tìm thấy dự án với ma_da_code=${maDA}`);
          return { data: [], total: 0 };
        }
        params.ma_da = `eq.${projectUuid}`;
      }

      // Web AI: filter MaKhu/MaPK/MaTT chỉ áp khi là uuid ("-1"/"all"/rỗng bị bỏ qua)
      const isUuid = (val: any) => val && UUID_RE.test(String(val).trim());

      // Block/area filter
      const maKhu = payload?.MaKhu ?? payload?.maKhu;
      if (isUuid(maKhu)) {
        params.ma_khu = `eq.${String(maKhu).trim()}`;
      }

      // Sub-block filter
      const maPK = payload?.MaPK ?? payload?.maPK;
      if (isUuid(maPK)) {
        params.ma_pk = `eq.${String(maPK).trim()}`;
      }

      // Status filter — ma_tt là FK uuid
      const maTT = payload?.MaTT ?? payload?.maTT;
      if (isUuid(maTT)) {
        params.ma_tt = `eq.${String(maTT).trim()}`;
      }

      // Web AI: form_code chỉ có 'CAOTANG' | 'THAPTANG' | null
      const formCode = payload?.FormCode ?? payload?.formCode;
      if (formCode && String(formCode).trim()) {
        params.form_code = `eq.${String(formCode).trim()}`;
      }

      // Web AI: search or=(ky_hieu,ma_sp,so_can_ho) ilike
      const keyword =
        payload?.InputSearch ??
        payload?.KyHieu ??
        payload?.kyHieu ??
        payload?.keyword;
      const kw = String(keyword ?? "").trim();
      if (kw) {
        const safe = kw.replace(/[,()]/g, "");
        params.or = `ky_hieu.ilike.*${safe}*,ma_sp.ilike.*${safe}*,so_can_ho.ilike.*${safe}*`;
      }

      const res = await axiosApiSupabase.get("rest/v1/bds_products", {
        params,
        headers: { Prefer: "count=exact" },
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.map(normalizeProduct);

      // Parse total count from Content-Range header
      const range = res.headers?.["content-range"] || "";
      const total = range.includes("/")
        ? Number(range.split("/").pop()) || data.length
        : data.length;

      return { data, total };
    } catch (error) {
      console.log("ERROR getProducts (bds_products):", error);
      return { data: [] };
    }
  },

  /**
   * Danh sách khu vực (block) theo dự án — cloud.
   * Lấy từ cloud_catalogs (catalog_type = khu) theo công ty.
   */
  getKhuVuc: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Product] chưa có cloud_jwt, bỏ qua getKhuVuc");
      return { data: [] };
    }

    try {
      // Web AI: khu lọc theo ma_ctdk_uid + catalog_type=khu + da_project_id (uuid).
      // KHÔNG dùng parent_code (chỉ là mã cũ "1"/"4" trùng giữa các dự án → A1 A1 A2 A2).
      const params: Record<string, string> = {
        select: "id,item_code,item_name",
        catalog_type: "eq.khu",
        order: "created_at.asc",
        limit: "200",
      };

      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk_uid = `eq.${companyId}`;
      }

      const maDA = payload?.MaDA ?? payload?.maDA;
      if (maDA != null && maDA !== "" && maDA !== -1) {
        const projectUuid = await ProductService.resolveProjectUuid(maDA);
        if (!projectUuid) {
          console.log(`[KhuVuc] không tìm thấy dự án với ma_da_code=${maDA}`);
          return { data: [] };
        }
        params.da_project_id = `eq.${projectUuid}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params,
      });

      const rows = Array.isArray(res.data) ? res.data : [];

      // Dedupe theo id (tránh A1 A1 A2 A2)
      const seen = new Set<string>();
      const unique = rows.filter((r: any) => {
        if (!r?.id || seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      // Normalize to legacy shape: { MaKhu, TenKhu }
      const data = unique.map((r: any) => ({
        MaKhu: r.id,
        TenKhu: r.item_name || r.item_code || r.id,
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getKhuVuc (cloud_catalogs khu):", error);
      return { data: [] };
    }
  },

  /**
   * Chi tiết sản phẩm — cloud (bds_products single row).
   * payload: { MaSP } hoặc { maSP }
   */
  getDetailProducts: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Product] chưa có cloud_jwt, bỏ qua getDetailProducts");
      return { data: null };
    }

    try {
      const maSP = payload?.MaSP ?? payload?.maSP;
      if (!maSP) return { data: null };

      const params: Record<string, string> = {
        select: PRODUCT_SELECT,
        ma_sp: `eq.${maSP}`,
        limit: "1",
      };

      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk = `eq.${companyId}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/bds_products", {
        params,
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.length > 0 ? normalizeProduct(rows[0]) : null;

      return { data };
    } catch (error) {
      console.log("ERROR getDetailProducts (bds_products):", error);
      return { data: null };
    }
  },

  /**
   * Ảnh sản phẩm — cloud (bds_products.hinh_anh).
   * Cloud chưa có bảng gallery ảnh riêng; chỉ có 1 cột hinh_anh (có thể
   * chứa nhiều URL phân cách bởi dấu phẩy). Trả shape cũ: { data: [{ HinhAnh }] }
   */
  getBannerProduct: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) return { data: [DEFAULT_BANNER] };

    try {
      const maSP = payload?.maSP ?? payload?.MaSP;
      if (!maSP) return { data: [DEFAULT_BANNER] };

      const params: Record<string, string> = {
        select: "hinh_anh,da:ma_da(image_url)",
        ma_sp: `eq.${maSP}`,
        limit: "1",
      };
      if (companyId && UUID_RE.test(companyId)) {
        params.ma_ctdk = `eq.${companyId}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/bds_products", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      const raw = String(rows[0]?.hinh_anh || "");
      let urls = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Fallback: không có ảnh SP → lấy ảnh dự án → cuối cùng dùng ảnh mặc định
      if (urls.length === 0 && rows[0]?.da?.image_url) {
        urls = [String(rows[0].da.image_url)];
      }
      if (urls.length === 0) {
        return { data: [DEFAULT_BANNER] };
      }

      return { data: urls.map((u) => ({ HinhAnh: u })) };
    } catch (error) {
      console.log("ERROR getBannerProduct (bds_products):", error);
      return { data: [DEFAULT_BANNER] };
    }
  },

  /**
   * Danh sách sàn giao dịch — cloud (dm_companies is_san=true).
   * Chuẩn hoá về { ID, MaSan, MaCT, TenSan, TenCT } khớp với normalizeSanGiaoDich trên web.
   */
  getSanGiaoDichAPI: async () => {
    try {
      const companyId = await getCompanyId();
      const validJwt = await getValidSupabaseJwt();
      if (!validJwt) return { data: [] };

      const params: Record<string, string> = {
        select:
          "id,ten_ct,ten_ct_vt,dia_chi,dien_thoai,fax,email,ma_so_thue,ma_dl,is_san,ap_dung,parent_id",
        is_san: "eq.true",
        order: "ten_ct_vt.asc",
      };

      if (companyId && UUID_RE.test(companyId)) {
        params.tenant_company_id = `eq.${companyId}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/dm_companies", {
        params,
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.map((r: any) => ({
        ID: r.id,
        MaSan: r.ma_dl || r.id,
        MaCT: r.ma_dl || r.id,
        TenSan: r.ten_ct_vt || r.ten_ct || "",
        TenCT: r.ten_ct_vt || r.ten_ct || "",
        DiaChi: r.dia_chi || "",
        DienThoai: r.dien_thoai || "",
        Email: r.email || "",
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getSanGiaoDichAPI:", error);
      return { data: [] };
    }
  },

  /**
   * Chi tiết giữ chỗ — giữ legacy API (workflow phức tạp).
   */
  getGiuCho: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = { TenCTDKVT: tenCTDKVT, ...payload };
    return await axiosApi
      .post("api/admin/giu-cho-chi-tiet", dataInit)
      .then((res) => res.data);
  },

  /**
   * Duyệt giữ chỗ — giữ legacy API (write operation).
   */
  postDuyet: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = { TenCTDKVT: tenCTDKVT, ...payload };
    return await axiosApi
      .post("api/admin/giu-cho/xuly", dataInit)
      .then((res) => res.data);
  },
};