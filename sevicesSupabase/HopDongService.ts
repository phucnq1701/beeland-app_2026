import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chuẩn hoá ngày → ISO. Trả null nếu rỗng. */
function toIsoDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toISOString();
  } catch {
    return String(v);
  }
}

/** DuAn có thể là mảng hoặc chuỗi ",a,b," → mảng id sạch. */
function parseProjectIds(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ma_da_code → da_projects.id (uuid). Bỏ qua nếu đã là uuid. */
async function resolveProjectUuids(ids: string[]): Promise<string[]> {
  const uuids: string[] = [];
  for (const id of ids) {
    if (UUID_RE.test(id)) {
      uuids.push(id);
      continue;
    }
    try {
      const r = await axiosApiSupabase.get("rest/v1/da_projects", {
        params: { select: "id", ma_da_code: `eq.${id}`, limit: "1" },
      });
      const rows = Array.isArray(r.data) ? r.data : [];
      if (rows[0]?.id) uuids.push(rows[0].id);
    } catch {
      // bỏ qua lỗi resolve từng dự án
    }
  }
  return uuids;
}

/**
 * Tìm kiếm 2 bước giống web (keywordPgcIds):
 * 1) cloud_customers (ten_kh, ten_cong_ty, cccd, dien_thoai, ma_so_kh) + bds_products (ky_hieu, ma_sp)
 * 2) cloud_pgc_phieu_giucho (so_phieu_gc.ilike, khach_hang_id.in, san_pham_id.in) → pgc ids
 * Trả về danh sách pgc id khớp để lọc cloud_contracts.phieu_giu_cho_id.
 */
async function resolveSearchPgcIds(keyword: string): Promise<string[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  const like = `%${kw}%`;
  const customerIds: string[] = [];
  const productIds: string[] = [];

  try {
    const c = await axiosApiSupabase.get("rest/v1/cloud_customers", {
      params: {
        select: "id",
        or: `(ten_kh.ilike.${like},ten_cong_ty.ilike.${like},cccd.ilike.${like},dien_thoai.ilike.${like},ma_so_kh.ilike.${like})`,
        limit: "500",
      },
    });
    (Array.isArray(c.data) ? c.data : []).forEach((r: any) => {
      if (r?.id) customerIds.push(r.id);
    });
  } catch (e) {
    console.log("ERROR contract search customers:", e);
  }

  try {
    const p = await axiosApiSupabase.get("rest/v1/bds_products", {
      params: {
        select: "id",
        or: `(ky_hieu.ilike.${like},ma_sp.ilike.${like})`,
        limit: "500",
      },
    });
    (Array.isArray(p.data) ? p.data : []).forEach((r: any) => {
      if (r?.id) productIds.push(r.id);
    });
  } catch (e) {
    console.log("ERROR contract search products:", e);
  }

  const orParts = [`so_phieu_gc.ilike.${like}`];
  if (customerIds.length > 0)
    orParts.push(`khach_hang_id.in.(${customerIds.join(",")})`);
  if (productIds.length > 0)
    orParts.push(`san_pham_id.in.(${productIds.join(",")})`);

  try {
    const pgc = await axiosApiSupabase.get(
      "rest/v1/cloud_pgc_phieu_giucho",
      {
        params: {
          select: "id",
          or: `(${orParts.join(",")})`,
          limit: "1000",
        },
      }
    );
    return (Array.isArray(pgc.data) ? pgc.data : [])
      .map((r: any) => r?.id)
      .filter(Boolean);
  } catch (e) {
    console.log("ERROR contract search pgc:", e);
    return [];
  }
}

/**
 * Map 1 dòng cloud_contracts (kèm embed pgc/kh/sp/da/tt/san) → shape UI cũ
 * (PascalCase) mà app/contracts.tsx và app/contract/[id].tsx đang dùng.
 */
function mapContractRow(r: any) {
  const pgc = r?.pgc || {};
  const kh = pgc?.kh || {};
  const sp = pgc?.sp || {};
  const da = pgc?.da || r?.da || {};
  const tt = pgc?.tt || r?.tt || {};
  const san = pgc?.san || {};

  const tenKH = kh?.ten_kh || kh?.ten_cong_ty || "";
  const giaTriHD = pgc?.gia_tri_hd ?? r?.so_tien ?? 0;
  const giaTriSauCK = pgc?.gia_tri_hd_sau_ck ?? giaTriHD;

  return {
    ...r,
    // khóa dòng
    maHDMB: r?.id,
    MaPGC: r?.id,
    PhieuGiuChoId: r?.phieu_giu_cho_id,
    // lưới
    soHDMB: r?.so_hdmb || "",
    SoHDMB: r?.so_hdmb || "",
    ngayKy: r?.ngay_ky || "",
    NgayKy: r?.ngay_ky || "",
    hoTenKH: tenKH,
    tenKH,
    TenKH: tenKH,
    maSP: sp?.ma_sp || "",
    MaSP: sp?.ma_sp || "",
    kyHieu: sp?.ky_hieu || "",
    KyHieu: sp?.ky_hieu || "",
    tongGiaGomVAT: giaTriHD,
    TongGiaGomVAT: giaTriHD,
    tongGiaTriHDMB: giaTriSauCK,
    TongGiaTriHDMB: giaTriSauCK,
    tenTT: tt?.item_name || "",
    TenTT: tt?.item_name || "",
    maTT: tt?.item_code ?? null,
    MaTT: tt?.item_code ?? null,
    tenDA: da?.ten_da || "",
    TenDA: da?.ten_da || "",
    maDA: da?.ma_da || "",
    MaDA: da?.ma_da || "",
    mauNen: tt?.color_code || "",
    MauNen: tt?.color_code || "",
    soCMND: kh?.cccd || "",
    SoCMND: kh?.cccd || "",
    diDong: kh?.dien_thoai || "",
    DiDong: kh?.dien_thoai || "",
    email: kh?.email || "",
    diaChi: kh?.dia_chi || "",
    maSoKH: kh?.ma_so_kh || "",
    dienTich: pgc?.dien_tich ?? null,
    DienTich: pgc?.dien_tich ?? null,
    donGiaTT: pgc?.don_gia_gom_vat ?? null,
    DonGiaTT: pgc?.don_gia_gom_vat ?? null,
    daThu: pgc?.da_thu ?? 0,
    DaThu: pgc?.da_thu ?? 0,
    phiBaoTri: pgc?.phi_bao_tri ?? 0,
    PhiBaoTri: pgc?.phi_bao_tri ?? 0,
    sanGD: san?.ten_ct_vt || san?.ten_ct || "",
    SanGD: san?.ten_ct_vt || san?.ten_ct || "",
    loaiCT: r?.loai_ct || "HDMB",
    LoaiCT: r?.loai_ct || "HDMB",
    // giữ raw để màn chi tiết dùng lại (giống đặt cọc)
    raw: r,
  };
}

/** Chuẩn hoá 1 dòng lịch thanh toán (JSONB raw) → shape UI. */
function normalizeScheduleRow(raw: any) {
  if (!raw) return null;
  const soTien = Number(raw?.SoTien ?? raw?.so_tien ?? 0);
  const phaiThu = Number(raw?.PhaiThu ?? raw?.phai_thu ?? soTien);
  const daThu = Number(raw?.DaThu ?? raw?.da_thu ?? 0);
  const phaiThuPBT = Number(
    raw?.PhaiThuPBT ?? raw?.PhiBT ?? raw?.phai_thu_pbt ?? 0
  );
  const daThuPBT = Number(raw?.DaThuPBT ?? raw?.da_thu_pbt ?? 0);
  const conNoPBT = Number(raw?.ConNoPBT ?? raw?.con_no_pbt ?? 0);
  return {
    DotTT: raw?.DotTT ?? raw?.Dot ?? raw?.dot_tt ?? null,
    DotTTText: raw?.DotTTText ?? raw?.KieuThanhToan ?? "",
    NgayTT: raw?.NgayTT ?? raw?.ngay_tt ?? "",
    TyLeTT: Number(raw?.TyLeTT ?? raw?.ty_le ?? 0),
    SoTien: soTien,
    PhaiThu: phaiThu,
    DaThu: daThu,
    ConLai: phaiThu - daThu,
    PhaiThuPBT: phaiThuPBT,
    DaThuPBT: daThuPBT,
    ConNoPBT: conNoPBT,
    DienGiai: raw?.DienGiai ?? raw?.dien_giai ?? "",
  };
}

/**
 * Phân bổ tổng "đã thu" vào từng đợt (theo web allocatePaidToSchedule):
 * đổ hết PhaiThu đợt 1 → dư chảy sang đợt 2… hết phần gốc mới phân bổ PhaiThuPBT.
 */
function allocatePaidToSchedule(rows: any[], totalPaid: number) {
  let remaining = Number(totalPaid) || 0;
  const withBase = rows.map((r) => {
    const phaiThu = Number(r?.PhaiThu || 0);
    const paid = Math.min(remaining, phaiThu);
    remaining -= paid;
    return { ...r, DaThu: paid, ConLai: phaiThu - paid };
  });
  return withBase.map((r) => {
    const phaiThuPBT = Number(r?.PhaiThuPBT || 0);
    const paidPBT = Math.min(remaining, phaiThuPBT);
    remaining -= paidPBT;
    return { ...r, DaThuPBT: paidPBT, ConNoPBT: phaiThuPBT - paidPBT };
  });
}

/** Lấy phieu_giu_cho_id (pgc id) từ cloud_contracts.id (MaPGC). */
async function resolvePgcId(maPGC: string): Promise<string> {
  if (!maPGC) return "";
  if (UUID_RE.test(maPGC)) {
    try {
      const r = await axiosApiSupabase.get("rest/v1/cloud_contracts", {
        params: {
          select: "phieu_giu_cho_id",
          id: `eq.${maPGC}`,
          limit: "1",
        },
      });
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (row?.phieu_giu_cho_id) return row.phieu_giu_cho_id;
    } catch (e) {
      console.log("ERROR resolvePgcId:", e);
    }
  }
  return "";
}

/**
 * HỢP ĐỒNG — cloud (theo web):
 * - Danh sách: REST cloud_contracts !inner join cloud_pgc_phieu_giucho
 *   (pgc.giai_doan='HDMB', pgc.deleted_at is null, pgc.ma_ctdk_uid = tenant).
 * - Trạng thái: cloud_catalogs catalog_type='pgc_trang_thai' (ma_ctdk='global').
 * - Lịch thanh toán: cloud_catalogs catalog_type='lich_tt_hd', parent_code = MaPGC.
 * - Phiếu thu/chi: cloud_cash_voucher_details (pgc_id, loai_phieu) → cloud_cash_vouchers.
 */
export const HopDongService = {
  /**
   * Danh sách hợp đồng.
   * filter (legacy UI): { TuNgay, DenNgay, DuAn, MaTT, inputSearch, Offset, Limit, LoaiCT, TransferOnly }
   *  - Offset: 1-based (page). REST nhận offset 0-based = (Offset-1)*Limit.
   *  - Limit : pageSize (mặc định 50).
   *  - DuAn  : mảng hoặc chuỗi id dự án (ma_da_code hoặc uuid).
   *  - LoaiCT: 'HDMB' (mặc định) | 'HDGV'.
   *  - TransferOnly: true → chỉ hợp đồng chuyển nhượng (pgc.ma_hd_goc not null).
   */
  get: async (filter: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Contract] chưa có cloud_jwt hợp lệ, bỏ qua list contracts");
      return { data: [], totalRows: 0 };
    }

    try {
      const tenantId = await getCompanyId();
      const limit = Math.max(1, Number(filter?.Limit ?? filter?.limit ?? 50));
      const page = Math.max(1, Number(filter?.Offset ?? filter?.offset ?? 1));
      const offset = (page - 1) * limit;

      const loaiCT = String(filter?.LoaiCT ?? filter?.loaiCT ?? "HDMB")
        .trim()
        .toUpperCase();
      const transferOnly = Boolean(
        filter?.TransferOnly ?? filter?.transferOnly
      );

      const select = [
        "id,so_hdmb,loai_ct,ngay_ky,so_tien,ghi_chu,ngay_nhap,ngay_sua,phieu_giu_cho_id,da_project_id",
        "da:da_projects!da_project_id(id,ten_da,ma_da:ma_da_code)",
        "tt:cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code)",
        "pgc:cloud_pgc_phieu_giucho!phieu_giu_cho_id!inner(" +
          "id,giai_doan,so_phieu_gc,ngay_giu_cho,ma_hd_goc," +
          "dien_tich,don_gia_gom_vat,gia_tri_hd,gia_tri_hd_sau_ck,tien_coc,da_thu,phi_bao_tri," +
          "tt_hop_dong,chinh_sach,lich_thanh_toan," +
          "trang_thai_id,san_pham_id,project_id,khach_hang_id,san_id," +
          "sp:bds_products!san_pham_id(id,ma_sp,ky_hieu,ma_da)," +
          "da:da_projects!project_id(id,ten_da,ma_da:ma_da_code)," +
          "kh:cloud_customers!khach_hang_id(id,ma_so_kh,ten_kh,ten_cong_ty,cccd,dien_thoai,email,dia_chi)," +
          "san:dm_companies!san_id(id,ten_ct,ten_ct_vt)," +
          "tt:cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code))",
      ].join(",");

      // Build query thủ công (mảng key=value đã encode) — hỗ trợ key lặp lại
      // (ngay_ky cần cả gte + lte) và an toàn trên mọi runtime RN.
      const enc = (v: string) => encodeURIComponent(v);
      const qs: string[] = [
        `select=${enc(select)}`,
        `loai_ct=${enc(`eq.${loaiCT}`)}`,
        `order=${enc("ngay_ky.desc.nullslast,ngay_nhap.desc")}`,
        `limit=${limit}`,
        `offset=${offset}`,
      ];

      if (tenantId && UUID_RE.test(tenantId)) {
        qs.push(`pgc.ma_ctdk_uid=${enc(`eq.${tenantId}`)}`);
      }
      qs.push(`pgc.giai_doan=${enc(`eq.${loaiCT}`)}`);
      qs.push("pgc.deleted_at=is.null");
      qs.push(
        transferOnly ? "pgc.ma_hd_goc=not.is.null" : "pgc.ma_hd_goc=is.null"
      );

      // Dự án: resolve ma_da_code -> uuid
      const projectIds = parseProjectIds(
        filter?.DuAn ?? filter?.duAn ?? filter?.projectId
      );
      if (projectIds.length > 0) {
        const projectUuids = await resolveProjectUuids(projectIds);
        if (projectUuids.length > 0) {
          qs.push(
            `pgc.project_id=${enc(`in.(${projectUuids.join(",")})`)}`
          );
        }
      }

      // Khoảng ngày ký (cùng key xuất hiện 2 lần: gte rồi lte)
      const tuNgay = toIsoDate(filter?.TuNgay ?? filter?.tuNgay);
      const denNgay = toIsoDate(filter?.DenNgay ?? filter?.denNgay);
      if (tuNgay) qs.push(`ngay_ky=${enc(`gte.${tuNgay}`)}`);
      if (denNgay) qs.push(`ngay_ky=${enc(`lte.${denNgay}`)}`);

      // Tìm kiếm 2 bước
      const search = String(
        filter?.inputSearch ?? filter?.keyword ?? ""
      ).trim();
      if (search) {
        const pgcIds = await resolveSearchPgcIds(search);
        const orParts = [`so_hdmb.ilike.%${search}%`];
        if (pgcIds.length > 0) {
          orParts.push(`phieu_giu_cho_id.in.(${pgcIds.join(",")})`);
        }
        qs.push(`or=${enc(`(${orParts.join(",")})`)}`);
      }

      const res = await axiosApiSupabase.get(
        `rest/v1/cloud_contracts?${qs.join("&")}`,
        { headers: { Prefer: "count=exact" } }
      );

      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped = rows.map(mapContractRow);

      // total_count lấy từ Content-Range: "0-49/123"
      let total = mapped.length;
      const contentRange =
        res.headers?.["content-range"] || res.headers?.["Content-Range"];
      if (contentRange && String(contentRange).includes("/")) {
        const t = Number(String(contentRange).split("/")[1]);
        if (Number.isFinite(t)) total = t;
      }

      return { data: mapped, totalRows: total };
    } catch (error) {
      console.log("ERROR HopDongService.get (cloud_contracts):", error);
      return { data: [], totalRows: 0 };
    }
  },

  /**
   * Danh mục trạng thái hợp đồng — cloud_catalogs catalog_type='pgc_trang_thai'
   * (dùng chung: ma_ctdk='global'), order item_code asc.
   * Shape UI cũ: { data: [{ MaTT, TenTT, ColorWeb }] } — MaTT = item_code.
   */
  getTT: async (_payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Contract] chưa có cloud_jwt, bỏ qua getTT");
      return { data: [] };
    }

    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params: {
          select: "id,item_code,item_name,color_code",
          catalog_type: "eq.pgc_trang_thai",
          ma_ctdk: "eq.global",
          order: "item_code.asc",
          limit: "100",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      const data = rows.map((r: any) => {
        const code = r?.item_code;
        const num = Number(code);
        return {
          MaTT: Number.isFinite(num) ? num : code,
          TenTT: r?.item_name || "",
          ColorWeb: r?.color_code || "#9CA3AF",
          _raw: r,
        };
      });
      return { data };
    } catch (error) {
      console.log(
        "ERROR HopDongService.getTT (cloud_catalogs pgc_trang_thai):",
        error
      );
      return { data: [] };
    }
  },

  /**
   * Lịch thanh toán hợp đồng (tab "Lịch thanh toán").
   * - Nguồn: cloud_catalogs catalog_type='lich_tt_hd', parent_code = MaPGC.
   * - Fallback: mảng JSONB lich_thanh_toan trên cloud_pgc_phieu_giucho.
   * - "Đã thu" phân bổ từ tổng phiếu thu (allocatePaidToSchedule).
   * Shape UI cũ: { data: [{ dotTT, tyLeTT, phaiThu, daThu, conLai, ... }] }
   */
  getDetailLTT: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Contract] chưa có cloud_jwt, bỏ qua getDetailLTT");
      return { data: [] };
    }

    const maPGC = payload?.MaPGC ?? payload?.maPGC ?? payload?.id;
    if (!maPGC) return { data: [] };

    try {
      let lichTT: any[] = [];

      // 1) cloud_catalogs catalog_type='lich_tt_hd'
      try {
        const r = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
          params: {
            select: "raw",
            catalog_type: "eq.lich_tt_hd",
            parent_code: `eq.${maPGC}`,
            limit: "200",
          },
        });
        const rows = Array.isArray(r.data) ? r.data : [];
        lichTT = rows
          .map((x: any) => normalizeScheduleRow(x?.raw))
          .filter(Boolean)
          .sort((a: any, b: any) => Number(a.DotTT) - Number(b.DotTT));
      } catch (e) {
        console.log("ERROR contract lichTT (cloud_catalogs):", e);
      }

      // 2) Fallback: JSONB lich_thanh_toan trên pgc
      if (lichTT.length === 0) {
        try {
          const pgcId = await resolvePgcId(maPGC);
          if (pgcId) {
            const p = await axiosApiSupabase.get(
              "rest/v1/cloud_pgc_phieu_giucho",
              {
                params: {
                  select: "lich_thanh_toan",
                  id: `eq.${pgcId}`,
                  limit: "1",
                },
              }
            );
            const row = Array.isArray(p.data) ? p.data[0] : null;
            if (Array.isArray(row?.lich_thanh_toan)) {
              lichTT = row.lich_thanh_toan
                .map((x: any) => normalizeScheduleRow(x))
                .filter(Boolean)
                .sort((a: any, b: any) => Number(a.DotTT) - Number(b.DotTT));
            }
          }
        } catch (e) {
          console.log("ERROR contract lichTT (pgc jsonb):", e);
        }
      }

      // 3) Phân bổ "đã thu" từ tổng phiếu thu
      const phieuThu = await HopDongService.getDetailLST({
        MaPGC: maPGC,
        isPhieuThu: true,
      });
      const tongDaThu = (phieuThu?.data || []).reduce(
        (s: number, x: any) => s + Number(x?.tienThu || 0),
        0
      );
      lichTT = allocatePaidToSchedule(lichTT, tongDaThu);

      // Map ra shape UI cũ
      const data = lichTT.map((r: any) => ({
        dotTT: r.DotTT,
        dotTTText: r.DotTTText,
        ngayTT: r.NgayTT,
        tyLeTT: r.TyLeTT,
        soTien: r.SoTien,
        phaiThu: r.PhaiThu,
        daThu: r.DaThu,
        conLai: r.ConLai,
        phaiThuPBT: r.PhaiThuPBT,
        daThuPBT: r.DaThuPBT,
        conNoPBT: r.ConNoPBT,
        dienGiai: r.DienGiai,
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getDetailLTT:", error);
      return { data: [] };
    }
  },

  /**
   * Phiếu thu / phiếu chi của hợp đồng.
   * - Nguồn: cloud_cash_voucher_details (pgc_id = phieu_giu_cho_id, loai_phieu='THU'|'CHI')
   *   → cloud_cash_vouchers.
   * Shape UI cũ: { data: [{ ngayThu, tienThu, dotTT, name, ... }] }
   */
  getDetailLST: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Contract] chưa có cloud_jwt, bỏ qua getDetailLST");
      return { data: [] };
    }

    const maPGC = payload?.MaPGC ?? payload?.maPGC ?? payload?.id;
    const isPhieuThu = payload?.isPhieuThu !== false;
    const loaiPhieu = isPhieuThu ? "THU" : "CHI";
    if (!maPGC) return { data: [] };

    try {
      const tenantId = await getCompanyId();
      const pgcId = await resolvePgcId(maPGC);
      if (!pgcId) return { data: [] };

      const dParams: Record<string, string> = {
        select: "ma_phieu_id,so_tien,dot_tt",
        loai_phieu: `eq.${loaiPhieu}`,
        pgc_id: `eq.${pgcId}`,
        limit: "5000",
      };
      if (tenantId && UUID_RE.test(tenantId)) {
        dParams.ma_ctdk = `eq.${tenantId}`;
      }

      const d = await axiosApiSupabase.get(
        "rest/v1/cloud_cash_voucher_details",
        { params: dParams }
      );
      const details = Array.isArray(d.data) ? d.data : [];
      const ids = Array.from(
        new Set(details.map((x: any) => x?.ma_phieu_id).filter(Boolean))
      );
      if (ids.length === 0) return { data: [] };

      const vParams: Record<string, string> = {
        select:
          "id,so_phieu,ngay_phieu,so_tien,dien_giai,nguoi_nop,hinh_thuc",
        id: `in.(${ids.join(",")})`,
        limit: "5000",
      };
      if (tenantId && UUID_RE.test(tenantId)) {
        vParams.ma_ctdk = `eq.${tenantId}`;
      }

      const v = await axiosApiSupabase.get("rest/v1/cloud_cash_vouchers", {
        params: vParams,
      });
      const vouchers = Array.isArray(v.data) ? v.data : [];

      const data = vouchers.map((x: any) => ({
        soPT: x?.so_phieu,
        ngayThu: x?.ngay_phieu,
        tienThu: x?.so_tien ?? 0,
        tienChi: x?.so_tien ?? 0,
        dienGiai: x?.dien_giai,
        hoTen: x?.nguoi_nop,
        hinhThuc: x?.hinh_thuc,
        maLoai: null,
        dotTT: x?.dot_tt ?? null,
        name: x?.dien_giai || "",
      }));

      return { data };
    } catch (error) {
      console.log("ERROR getDetailLST:", error);
      return { data: [] };
    }
  },
};
