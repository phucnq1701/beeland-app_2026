// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/salesDocsCloud.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * salesDocsCloud — lớp dùng chung cho 2 bảng chứng từ bán hàng:
 *   public.cloud_pgc_phieu_giucho (vòng đời giữ chỗ → cọc → góp vốn → HĐMB)
 *   public.cloud_deposits         (phiếu đặt cọc)
 *
 * NGUYÊN TẮC: mọi truy vấn/ghi đều đi qua các cột UUID có ràng buộc khóa ngoại
 *   ma_ctdk_uid  → cloud_companies.id   (lấy từ token đăng nhập)
 *   da_project_id→ da_projects.id
 *   san_pham_id  → bds_products.id
 *   khach_hang_id→ cloud_customers.id
 *   trang_thai_id→ cloud_catalogs.id (bds_trang_thai / pgc_trang_thai)
 *
 * Các cột chữ cũ (ma_ctdk, ma_da, ma_sp, ky_hieu, ho_ten_kh, ma_tt, ten_tt…)
 * đã bị xóa khỏi 2 bảng; giá trị hiển thị lấy bằng JOIN rồi map lại tên cũ
 * qua `mapSalesDoc` để màn hình cũ không phải sửa.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId, sessionMaNV } from "../_shims/lib/session";
import { getCustomersByRefs } from "./customers/customer-lookup";
import { statusColorOf } from "./system/status-catalog";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: any) => !!v && UUID_RE.test(String(v).trim());

/** UUID công ty đăng ký lấy từ token đăng nhập */
export const salesTenantUid = (): string => sessionCompanyId();

/**
 * Select cho phiếu giữ chỗ (cloud_pgc_phieu_giucho). KHÔNG embed khách: bảng cloud_customers đã khoá đọc thẳng (Đợt 5) —
 * nơi đọc gọi `withCustomers(rows)` (services/customers/customer-lookup) để gắn `kh` qua RPC trước khi `mapSalesDoc`.
 */
export const PGC_SELECT =
  "*, sp:bds_products!san_pham_id(id,ma_sp,ky_hieu,ma_da), da:da_projects!project_id(id,ten_da,ma_da_code), san:dm_companies!san_id(id,ten_ct,ten_ct_vt), tt:cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code)" +
  // lịch từ bảng cloud_pgc_dot_thanh_toan (trường tính toán lich_tt); khi cột cũ còn, khoá trùng tên → JSON.parse lấy giá trị cuối này
  ",lich_thanh_toan:lich_tt";

/** Select cho phiếu đặt cọc (cloud_deposits) — chỉ còn khóa ngoại tối thiểu */
export const DEPOSIT_SELECT =
  "*, da:da_projects!da_project_id(id,ten_da,ma_da_code), tt:cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code), nn:dm_employees!nguoi_nhap_id(id,ma_nv,ho_ten), ns:dm_employees!nguoi_sua_id(id,ma_nv,ho_ten), pgc:cloud_pgc_phieu_giucho!phieu_giu_cho_id(" +
  PGC_SELECT +
  ")";

/** Select cho hợp đồng mua bán / góp vốn (cloud_contracts) */
export const CONTRACT_SELECT = DEPOSIT_SELECT;

/**
 * Map 1 dòng cloud_contracts (đã JOIN vòng đời) về khuôn dữ liệu cũ mà
 * màn hình Hợp đồng đang dùng.
 */
export const mapContractRow = (r: any, totalRows = 0): any => {
  if (!r) return r;
  const base = mapDepositRow(r, totalRows);
  const loaiCT = r.loai_ct === "HDGV" ? "HDGV" : "HDMB";
  return {
    ...base,
    ID: r.id,
    MaHDMB: r.id,
    MaHD: r.id,
    LoaiCT: loaiCT,
    ...(loaiCT === "HDGV" ? { SoHDVV: r.so_hdmb } : { SoHDMB: r.so_hdmb }),
    SoPhieu: r.so_hdmb,
    NgayKy: r.ngay_ky,
    NgayDatCoc: r.ngay_ky,
    SoTien: r.so_tien ?? 0,
    GhiChu: r.ghi_chu ?? null,
    TotalRows: totalRows,
  };
};

/** @deprecated dùng PGC_SELECT hoặc DEPOSIT_SELECT */
export const SALES_DOC_SELECT = PGC_SELECT;

/** Map bản ghi có JOIN về đúng tên trường cũ mà giao diện đang dùng */
export const mapSalesDoc = (r: any): any => {
  if (!r) return r;
  const sp = r.sp || {};
  const da = r.da || {};
  const kh = r.kh || {};
  const tt = r.tt || {};
  const daCode = da?.ma_da_code ?? null;
  return {
    ...r,
    ma_da: daCode ?? da?.ma_da ?? da?.id ?? r.da_project_id ?? null,
    ten_da: da?.ten_da ?? null,
    ma_sp: sp?.ma_sp ?? null,
    ky_hieu: sp?.ky_hieu ?? null,
    ma_kh: kh?.id ?? null,
    ma_so_kh: kh?.ma_so_kh ?? null,
    ho_ten_kh: kh?.ten_kh ?? kh?.ten_cong_ty ?? null,
    so_cmnd: kh?.cccd ?? null,
    di_dong: kh?.dien_thoai ?? null,
    email: kh?.email ?? null,
    dia_chi: kh?.dia_chi ?? null,
    ma_tt: tt?.item_code ?? null,
    ten_tt: tt?.item_name ?? null,
    color_code: statusColorOf(tt?.id, tt?.color_code ?? null),
    MauNen: statusColorOf(tt?.id, tt?.color_code ?? null),
  };
};

export const mapSalesDocs = (rows: any[] | null | undefined): any[] =>
  (rows || []).map(mapSalesDoc);

/**
 * Map 1 dòng cloud_deposits (đã JOIN phiếu giữ chỗ + sản phẩm + khách hàng)
 * về đúng khuôn dữ liệu cũ mà màn hình Đặt cọc đang dùng.
 */
export const mapDepositRow = (r: any, totalRows = 0): any => {
  if (!r) return r;
  const pgc = r.pgc ? mapSalesDoc(r.pgc) : {};
  // Trạng thái luôn lấy theo phiếu giữ chỗ (danh mục `pgc_trang_thai`).
  // Cột trạng thái trên `cloud_deposits` có dữ liệu cũ trỏ nhầm sang danh mục
  // trạng thái sản phẩm (vd "ĐC chờ duyệt") nên chỉ dùng làm dự phòng.
  const pgcTT = pgc?.ten_tt
    ? {
        item_code: pgc.ma_tt ?? null,
        item_name: pgc.ten_tt,
        color_code: pgc.color_code ?? null,
      }
    : null;
  const tt = pgcTT || r.tt || {};
  const da = r.da || pgc?.da || {};
  const daCode = da?.ma_da_code ?? null;
  const payload = pgc?.payload || {};
  const ttkh = payload?.TTKhachHang || pgc?.tt_khach_hang || {};
  const san = pgc?.san || {};
  return {
    ID: r.id,
    MaDC: r.id,
    MaPGC: r.id,
    PhieuGiuChoId: r.phieu_giu_cho_id ?? null,
    SoPhieu: r.so_phieu,
    NgayDatCoc: r.ngay_coc,
    MaDA: daCode ?? da?.ma_da ?? pgc?.ma_da ?? null,
    /** UUID dự án (da_projects.id) — dùng cho các API theo UUID */
    ProjectId: pgc?.project_id ?? r.da_project_id ?? da?.id ?? null,
    TenDA: da?.ten_da ?? pgc?.ten_da ?? null,
    SanPhamId: pgc?.san_pham_id ?? null,
    KyHieu: pgc?.ky_hieu ?? null,
    MaSanPham: pgc?.ky_hieu ?? null,
    MaSP: pgc?.ma_sp ?? null,
    MaTT: tt?.item_code ?? null,
    TenTT: tt?.item_name ?? null,
    color_code: statusColorOf(tt?.id, tt?.color_code ?? null),
    MauNen: statusColorOf(tt?.id, tt?.color_code ?? null),
    TienCoc: r.so_tien_coc ?? pgc?.tien_coc ?? null,
    DaThu: pgc?.da_thu ?? null,
    PhiBaoTri: pgc?.phi_bao_tri ?? null,
    TongGiaGomVAT: pgc?.gia_tri_hd ?? null,
    TongGiaTriHDMB: pgc?.gia_tri_hd_sau_ck ?? pgc?.gia_tri_hd ?? null,
    DienTich: pgc?.dien_tich ?? null,
    DonGiaTT: pgc?.don_gia_gom_vat ?? null,
    MaKH: pgc?.ma_kh ?? null,
    KhachHangId: pgc?.khach_hang_id ?? null,
    TenKH: pgc?.ho_ten_kh ?? null,
    KhachHang: pgc?.ho_ten_kh ?? null,
    SoCMND: pgc?.so_cmnd ?? null,
    DiDong: pgc?.di_dong ?? null,
    email: pgc?.email ?? null,
    DiaChi: pgc?.dia_chi ?? null,
    NgaySinh: ttkh?.NgaySinh ?? null,
    NgayCap: ttkh?.NgayCap ?? null,
    NoiCap: ttkh?.NoiCap ?? null,
    ThuongTru: ttkh?.ThuongTru ?? null,
    DiDong2: ttkh?.DiDong2 ?? null,
    NguoiCungDungTen: ttkh?.NguoiCungDungTen ?? null,
    SanGD: san?.ten_ct_vt ?? san?.ten_ct ?? null,
    SanId: pgc?.san_id ?? null,
    NguoiTao: r.nn?.ho_ten ?? null,
    NguoiSua: r.ns?.ho_ten ?? null,
    NgayNhap: r.ngay_nhap,
    NgaySua: r.ngay_sua,
    Payload: payload,
    ChinhSach: pgc?.chinh_sach ?? [],
    LichThanhToan: pgc?.lich_thanh_toan ?? [],
    KhuyenMai: pgc?.khuyen_mai ?? [],
    // Các tên hiển thị màn hình danh sách đang dùng
    HoTenKH: pgc?.ho_ten_kh ?? null,
    MaNVKD: payload?.TTHopDong?.MaNVKD ?? pgc?.tt_hop_dong?.MaNVKD ?? null,
    TenNVKD: payload?.TTHopDong?.TenNVKD ?? pgc?.tt_hop_dong?.TenNVKD ?? null,
    TenChinhSach:
      (pgc?.chinh_sach ?? [])[0]?.TenCS ??
      (pgc?.chinh_sach ?? [])[0]?.TenChinhSach ??
      null,
    TenLichThanhToan:
      payload?.TTHopDong?.TenLichThanhToan ??
      (pgc?.lich_thanh_toan ?? [])[0]?.TenLichThanhToan ??
      null,
    TotalRows: totalRows,
  };
};

/**
 * Dựng khuôn chi tiết chứng từ (giống API cũ) từ 1 dòng đã map
 * (mapDepositRow / mapContractRow). Dùng chung cho phiếu đặt cọc và
 * hợp đồng mua bán / góp vốn để form sửa nạp lại đúng giá trị đã lưu.
 */
export const buildSalesDocDetail = (m: any, rawRow?: any): any => {
  if (!m) return null;
  const payload = m.Payload || {};
  const pgcRow = rawRow?.pgc || rawRow || {};
  const hd = payload.TTHopDong || pgcRow?.tt_hop_dong || {};
  const kh = payload.TTKhachHang || pgcRow?.tt_khach_hang || {};
  return {
    status: 2000,
    ttHopDong: {
      ...hd,
      MaPGC: m.ID,
      MaPDC: m.ID,
      SoPhieu: m.SoPhieu ?? hd.SoPhieu,
      NgayKy: hd.NgayKy ?? m.NgayKy ?? m.NgayDatCoc,
      MaDA:
        hd.MaDA ??
        (m.MaDA == null
          ? null
          : /^\d+$/.test(String(m.MaDA).trim())
          ? Number(m.MaDA)
          : m.MaDA),
      MaSP: hd.MaSP ?? m.MaSP,
      MaCan: hd.MaCan ?? m.KyHieu,
      TienCoc: hd.TienCoc ?? m.TienCoc,
      GhiChu: hd.GhiChu ?? m.GhiChu ?? null,
      TenTT: m.TenTT,
      ...(m.LoaiCT ? { LoaiCT: m.LoaiCT } : {}),
    },
    ttKhachHang: Object.keys(kh).length
      ? kh
      : { TenKH: m.TenKH, HoTen: m.TenKH, SoCMND: m.SoCMND, DiDong: m.DiDong },
    ttSanPham: payload.TTSanPham || {
      MaSoSP: m.KyHieu,
      MaSP: m.MaSP,
      TenDA: m.TenDA,
      DienTich: m.DienTich,
    },
    chinhSach: payload.ChinhSach ?? m.ChinhSach ?? [],
    lichThanhToan: payload.LichThanhToan ?? m.LichThanhToan ?? [],
    khuyenMai: payload.KhuyenMai ?? m.KhuyenMai ?? [],
    __fromCloud: true,
  };
};

/** UUID hồ sơ nhân viên đang đăng nhập (dm_employees) */
export const resolveEmployeeUid = async (): Promise<string | null> => {
  const uid = salesTenantUid();
  const maNV = sessionMaNV();
  if (!uid || !maNV) return null;
  return remember(`nv:${uid}:${maNV}`, async () => {
    const { data } = await supabase
      .from("dm_employees" as any)
      .select("id")
      .eq("ma_nv", maNV)
      .limit(1)
      .maybeSingle();
    return (data as any)?.id ?? null;
  });
};

/* --------------------------- Tra cứu UUID cha --------------------------- */

const cache = new Map<string, string | null>();
const remember = async (
  key: string,
  fn: () => Promise<string | null>
): Promise<string | null> => {
  if (cache.has(key)) return cache.get(key) ?? null;
  let val: string | null = null;
  try {
    val = await fn();
  } catch {
    val = null;
  }
  cache.set(key, val);
  return val;
};

export const clearSalesDocCache = () => cache.clear();

/** UUID sản phẩm từ id / mã sản phẩm / ký hiệu */
export const resolveProductUid = async (ref: {
  id?: any;
  maSP?: any;
  kyHieu?: any;
}): Promise<string | null> => {
  if (isUuid(ref?.id)) return String(ref.id);
  const uid = salesTenantUid();
  const maSP = ref?.maSP == null ? "" : String(ref.maSP).trim();
  const kyHieu = ref?.kyHieu == null ? "" : String(ref.kyHieu).trim();
  if (!uid || (!maSP && !kyHieu)) return null;
  return remember(`sp:${uid}:${maSP}|${kyHieu}`, async () => {
    let q = supabase
      .from("bds_products" as any)
      .select("id")
      .eq("ma_ctdk", uid)
      .limit(1);
    q = maSP && kyHieu
      ? q.or(`ma_sp.eq.${maSP},ky_hieu.eq.${kyHieu}`)
      : maSP
      ? q.eq("ma_sp", maSP)
      : q.eq("ky_hieu", kyHieu);
    const { data } = await q.maybeSingle();
    return (data as any)?.id ?? null;
  });
};

/**
 * UUID dự án lấy TRỰC TIẾP từ bản ghi sản phẩm (`bds_products.ma_da`).
 * Dùng cho các nghiệp vụ mở từ sản phẩm (lock căn, booking) để dự án luôn
 * đúng theo sản phẩm, không phụ thuộc bộ lọc ngoài lưới.
 */
export const resolveProjectUidByProduct = async (
  productUid: any
): Promise<string | null> => {
  if (!isUuid(productUid)) return null;
  return remember(`da-of-sp:${productUid}`, async () => {
    const { data } = await supabase
      .from("bds_products" as any)
      .select("ma_da")
      .eq("id", String(productUid))
      .limit(1)
      .maybeSingle();
    const v = (data as any)?.ma_da;
    return isUuid(v) ? String(v) : null;
  });
};

/** UUID dự án từ uuid hoặc mã dự án cũ (ma_da_code) */
export const resolveProjectUid = async (maDA: any): Promise<string | null> => {
  if (isUuid(maDA)) return String(maDA);
  const uid = salesTenantUid();
  const key = maDA == null ? "" : String(maDA).trim();
  if (!uid || !key) return null;
  return remember(`da:${uid}:${key}`, async () => {
    const { data } = await supabase
      .from("da_projects" as any)
      .select("id")
      .eq("ma_ctdk", uid)
      .eq("ma_da_code", key)
      .limit(1)
      .maybeSingle();
    return (data as any)?.id ?? null;
  });
};

/** UUID khách hàng từ uuid hoặc mã khách hàng */
export const resolveCustomerUid = async (maKH: any): Promise<string | null> => {
  if (isUuid(maKH)) return String(maKH);
  const key = maKH == null ? "" : String(maKH).trim();
  if (!key) return null;
  return remember(`kh:${key}`, async () => {
    try {
      const rows = await getCustomersByRefs([key]);
      const hit = rows.find((r: any) => String(r?.ma_so_kh ?? "").trim() === key);
      return hit?.id ?? null;
    } catch {
      return null;
    }
  });
};

/** UUID trạng thái theo danh mục dùng chung */
export const resolveStatusUid = async (
  type: "bds_trang_thai" | "pgc_trang_thai",
  codeOrName: any
): Promise<string | null> => {
  const key = codeOrName == null ? "" : String(codeOrName).trim();
  if (!key) return null;
  if (isUuid(key)) return key;
  return remember(`tt:${type}:${key}`, async () => {
    const { data } = await supabase
      .from("cloud_catalogs" as any)
      .select("id,item_code,item_name")
      .eq("catalog_type", type)
      .or(`item_code.eq.${key},item_name.eq.${key}`)
      .limit(1)
      .maybeSingle();
    return (data as any)?.id ?? null;
  });
};

/**
 * Dựng phần khóa ngoại UUID cho một bản ghi chứng từ từ dữ liệu nghiệp vụ cũ.
 * Trả về object chỉ gồm các cột uuid (bỏ qua giá trị không tra được).
 */
export const buildSalesDocRefs = async (src: {
  maDA?: any;
  maSP?: any;
  kyHieu?: any;
  sanPhamId?: any;
  maKH?: any;
  khachHangId?: any;
  trangThai?: any;
  statusType?: "bds_trang_thai" | "pgc_trang_thai";
  /** "pgc" dùng cột project_id/san_pham_id/khach_hang_id; "deposit" chỉ có da_project_id */
  target?: "pgc" | "deposit";
}): Promise<Record<string, any>> => {
  const refs: Record<string, any> = {};
  const uid = salesTenantUid();
  if (uid) refs.ma_ctdk_uid = uid;
  const isDeposit = src.target === "deposit";

  const sanPhamId =
    (isUuid(src.sanPhamId) && String(src.sanPhamId)) ||
    (await resolveProductUid({ maSP: src.maSP, kyHieu: src.kyHieu }));
  if (sanPhamId && !isDeposit) refs.san_pham_id = sanPhamId;

  // Dự án lấy theo chính bản ghi sản phẩm; giá trị truyền vào chỉ là dự phòng
  const projectId =
    (await resolveProjectUidByProduct(sanPhamId)) ??
    (await resolveProjectUid(src.maDA));
  if (projectId) refs[isDeposit ? "da_project_id" : "project_id"] = projectId;

  const khachHangId =
    (isUuid(src.khachHangId) && String(src.khachHangId)) ||
    (await resolveCustomerUid(src.maKH));
  if (khachHangId && !isDeposit) refs.khach_hang_id = khachHangId;


  if (src.trangThai != null && src.trangThai !== "") {
    const ttId = await resolveStatusUid(
      src.statusType || "pgc_trang_thai",
      src.trangThai
    );
    if (ttId) refs.trang_thai_id = ttId;
  }
  return refs;
};

/**
 * Lưu "giá gốc sản phẩm tại thời điểm lập phiếu" vào public.cloud_pgc_san_pham
 * (tương ứng bảng cũ pgcPhieuGiuCho_SanPham). Mỗi cặp (phiếu, sản phẩm) 1 dòng.
 */
export const saveProductPriceSnapshot = async (args: {
  /** uuid phiếu (giữ chỗ/cọc/góp vốn/HĐMB) — bỏ trống khi lập phiếu tính giá */
  lifecycleId?: string;
  /** uuid phiếu tính giá — dùng khi chưa phát sinh chứng từ */
  priceSheetId?: string;
  sanPhamId?: any;
  /** uuid trạng thái phiếu (cloud_catalogs / pgc_trang_thai) */
  trangThaiId?: any;
  /** object GiaTriHopDong (giá gốc, chưa chiết khấu) */
  giaTriHopDong?: any;
}): Promise<string | null> => {
  const lifecycleId = isUuid(args.lifecycleId) ? String(args.lifecycleId) : null;
  const priceSheetId = isUuid(args.priceSheetId) ? String(args.priceSheetId) : null;
  if (!lifecycleId && !priceSheetId) return null;
  const gt = args.giaTriHopDong || {};
  const n = (v: any) => {
    if (v == null || v === "") return null;
    const x = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(x) ? x : null;
  };

  const row: Record<string, any> = {
    phieu_giu_cho_id: lifecycleId,
    // price_sheet_id CHỈ dùng cho dòng của phiếu tính giá.
    // Chứng từ (cọc/góp vốn/HĐMB) không ghi cột này.
    ...(lifecycleId ? {} : { price_sheet_id: priceSheetId }),
    san_pham_id: isUuid(args.sanPhamId) ? String(args.sanPhamId) : null,
    ma_ctdk_uid: salesTenantUid() || null,
    trang_thai_id: isUuid(args.trangThaiId) ? String(args.trangThaiId) : null,
    don_gia_chua_vat: n(gt?.DonGiaChuaVAT),
    tong_gia_chua_vat: n(gt?.TongChuaVAT),
    tong_gia_gom_vat: n(gt?.TongGomVAT),
    vat_can_ho: n(gt?.TienVAT),
    phi_bao_tri: n(gt?.TienPhiBaoTri),
    tong_gia_tri_hdmb: n(gt?.TongGiaGomVATPBT ?? gt?.TongGiaGomDatXD),
    don_gia_dat: n(gt?.DonGiaDat),
    dg_dat_pb: n(gt?.DGDatPB),
    tong_gia_dat_chua_vat: n(gt?.TienDatChuaVAT),
    tien_vat_dat: n(gt?.TienVATDat),
    thanh_tien_dat: n(gt?.TongTienVATDat),
    don_gia_xd: n(gt?.DonGiaXD),
    thanh_tien_xd_chua_vat: n(gt?.TienXDChuaVAT),
    vat_xd: n(gt?.TienVATXD),
    thanh_tien_xd_co_vat: n(gt?.TongTienXDGomVAT),
    gia_naked: n(gt?.GiaNaked),
  };
  if (row.trang_thai_id == null) delete row.trang_thai_id;
  // Giá Naked trống: bỏ khóa để không đè NULL lên giá đã chốt
  if (row.gia_naked == null) delete row.gia_naked;



  try {
    const tbl = () => supabase.from("cloud_pgc_san_pham" as any);
    const findRow = async (by: "pgc" | "sheet") => {
      let q = tbl().select("id");
      q =
        by === "pgc"
          ? (q.eq("phieu_giu_cho_id", lifecycleId) as any)
          : (q.eq("price_sheet_id", priceSheetId) as any);
      q = row.san_pham_id
        ? (q.eq("san_pham_id", row.san_pham_id) as any)
        : (q.is("san_pham_id", null) as any);
      const { data } = await q.limit(1).maybeSingle();
      return data as any;
    };
    // Chứng từ luôn có dòng giá gốc riêng — KHÔNG ghi đè dòng của phiếu tính giá
    const existing = lifecycleId ? await findRow("pgc") : await findRow("sheet");

    if ((existing as any)?.id) {
      const patch = { ...row };
      if (!lifecycleId) delete patch.phieu_giu_cho_id;
      if (lifecycleId || !priceSheetId) delete patch.price_sheet_id;
      const { error } = await tbl().update(patch as any).eq("id", (existing as any).id);
      if (error) throw error;
      return (existing as any).id as string;
    }
    const { data, error } = await tbl().insert(row as any).select("id").maybeSingle();
    if (error) throw error;
    return (data as any)?.id ?? null;
  } catch (e) {
    console.warn("[salesDocsCloud] không lưu được giá gốc sản phẩm:", e);
    return null;
  }
};

/**
 * Khi tạo đặt cọc/góp vốn/HĐMB từ 1 phiếu tính giá: CHÉP dòng giá gốc của phiếu
 * tính giá thành MỘT DÒNG MỚI cho chứng từ (giữ nguyên dòng của phiếu tính giá).
 */
export const attachPriceSheetSnapshot = async (
  priceSheetId: any,
  lifecycleId: any
): Promise<void> => {
  if (!isUuid(priceSheetId) || !isUuid(lifecycleId)) return;
  try {
    const tbl = () => supabase.from("cloud_pgc_san_pham" as any);
    // Đã có dòng của chứng từ → không tạo trùng
    const { data: dup } = await tbl()
      .select("id")
      .eq("phieu_giu_cho_id", String(lifecycleId))
      .limit(1)
      .maybeSingle();
    if ((dup as any)?.id) return;

    const { data: src } = await tbl()
      .select("*")
      .eq("price_sheet_id", String(priceSheetId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!src) return;

    const row: any = { ...(src as any) };
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    row.phieu_giu_cho_id = String(lifecycleId);
    // dòng của chứng từ không giữ liên kết phiếu tính giá
    delete row.price_sheet_id;
    await tbl().insert(row);
  } catch (e) {
    console.warn("[salesDocsCloud] không gắn được giá gốc từ phiếu tính giá:", e);
  }
};

/** Xoá dòng giá gốc theo phiếu (dùng khi xoá phiếu thủ công). */
export const deleteProductPriceSnapshots = async (lifecycleIds: string[]) => {
  const ids = (lifecycleIds || []).filter(isUuid);
  if (!ids.length) return;
  try {
    await supabase.from("cloud_pgc_san_pham" as any).delete().in("phieu_giu_cho_id", ids);
  } catch (e) {
    console.warn("[salesDocsCloud] không xoá được giá gốc sản phẩm:", e);
  }
};

/** Đồng bộ uuid trạng thái xuống dòng giá gốc sản phẩm của phiếu. */
export const syncSnapshotStatus = async (
  lifecycleIds: any[],
  trangThaiId: any
) => {
  const ids = (lifecycleIds || []).map(String).filter(isUuid);
  if (!ids.length || !isUuid(trangThaiId)) return;
  try {
    await supabase
      .from("cloud_pgc_san_pham" as any)
      .update({ trang_thai_id: String(trangThaiId) } as any)
      .in("phieu_giu_cho_id", ids);
  } catch (e) {
    console.warn("[salesDocsCloud] không đồng bộ được trạng thái giá gốc:", e);
  }
};


export default {
  salesTenantUid,
  SALES_DOC_SELECT,
  mapSalesDoc,
  mapSalesDocs,
  buildSalesDocRefs,
  saveProductPriceSnapshot,
  deleteProductPriceSnapshots,
};
